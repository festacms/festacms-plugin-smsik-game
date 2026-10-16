/**
 * FestaCMS — Игра «Смсик: Космическая доставка»
 * WebGL-рендер на Pixi.js — MVP v0.2
 *
 * Changelog:
 *   0.2: 
 *     - fix: спавн звёзд-пауэрапов (оружие)
 *     - fix: обработка подбора пауэрапа (не наносит урон)
 *     - fix: скрытие DOM-элементов старой Canvas-версии
 *     - добавлено: временное оружие с самого старта (для теста)
 *
 *   0.1: Первый MVP — Смсик, враги, стрельба, жизни
 */

(function () {
    'use strict';

    // ============================================================
    // === ДЕТЕКТ МОБИЛЬНОГО ======================================
    // ============================================================

    var IS_MOBILE = (function () {
        var ua = navigator.userAgent || '';
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
        if (typeof window.orientation !== 'undefined') return true;
        if ('ontouchstart' in window && window.innerWidth < 1024) return true;
        return false;
    })();

    // ============================================================
    // === КОНФИГ =================================================
    // ============================================================

    var CFG = {
        PLAYER_SIZE:      44,
        PLAYER_ACC:       1.15,
        PLAYER_MAX_V:     14,
        PLAYER_FRICTION:  0.90,
        MOUSE_LERP:       0.22,

        MAX_LIVES:        5,

        SPAWN_RATE_BASE:  50,
        ITEM_FALL_MIN:    1.6,
        ITEM_FALL_MAX:    2.8,

        BONUS_CHANCE:     0.45,

        LEVEL_STEP:       200,
        LEVEL_SPEED_UP:   1.15,

        // Оружие
        WEAPON_DURATION:  8 * 60,   // кадров (~8 сек)
        WEAPON_COOLDOWN:  9,
        BULLET_SPEED:     14,
        BULLET_SIZE:      4,

        // Очки
        POINTS_ENEMY:     5,
        POINTS_NLO:       15,
        POINTS_DEMON:     50,
        POINTS_BONUS:     10,

        // Управление
        SWIPE_SENSITIVITY: 1.8,

        // === ВРЕМЕННО (для теста) ===
        // true — даём оружие с самого старта
        // false — только через подбор ⭐
        TEST_GIVE_WEAPON_AT_START: true,
        TEST_WEAPON_DURATION: 5 * 60 * 60,   // 5 минут
    };

    function rand(min, max) { return min + Math.random() * (max - min); }
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // ============================================================
    // === КОНВЕРТАЦИЯ СПРАЙТОВ SVG → PIXI.TEXTURE ================
    // ============================================================

    function convertSpritesToTextures() {
        var S = window.FestaSprites;
        if (!S || !S.images) return {};

        var textures = {};
        Object.keys(S.images).forEach(function (key) {
            var img = S.images[key];
            if (img) {
                try {
                    textures[key] = PIXI.Texture.from(img);
                } catch (e) {
                    console.warn('[PixiGame] Не удалось создать текстуру для', key, e);
                }
            }
        });
        return textures;
    }

    // ============================================================
    // === ОСНОВНОЙ КЛАСС ИГРЫ ====================================
    // ============================================================

    function PixiGame(stageEl) {
        this.stage = stageEl;
        this.app = null;
        this.textures = {};

        this.W = 0;
        this.H = 0;

        // Игровое состояние
        this.running = false;
        this.frame = 0;
        this.score = 0;
        this.level = 1;
        this.lives = CFG.MAX_LIVES;
        this.speedMul = 1;

        this.weaponActive = false;
        this.weaponTimer = 0;
        this.fireCooldown = 0;
        this.fireHeld = false;

        // Игровые объекты
        this.player = null;
        this.playerVx = 0;
        this.playerTilt = 0;

        this.items = [];
        this.bullets = [];
        this.stars = [];

        this._itemTimer = rand(20, 40);
        this._powerupTimer = 5 * 60;   // первый пауэрап через ~5 секунд

        // Управление
        this.pointer = { x: 0, active: false };
        this.keys = { left: false, right: false };
        this.touch = { active: false, lastX: 0, pointerId: null };

        // FPS
        this._fps = 0;
        this._fpsAcc = 0;
        this._fpsFrames = 0;

        // HUD
        this.hud = {};

        this._boundResize = this._onResize.bind(this);
        this._boundTick = this._tick.bind(this);

        this._init();
    }

    PixiGame.prototype._init = function () {
        // === Создаём Pixi Application ===
        this.app = new PIXI.Application({
            width: window.innerWidth,
            height: window.innerHeight,
            background: 0x000104,
            antialias: false,
            resolution: Math.min(window.devicePixelRatio || 1, 1.5),
            autoDensity: true,
            powerPreference: 'high-performance',
        });

        this.app.view.style.position = 'absolute';
        this.app.view.style.top = '0';
        this.app.view.style.left = '0';
        this.app.view.style.width = '100%';
        this.app.view.style.height = '100%';
        this.app.view.style.zIndex = '4';

        this.stage.appendChild(this.app.view);

        this.W = this.app.screen.width;
        this.H = this.app.screen.height;

        // === Фикс 1: Скрываем DOM-элементы старой Canvas-версии ===
        var hideSelectors = [
            '.starfall-hud',
            '.starfall-fire-btn',
            '.starfall-flash',
            '.starfall-overlay',
        ];
        hideSelectors.forEach(function (sel) {
            var els = this.stage.querySelectorAll(sel);
            for (var i = 0; i < els.length; i++) {
                els[i].style.display = 'none';
            }
        }.bind(this));

        // === Загружаем спрайты в текстуры ===
        this.textures = convertSpritesToTextures();
        console.log('[PixiGame] Загружено текстур:', Object.keys(this.textures).length);

        // === Создаём фон ===
        this._createBackground();

        // === Создаём игрока ===
        this._createPlayer();

        // === Создаём HUD ===
        this._createHud();

        // === Навешиваем обработчики ===
        this._attachEvents();

        // === ВРЕМЕННО: даём оружие с самого старта ===
        if (CFG.TEST_GIVE_WEAPON_AT_START) {
            this.weaponActive = true;
            this.weaponTimer = CFG.TEST_WEAPON_DURATION;
            console.log('[PixiGame] ТЕСТ: оружие активно с самого старта');
        }

        // === Запускаем цикл ===
        this.running = true;
        this.app.ticker.add(this._boundTick);

        console.log('[PixiGame] Игра запущена');
    };

    // ============================================================
    // === ФОН ====================================================
    // ============================================================

    PixiGame.prototype._createBackground = function () {
        var canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 256;
        var ctx = canvas.getContext('2d');
        var grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, '#000104');
        grad.addColorStop(0.4, '#02030a');
        grad.addColorStop(0.75, '#040611');
        grad.addColorStop(1, '#000105');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1, 256);

        var tex = PIXI.Texture.from(canvas);
        this.bgSprite = new PIXI.Sprite(tex);
        this.bgSprite.width = this.W;
        this.bgSprite.height = this.H;
        this.app.stage.addChild(this.bgSprite);

        this.stars = [];
        var starCount = Math.min(Math.floor(this.W * this.H / 30000), 300);
        for (var i = 0; i < starCount; i++) {
            var star = new PIXI.Graphics();
            star.beginFill(0xffffff, rand(0.3, 0.9));
            star.drawCircle(0, 0, rand(0.5, 1.5));
            star.endFill();
            star.x = Math.random() * this.W;
            star.y = Math.random() * this.H;
            star._speed = rand(0.1, 0.5);
            this.app.stage.addChild(star);
            this.stars.push(star);
        }
    };

    // ============================================================
    // === ИГРОК ==================================================
    // ============================================================

    PixiGame.prototype._createPlayer = function () {
        var tex = this.textures.smsik;
        if (!tex) {
            console.error('[PixiGame] Нет текстуры Смсика!');
            return;
        }

        this.player = new PIXI.Sprite(tex);
        this.player.anchor.set(0.5);
        this.player.width = CFG.PLAYER_SIZE * 2.4;
        this.player.height = CFG.PLAYER_SIZE * 2.4;
        this.player.x = this.W / 2;
        this.player.y = this.H - 70;
        this.app.stage.addChild(this.player);
    };

    // ============================================================
    // === HUD ====================================================
    // ============================================================

    PixiGame.prototype._createHud = function () {
        var hudStyle = {
            fontFamily: 'Arial, sans-serif',
            fontSize: 20,
            fill: 0x64C8BD,
            fontWeight: 'bold',
        };

        this.hud.score = new PIXI.Text('Очки: 0', hudStyle);
        this.hud.score.x = this.W - 200;
        this.hud.score.y = 15;
        this.app.stage.addChild(this.hud.score);

        this.hud.lives = new PIXI.Text('❤️❤️❤️❤️❤️', {
            fontFamily: 'Arial, sans-serif',
            fontSize: 22,
            fill: 0xffffff,
        });
        this.hud.lives.x = 15;
        this.hud.lives.y = 15;
        this.app.stage.addChild(this.hud.lives);

        this.hud.level = new PIXI.Text('Ур. 1', hudStyle);
        this.hud.level.x = 15;
        this.hud.level.y = 50;
        this.app.stage.addChild(this.hud.level);

        this.hud.fps = new PIXI.Text('FPS: --', {
            fontFamily: 'monospace',
            fontSize: 14,
            fill: 0xffd280,
            fontWeight: 'bold',
        });
        this.hud.fps.x = this.W - 100;
        this.hud.fps.y = 50;
        this.app.stage.addChild(this.hud.fps);

        this.hud.weapon = new PIXI.Text('', {
            fontFamily: 'Arial',
            fontSize: 18,
            fill: 0xffd280,
        });
        this.hud.weapon.x = this.W / 2 - 40;
        this.hud.weapon.y = 15;
        this.app.stage.addChild(this.hud.weapon);
    };

    // ============================================================
    // === ОБРАБОТЧИКИ СОБЫТИЙ ====================================
    // ============================================================

    PixiGame.prototype._attachEvents = function () {
        var self = this;

        window.addEventListener('resize', this._boundResize);

        // === Мышка ===
        document.addEventListener('mousemove', function (e) {
            self.pointer.x = e.clientX;
            self.pointer.active = true;
        });
        document.addEventListener('mousedown', function () { self.fireHeld = true; });
        document.addEventListener('mouseup', function () { self.fireHeld = false; });

        // === Клавиатура ===
        document.addEventListener('keydown', function (e) {
            var k = e.key;
            if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'ф' || k === 'Ф') self.keys.left = true;
            if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'в' || k === 'В') self.keys.right = true;
            if (k === ' ') { self.fireHeld = true; e.preventDefault(); }
        });
        document.addEventListener('keyup', function (e) {
            var k = e.key;
            if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'ф' || k === 'Ф') self.keys.left = false;
            if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'в' || k === 'В') self.keys.right = false;
            if (k === ' ') self.fireHeld = false;
        });

        // === Тач ===
        if (IS_MOBILE) {
            document.addEventListener('touchstart', function (e) {
                if (e.target.closest('button')) return;
                var t = e.touches[0];
                if (!t) return;
                self.touch.active = true;
                self.touch.lastX = t.clientX;
                self.touch.pointerId = t.identifier;
            }, { passive: true });

            document.addEventListener('touchmove', function (e) {
                if (!self.touch.active) return;
                var t = null;
                for (var i = 0; i < e.touches.length; i++) {
                    if (e.touches[i].identifier === self.touch.pointerId) {
                        t = e.touches[i];
                        break;
                    }
                }
                if (!t) return;
                var dx = t.clientX - self.touch.lastX;
                self.touch.lastX = t.clientX;

                if (self.player) {
                    var margin = CFG.PLAYER_SIZE / 2 + 4;
                    self.player.x = clamp(
                        self.player.x + dx * CFG.SWIPE_SENSITIVITY,
                        margin,
                        self.W - margin
                    );
                    self.playerVx = dx * CFG.SWIPE_SENSITIVITY;
                }
            }, { passive: true });

            document.addEventListener('touchend', function () {
                self.touch.active = false;
                self.touch.pointerId = null;
            });
        }
    };

    PixiGame.prototype._onResize = function () {
        if (!this.app) return;
        this.app.renderer.resize(window.innerWidth, window.innerHeight);
        this.W = this.app.screen.width;
        this.H = this.app.screen.height;

        if (this.bgSprite) {
            this.bgSprite.width = this.W;
            this.bgSprite.height = this.H;
        }
        if (this.player) {
            this.player.y = this.H - 70;
            this.player.x = clamp(this.player.x, 40, this.W - 40);
        }

        if (this.hud.score)  this.hud.score.x  = this.W - 200;
        if (this.hud.fps)    this.hud.fps.x    = this.W - 100;
        if (this.hud.weapon) this.hud.weapon.x = this.W / 2 - 40;
    };

    // ============================================================
    // === ИГРОВОЙ ЦИКЛ ===========================================
    // ============================================================

    PixiGame.prototype._tick = function (delta) {
        if (!this.running) return;

        var k = delta;
        this.frame++;

        // FPS счётчик
        this._fpsFrames++;
        if (this._fpsFrames >= 30) {
            this._fps = Math.round(this.app.ticker.FPS);
            this._fpsFrames = 0;
            if (this.hud.fps) {
                this.hud.fps.text = 'FPS: ' + this._fps;
                this.hud.fps.style.fill = this._fps >= 55 ? 0x64C8BD : this._fps >= 40 ? 0xffd280 : 0xff4040;
            }
        }

        this._updateBackground(k);
        this._updatePlayer(k);
        this._updateWeapon(k);
        this._updateItems(k);
        this._updateBullets(k);
    };

    // ============================================================
    // === ОБНОВЛЕНИЕ ФОНА ========================================
    // ============================================================

    PixiGame.prototype._updateBackground = function (k) {
        for (var i = 0; i < this.stars.length; i++) {
            var s = this.stars[i];
            s.y += s._speed * k;
            if (s.y > this.H + 5) {
                s.y = -5;
                s.x = Math.random() * this.W;
            }
        }
    };

    // ============================================================
    // === ОБНОВЛЕНИЕ ИГРОКА ======================================
    // ============================================================

    PixiGame.prototype._updatePlayer = function (k) {
        if (!this.player) return;

        var p = this.player;
        var margin = CFG.PLAYER_SIZE / 2 + 4;
        var keyboardActive = this.keys.left || this.keys.right;

        if (keyboardActive) {
            this.pointer.active = false;
            if (this.keys.left)  this.playerVx -= CFG.PLAYER_ACC * k;
            if (this.keys.right) this.playerVx += CFG.PLAYER_ACC * k;
            this.playerVx *= CFG.PLAYER_FRICTION;
            this.playerVx = clamp(this.playerVx, -CFG.PLAYER_MAX_V, CFG.PLAYER_MAX_V);
            p.x += this.playerVx * k;
        } else if (this.pointer.active && !IS_MOBILE) {
            var diff = this.pointer.x - p.x;
            p.x += diff * CFG.MOUSE_LERP * k;
            this.playerVx = diff * CFG.MOUSE_LERP;
        } else {
            this.playerVx *= 0.85;
            p.x += this.playerVx * k;
        }

        p.x = clamp(p.x, margin, this.W - margin);

        this.playerTilt = clamp(this.playerVx * 0.025, -0.30, 0.30);
        p.rotation = this.playerTilt;
    };

    // ============================================================
    // === ОБНОВЛЕНИЕ ОРУЖИЯ ======================================
    // ============================================================

    PixiGame.prototype._updateWeapon = function (k) {
        if (this.weaponActive) {
            this.weaponTimer -= k;
            if (this.weaponTimer <= 0) {
                this.weaponActive = false;
                this.weaponTimer = 0;
                if (this.hud.weapon) this.hud.weapon.text = '';
            } else {
                if (this.hud.weapon) {
                    this.hud.weapon.text = '🔫 ' + (this.weaponTimer / 60).toFixed(1) + 's';
                }
            }
        }

        this.fireCooldown -= k;
        if (this.fireHeld && this.weaponActive && this.fireCooldown <= 0) {
            this._fireBullet();
            this.fireCooldown = CFG.WEAPON_COOLDOWN;
        }
    };

    PixiGame.prototype._fireBullet = function () {
        var tex = this.textures.bullet;
        if (!tex || !this.player) return;

        var bullet = new PIXI.Sprite(tex);
        bullet.anchor.set(0.5);
        bullet.width = CFG.BULLET_SIZE * 6;
        bullet.height = CFG.BULLET_SIZE * 6;
        bullet.x = this.player.x;
        bullet.y = this.player.y - CFG.PLAYER_SIZE / 2;
        this.app.stage.addChild(bullet);

        this.bullets.push({
            sprite: bullet,
            vx: 0,
            vy: -CFG.BULLET_SPEED,
            life: 1,
        });
    };

    // ============================================================
    // === СПАВН И ОБНОВЛЕНИЕ ПРЕДМЕТОВ ===========================
    // ============================================================

    PixiGame.prototype._updateItems = function (k) {
        // === Спавн врагов и бонусов ===
        this._itemTimer -= k;
        if (this._itemTimer <= 0) {
            this._spawnItem();
            var interval = CFG.SPAWN_RATE_BASE - this.level * 2;
            if (interval < 20) interval = 20;
            this._itemTimer = interval + rand(-8, 8);
        }

        // === Спавн звёзд-пауэрапов ===
        this._powerupTimer -= k;
        if (this._powerupTimer <= 0) {
            this._spawnPowerup();
            this._powerupTimer = rand(30 * 60, 60 * 60);
        }

        // === Обновляем все предметы ===
        for (var i = this.items.length - 1; i >= 0; i--) {
            var it = this.items[i];
            it.sprite.y += it.vy * k;
            it.sprite.x += it.vx * k;
            it.sprite.rotation += it.rotSpeed * k;

            if (it.sprite.x < 20 || it.sprite.x > this.W - 20) {
                it.vx *= -1;
                it.sprite.x = clamp(it.sprite.x, 20, this.W - 20);
            }

            // Столкновение с игроком
            if (this.player && !it.hit) {
                var dx = it.sprite.x - this.player.x;
                var dy = it.sprite.y - this.player.y;
                var hitDist = it.radius + CFG.PLAYER_SIZE / 2 - 6;

                if (dx * dx + dy * dy < hitDist * hitDist) {
                    this._onItemHit(it);
                    it.hit = true;
                    this.app.stage.removeChild(it.sprite);
                    it.sprite.destroy();
                    this.items.splice(i, 1);
                    continue;
                }
            }

            // Ушёл за нижний край
            if (it.sprite.y > this.H + 60) {
                this.app.stage.removeChild(it.sprite);
                it.sprite.destroy();
                this.items.splice(i, 1);
            }
        }
    };

    PixiGame.prototype._spawnItem = function () {
        var roll = Math.random();
        var type, spriteKey;

        if (roll < CFG.BONUS_CHANCE) {
            type = 'bonus';
            spriteKey = 'gift';
        } else {
            var enemyRoll = Math.random();
            if (this.level <= 3) {
                type = 'monster'; spriteKey = 'antisms';
            } else if (this.level <= 6) {
                if (enemyRoll < 0.7) { type = 'monster'; spriteKey = 'antisms'; }
                else { type = 'nlo'; spriteKey = 'glitch'; }
            } else {
                if (enemyRoll < 0.6) { type = 'monster'; spriteKey = 'antisms'; }
                else if (enemyRoll < 0.9) { type = 'nlo'; spriteKey = 'glitch'; }
                else { type = 'demon'; spriteKey = 'demon'; }
            }
        }

        var tex = this.textures[spriteKey];
        if (!tex) { console.warn('[PixiGame] Нет текстуры', spriteKey); return; }

        var sprite = new PIXI.Sprite(tex);
        sprite.anchor.set(0.5);

        var size, radius, damage, speedMul, points;
        if (type === 'bonus') {
            size = 34; radius = 20; damage = 0; speedMul = 1.0; points = CFG.POINTS_BONUS;
        } else if (type === 'monster') {
            size = 38; radius = 22; damage = 1; speedMul = 1.0; points = CFG.POINTS_ENEMY;
        } else if (type === 'nlo') {
            size = 42; radius = 24; damage = 2; speedMul = 1.2; points = CFG.POINTS_NLO;
        } else {
            size = 46; radius = 26; damage = 3; speedMul = 1.4; points = CFG.POINTS_DEMON;
        }

        sprite.width = size * 2.2;
        sprite.height = size * 2.2;
        sprite.x = rand(40, this.W - 40);
        sprite.y = -50;

        this.app.stage.addChild(sprite);

        this.items.push({
            sprite: sprite,
            type: type,
            damage: damage,
            radius: radius,
            points: points,
            vx: rand(-0.7, 0.7),
            vy: rand(CFG.ITEM_FALL_MIN, CFG.ITEM_FALL_MAX) * speedMul * this.speedMul,
            rotSpeed: rand(-0.03, 0.03),
            hit: false,
        });
    };

    PixiGame.prototype._spawnPowerup = function () {
        var tex = this.textures.star;
        if (!tex) { console.warn('[PixiGame] Нет текстуры star'); return; }

        var sprite = new PIXI.Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.width = 44 * 2.2;
        sprite.height = 44 * 2.2;
        sprite.x = rand(60, this.W - 60);
        sprite.y = -50;

        this.app.stage.addChild(sprite);

        this.items.push({
            sprite: sprite,
            type: 'powerup',
            damage: 0,
            radius: 26,
            points: 0,
            vx: rand(-0.3, 0.3),
            vy: rand(1.4, 2.0),
            rotSpeed: rand(-0.03, 0.03),
            hit: false,
        });
    };
    // ============================================================
    // === ОБНОВЛЕНИЕ ПУЛЬ ========================================
    // ============================================================

    PixiGame.prototype._updateBullets = function (k) {
        for (var i = this.bullets.length - 1; i >= 0; i--) {
            var b = this.bullets[i];
            b.sprite.y += b.vy * k;
            b.life -= 0.01 * k;

            // Попадание в предметы
            var hitItem = null;
            for (var j = 0; j < this.items.length; j++) {
                var it = this.items[j];
                if (it.type === 'bonus' || it.type === 'powerup') continue;
                var dx = b.sprite.x - it.sprite.x;
                var dy = b.sprite.y - it.sprite.y;
                if (dx * dx + dy * dy < it.radius * it.radius) {
                    hitItem = it;
                    break;
                }
            }

            if (hitItem) {
                this._onEnemyKilled(hitItem);

                var idx = this.items.indexOf(hitItem);
                if (idx >= 0) {
                    this.app.stage.removeChild(hitItem.sprite);
                    hitItem.sprite.destroy();
                    this.items.splice(idx, 1);
                }

                this.app.stage.removeChild(b.sprite);
                b.sprite.destroy();
                this.bullets.splice(i, 1);
                continue;
            }

            if (b.sprite.y < -30 || b.life <= 0) {
                this.app.stage.removeChild(b.sprite);
                b.sprite.destroy();
                this.bullets.splice(i, 1);
            }
        }
    };

    // ============================================================
    // === ОБРАБОТКА СТОЛКНОВЕНИЙ =================================
    // ============================================================

    PixiGame.prototype._onItemHit = function (it) {
        if (it.type === 'bonus') {
            // Бонус — очки
            this.score += it.points;
            this._updateScore();
            this._checkLevelUp();
        } else if (it.type === 'powerup') {
            // Фикс 3: звезда активирует оружие (не наносит урон!)
            this.weaponActive = true;
            this.weaponTimer = CFG.WEAPON_DURATION;
            this.fireCooldown = CFG.WEAPON_COOLDOWN;
            console.log('[PixiGame] Оружие активировано!');
        } else {
            // Враг — урон
            this._onEnemyDamage(it);
        }
    };

    PixiGame.prototype._onEnemyDamage = function (it) {
        this.lives -= it.damage;
        if (this.lives < 0) this.lives = 0;
        this._updateLives();

        if (this.lives <= 0) {
            this._gameOver();
        }
    };

    PixiGame.prototype._onEnemyKilled = function (it) {
        this.score += it.points;
        this._updateScore();
        this._checkLevelUp();
    };

    // ============================================================
    // === HUD ОБНОВЛЕНИЕ =========================================
    // ============================================================

    PixiGame.prototype._updateScore = function () {
        if (this.hud.score) {
            this.hud.score.text = 'Очки: ' + this.score;
        }
    };

    PixiGame.prototype._updateLives = function () {
        if (!this.hud.lives) return;
        var full = '';
        for (var i = 0; i < this.lives; i++) full += '❤️';
        var empty = '';
        for (var j = this.lives; j < CFG.MAX_LIVES; j++) empty += '🖤';
        this.hud.lives.text = full + empty;
    };

    PixiGame.prototype._checkLevelUp = function () {
        var newLevel = Math.floor(this.score / CFG.LEVEL_STEP) + 1;
        if (newLevel > this.level) {
            this.level = newLevel;
            this.speedMul *= CFG.LEVEL_SPEED_UP;
            if (this.hud.level) {
                this.hud.level.text = 'Ур. ' + this.level;
            }
        }
    };

    // ============================================================
    // === GAME OVER ==============================================
    // ============================================================

    PixiGame.prototype._gameOver = function () {
        this.running = false;
        console.log('[PixiGame] Игра окончена. Счёт:', this.score);

        // Показать финальный счёт
        if (this.hud.score) {
            this.hud.score.text = '🏆 ' + this.score + ' очков!';
            this.hud.score.style.fontSize = 36;
        }

        // Через 3 секунды — перезапуск
        var self = this;
        setTimeout(function () {
            self.restart();
        }, 3000);
    };

    // ============================================================
    // === RESTART ================================================
    // ============================================================

    PixiGame.prototype.restart = function () {
        // Удаляем предметы
        for (var i = 0; i < this.items.length; i++) {
            this.app.stage.removeChild(this.items[i].sprite);
            this.items[i].sprite.destroy();
        }
        this.items = [];

        // Удаляем пули
        for (var j = 0; j < this.bullets.length; j++) {
            this.app.stage.removeChild(this.bullets[j].sprite);
            this.bullets[j].sprite.destroy();
        }
        this.bullets = [];

        // Сброс состояния
        this.score = 0;
        this.level = 1;
        this.lives = CFG.MAX_LIVES;
        this.speedMul = 1;
        this.weaponActive = false;
        this.weaponTimer = 0;
        this.fireCooldown = 0;
        this._itemTimer = rand(20, 40);
        this._powerupTimer = 5 * 60;

        // Сброс игрока
        if (this.player) {
            this.player.x = this.W / 2;
            this.player.y = this.H - 70;
            this.playerVx = 0;
            this.playerTilt = 0;
            this.player.rotation = 0;
        }

        // Сброс HUD
        if (this.hud.score) {
            this.hud.score.style.fontSize = 20;
        }
        this._updateScore();
        this._updateLives();
        if (this.hud.level) this.hud.level.text = 'Ур. 1';
        if (this.hud.weapon) this.hud.weapon.text = '';

        // ВРЕМЕННО: оружие с самого старта
        if (CFG.TEST_GIVE_WEAPON_AT_START) {
            this.weaponActive = true;
            this.weaponTimer = CFG.TEST_WEAPON_DURATION;
        }

        // Погнали!
        this.running = true;
    };

    // ============================================================
    // === ПУБЛИЧНЫЙ API + АВТОЗАПУСК =============================
    // ============================================================

    window.FestaPixiGame = {
        start: function () {
            if (typeof PIXI === 'undefined') {
                console.warn('[PixiGame] Pixi.js не загружен.');
                return null;
            }

            var stage = document.querySelector('.starfall-stage');
            if (!stage) {
                console.warn('[PixiGame] Не найден .starfall-stage');
                return null;
            }

            // Ждём спрайтов
            var waitSprites = window.FestaSprites
                ? window.FestaSprites.load()
                : Promise.resolve();

            return waitSprites.then(function () {
                // Скрываем старый canvas
                var oldCanvas = stage.querySelector('canvas');
                if (oldCanvas) oldCanvas.style.display = 'none';

                // Запускаем Pixi-игру
                var game = new PixiGame(stage);
                window.FestaPixiGame.instance = game;
                return game;
            });
        }
    };

    // Автозапуск через 1 секунду после загрузки (чтобы Canvas-версия успела проинициализироваться)
    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () {
            window.FestaPixiGame.start();
        }, 1000);
    });

})();