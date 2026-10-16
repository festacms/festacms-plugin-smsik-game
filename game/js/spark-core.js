/**
 * FestaCMS — Спарк: Космическая Доставка
 * Игровая логика (PixiGame)
 *
 * v0.6.0:
 *   - Использует SmsikGame.CFG и SmsikGame.utils из spark-config.js
 *   - Использует FestaSprites из spark-sprites.js
 *   - Заготовки вызовов SmsikGame.Audio и SmsikGame.UI
 *   - Вся игровая логика сохранена из v0.5
 *
 * Файл разбит на 3 части для удобства копирования.
 * Это ЧАСТЬ 1/3: конструктор, инициализация, фон, игрок.
 */

(function () {
    'use strict';

    var SmsikGame = window.SmsikGame = window.SmsikGame || {};

    // Сокращения
    var rand    = SmsikGame.utils.rand;
    var randInt = SmsikGame.utils.randInt;
    var clamp   = SmsikGame.utils.clamp;
    var pick    = SmsikGame.utils.pick;

    var CFG       = SmsikGame.CFG;
    var IS_MOBILE = SmsikGame.IS_MOBILE;

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
    // === ОСНОВНОЙ КЛАСС =========================================
    // ============================================================

    function PixiGame(stageEl) {
        this.stage = stageEl;
        this.app = null;
        this.textures = {};

        this.W = 0;
        this.H = 0;

        this.running = false;
        this.frame = 0;
        this.score = 0;
        this.level = 1;
        this.lives = CFG.MAX_LIVES;
        this.speedMul = 1;

        // Оружие
        this.weaponActive = false;
        this.weaponTimer = 0;
        this.weaponMaxTimer = CFG.WEAPON_DURATION;
        this.fireCooldown = 0;
        this.fireHeld = false;

        // Игрок
        this.player = null;
        this.gunSprite = null;
        this.playerContainer = null;
        this.playerVx = 0;
        this.playerTilt = 0;
        this.playerGlow = null;
        this.glowTexture = null;
        this.playerHitTimer = 0;

        // Объекты
        this.items = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.stars = [];
        this.particles = [];
        this.texts = [];

        this._itemTimer = rand(20, 40);
        this._powerupTimer = 5 * 60;
        this._heartTimer = rand(CFG.HEART_INTERVAL_MIN, CFG.HEART_INTERVAL_MAX);

        // Управление
        this.pointer = { x: 0, active: false };
        this.keys = { left: false, right: false };
        this.touch = { active: false, lastX: 0, pointerId: null };

        // FPS
        this._fps = 0;
        this._fpsFrames = 0;

        // HUD
        this.hud = {};

        this._boundResize = this._onResize.bind(this);
        this._boundTick = this._tick.bind(this);

        this._init();
    }

    PixiGame.prototype._init = function () {
        // === Pixi Application ===
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

        // === Скрываем DOM старой версии (если остались) ===
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

        // === Текстуры ===
        this.textures = convertSpritesToTextures();
        console.log('[PixiGame] Загружено текстур:', Object.keys(this.textures).length);

        // === Создаём всё ===
        this._createBackground();
        this._createParticleLayer();
        this._createPlayer();
        this._createHud();
        this._createFlashOverlay();
        this._attachEvents();

        // === Блокируем скролл страницы ===
        if (SmsikGame.UI) SmsikGame.UI.lockScroll(true);

        // === Запуск ===
        this.running = true;
        this.app.ticker.add(this._boundTick);

        console.log('[PixiGame] v0.6.0 запущена');
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

    PixiGame.prototype._createParticleLayer = function () {
        this.particleLayer = new PIXI.Container();
        this.app.stage.addChild(this.particleLayer);
    };

    PixiGame.prototype._createFlashOverlay = function () {
        this.flashOverlay = new PIXI.Graphics();
        this.flashOverlay.beginFill(0xffffff, 1);
        this.flashOverlay.drawRect(0, 0, this.W, this.H);
        this.flashOverlay.endFill();
        this.flashOverlay.alpha = 0;
        this.flashOverlay.zIndex = 999;
        this.app.stage.addChild(this.flashOverlay);
    };

    PixiGame.prototype._flash = function (color, duration) {
        if (!this.flashOverlay) return;
        this.flashOverlay.tint = color;
        this.flashOverlay.alpha = 0.35;
        var self = this;
        var start = performance.now();
        var dur = duration || 200;

        function fade() {
            if (!self.flashOverlay) return;
            var elapsed = performance.now() - start;
            var t = elapsed / dur;
            if (t >= 1) {
                self.flashOverlay.alpha = 0;
                return;
            }
            self.flashOverlay.alpha = 0.35 * (1 - t);
            requestAnimationFrame(fade);
        }
        requestAnimationFrame(fade);
    };

    PixiGame.prototype._createGlowTexture = function () {
        var size = 256;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        var grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        return PIXI.Texture.from(canvas);
    };

    // ============================================================
    // === ИГРОК + ПУШКА ==========================================
    // ============================================================

    PixiGame.prototype._createPlayer = function () {
        var tex = this.textures.smsik;
        if (!tex) {
            console.error('[PixiGame] Нет текстуры Смсика!');
            return;
        }

        this.playerContainer = new PIXI.Container();
        this.playerContainer.x = this.W / 2;
        this.playerContainer.y = this.H - 70;
        this.app.stage.addChild(this.playerContainer);

        // Свечение
        this.glowTexture = this._createGlowTexture();
        this.playerGlow = new PIXI.Sprite(this.glowTexture);
        this.playerGlow.anchor.set(0.5);
        this.playerGlow.width = CFG.PLAYER_SIZE * 3;
        this.playerGlow.height = CFG.PLAYER_SIZE * 3;
        this.playerGlow.tint = 0x64c8bd;
        this.playerGlow.alpha = 0.5;
        this.playerContainer.addChild(this.playerGlow);

        // Смсик
        this.player = new PIXI.Sprite(tex);
        this.player.anchor.set(0.5);
        this.player.width = CFG.PLAYER_SIZE * 2.4;
        this.player.height = CFG.PLAYER_SIZE * 2.4;
        this.playerContainer.addChild(this.player);

        // Пушка (в руках)
        var gunTex = this.textures.gun;
        if (gunTex) {
            this.gunSprite = new PIXI.Sprite(gunTex);
            this.gunSprite.anchor.set(0.5);
            this.gunSprite.width = CFG.PLAYER_SIZE * 1.2;
            this.gunSprite.height = CFG.PLAYER_SIZE * 1.2;
            this.gunSprite.x = 0;
            this.gunSprite.y = CFG.PLAYER_SIZE * 0.6;
            this.gunSprite.visible = false;
            this.playerContainer.addChild(this.gunSprite);
        }
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

        // Очки
        this.hud.score = new PIXI.Text('Очки: 0', hudStyle);
        this.hud.score.x = this.W - 200;
        this.hud.score.y = 15;
        this.app.stage.addChild(this.hud.score);

        // Сердечки
        this.hud.hearts = [];
        this.hud.heartsContainer = new PIXI.Container();
        this.hud.heartsContainer.x = 15;
        this.hud.heartsContainer.y = 15;
        this.app.stage.addChild(this.hud.heartsContainer);

        var heartTex = this.textures.heart;
        if (heartTex) {
            for (var i = 0; i < CFG.MAX_LIVES; i++) {
                var h = new PIXI.Sprite(heartTex);
                h.width = 28;
                h.height = 28;
                h.x = i * 32;
                h.y = 0;
                this.hud.heartsContainer.addChild(h);
                this.hud.hearts.push(h);
            }
        }

        // Уровень
        this.hud.level = new PIXI.Text('Ур. 1', hudStyle);
        this.hud.level.x = 15;
        this.hud.level.y = 50;
        this.app.stage.addChild(this.hud.level);

        // FPS
        this.hud.fps = new PIXI.Text('FPS: --', {
            fontFamily: 'monospace',
            fontSize: 14,
            fill: 0xffd280,
            fontWeight: 'bold',
        });
        this.hud.fps.x = this.W - 100;
        this.hud.fps.y = 50;
        this.app.stage.addChild(this.hud.fps);

        // Оружие + прогресс-бар
        this.hud.weaponContainer = new PIXI.Container();
        this.hud.weaponContainer.x = this.W / 2 - 80;
        this.hud.weaponContainer.y = 15;
        this.hud.weaponContainer.visible = false;
        this.app.stage.addChild(this.hud.weaponContainer);

        var gunHudTex = this.textures.gun;
        if (gunHudTex) {
            var gunHud = new PIXI.Sprite(gunHudTex);
            gunHud.width = 36;
            gunHud.height = 36;
            gunHud.x = 0;
            gunHud.y = 0;
            this.hud.weaponContainer.addChild(gunHud);
        }

        this.hud.weaponTimerText = new PIXI.Text('15.0s', {
            fontFamily: 'Arial',
            fontSize: 18,
            fill: 0xffd280,
            fontWeight: 'bold',
        });
        this.hud.weaponTimerText.x = 42;
        this.hud.weaponTimerText.y = 8;
        this.hud.weaponContainer.addChild(this.hud.weaponTimerText);

        this.hud.weaponBarBg = new PIXI.Graphics();
        this.hud.weaponBarBg.beginFill(0x1a2a3a, 0.8);
        this.hud.weaponBarBg.drawRoundedRect(0, 30, 120, 8, 4);
        this.hud.weaponBarBg.endFill();
        this.hud.weaponContainer.addChild(this.hud.weaponBarBg);

        this.hud.weaponBarFill = new PIXI.Graphics();
        this.hud.weaponContainer.addChild(this.hud.weaponBarFill);

        this._redrawWeaponBar(1);
    };

    PixiGame.prototype._redrawWeaponBar = function (ratio) {
        if (!this.hud.weaponBarFill) return;
        ratio = clamp(ratio, 0, 1);
        this.hud.weaponBarFill.clear();

        var color;
        if (ratio > 0.5) color = 0x64C8BD;
        else if (ratio > 0.25) color = 0xffd280;
        else color = 0xff4040;

        var width = 120 * ratio;
        if (width < 1) width = 1;

        this.hud.weaponBarFill.beginFill(color);
        this.hud.weaponBarFill.drawRoundedRect(0, 30, width, 8, 4);
        this.hud.weaponBarFill.endFill();
    };

    // ============================================================
    // === ОБРАБОТЧИКИ ============================================
    // ============================================================

    PixiGame.prototype._attachEvents = function () {
        var self = this;

        window.addEventListener('resize', this._boundResize);

        // Мышка
        document.addEventListener('mousemove', function (e) {
            self.pointer.x = e.clientX;
            self.pointer.active = true;
        });
        document.addEventListener('mousedown', function () { self.fireHeld = true; });
        document.addEventListener('mouseup', function () { self.fireHeld = false; });

        // Клавиатура
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

        // Тач
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

                if (self.playerContainer) {
                    var margin = CFG.PLAYER_SIZE / 2 + 4;
                    self.playerContainer.x = clamp(
                        self.playerContainer.x + dx * CFG.SWIPE_SENSITIVITY,
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
        if (this.playerContainer) {
            this.playerContainer.y = this.H - 70;
            this.playerContainer.x = clamp(this.playerContainer.x, 40, this.W - 40);
        }
        if (this.flashOverlay) {
            this.flashOverlay.clear();
            this.flashOverlay.beginFill(0xffffff, 1);
            this.flashOverlay.drawRect(0, 0, this.W, this.H);
            this.flashOverlay.endFill();
        }

        if (this.hud.score)            this.hud.score.x = this.W - 200;
        if (this.hud.fps)              this.hud.fps.x = this.W - 100;
        if (this.hud.weaponContainer)  this.hud.weaponContainer.x = this.W / 2 - 80;
    };

    // ============================================================
    // === ИГРОВОЙ ЦИКЛ ===========================================
    // ============================================================

    PixiGame.prototype._tick = function (delta) {
        if (!this.running) return;

        var k = delta;
        this.frame++;

        // FPS
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
        this._updateEnemyBullets(k);
        this._syncAllEnemyGlows();
        this._updateParticles(k);
        this._updateTexts(k);
    };

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

    PixiGame.prototype._updatePlayer = function (k) {
        if (!this.playerContainer) return;

        var margin = CFG.PLAYER_SIZE / 2 + 4;
        var keyboardActive = this.keys.left || this.keys.right;

        if (keyboardActive) {
            this.pointer.active = false;
            if (this.keys.left)  this.playerVx -= CFG.PLAYER_ACC * k;
            if (this.keys.right) this.playerVx += CFG.PLAYER_ACC * k;
            this.playerVx *= CFG.PLAYER_FRICTION;
            this.playerVx = clamp(this.playerVx, -CFG.PLAYER_MAX_V, CFG.PLAYER_MAX_V);
            this.playerContainer.x += this.playerVx * k;
        } else if (this.pointer.active && !IS_MOBILE) {
            var diff = this.pointer.x - this.playerContainer.x;
            this.playerContainer.x += diff * CFG.MOUSE_LERP * k;
            this.playerVx = diff * CFG.MOUSE_LERP;
        } else {
            this.playerVx *= 0.85;
            this.playerContainer.x += this.playerVx * k;
        }

        this.playerContainer.x = clamp(this.playerContainer.x, margin, this.W - margin);

        this.playerTilt = clamp(this.playerVx * 0.025, -0.30, 0.30);
        if (this.player) this.player.rotation = this.playerTilt;
        if (this.gunSprite) this.gunSprite.rotation = this.playerTilt * 0.5;

        // Свечение
        if (this.playerGlow) {
            if (this.playerHitTimer > 0) {
                this.playerHitTimer -= k;
                this.playerGlow.tint = 0xff4040;
                this.playerGlow.alpha = 0.9;
                if (this.player) this.player.tint = 0xff9090;
            } else {
                if (this.player) this.player.tint = 0xffffff;
                if (this.lives <= 1) {
                    this.playerGlow.tint = 0xfb7e87;
                    this.playerGlow.alpha = 0.55 + Math.sin(this.frame * 0.15) * 0.25;
                } else {
                    this.playerGlow.tint = 0x64c8bd;
                    this.playerGlow.alpha = 0.5;
                }
            }
        }
    };

    // ============================================================
    // === ОРУЖИЕ =================================================
    // ============================================================

    PixiGame.prototype._updateWeapon = function (k) {
        if (this.weaponActive) {
            this.weaponTimer -= k;

            if (this.weaponTimer <= 0) {
                this.weaponActive = false;
                this.weaponTimer = 0;
                if (this.gunSprite) this.gunSprite.visible = false;
                if (this.hud.weaponContainer) this.hud.weaponContainer.visible = false;
            } else {
                if (this.gunSprite) this.gunSprite.visible = true;
                if (this.hud.weaponContainer) {
                    this.hud.weaponContainer.visible = true;
                    if (this.hud.weaponTimerText) {
                        this.hud.weaponTimerText.text = (this.weaponTimer / 60).toFixed(1) + 's';
                    }
                    this._redrawWeaponBar(this.weaponTimer / this.weaponMaxTimer);
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
        if (!tex || !this.playerContainer) return;

        var bullet = new PIXI.Sprite(tex);
        bullet.anchor.set(0.5);
        bullet.width = CFG.BULLET_SIZE * 6;
        bullet.height = CFG.BULLET_SIZE * 6;
        bullet.x = this.playerContainer.x;
        bullet.y = this.playerContainer.y - CFG.PLAYER_SIZE * 0.3;

        this.app.stage.addChild(bullet);

        this.bullets.push({
            sprite: bullet,
            vx: 0,
            vy: -CFG.BULLET_SPEED,
            life: 1,
        });

        this._spawnParticles(bullet.x, bullet.y, 0xffd280, 4, {
            speedMin: 1, speedMax: 3,
            lifeMin: 0.3, lifeMax: 0.6,
            sizeMin: 1, sizeMax: 2.5,
        });

        if (SmsikGame.Audio) SmsikGame.Audio.playShoot();
    };

    // ============================================================
    // === СПАВН ПРЕДМЕТОВ ========================================
    // ============================================================

    PixiGame.prototype._updateItems = function (k) {
        // Спавн врагов/бонусов
        this._itemTimer -= k;
        if (this._itemTimer <= 0) {
            this._spawnItem();
            var interval = CFG.SPAWN_RATE_BASE - this.level * 2;
            if (interval < 20) interval = 20;
            this._itemTimer = interval + rand(-8, 8);
        }

        // Спавн звёзд-пауэрапов
        this._powerupTimer -= k;
        if (this._powerupTimer <= 0) {
            this._spawnPowerup();
            this._powerupTimer = rand(30 * 60, 60 * 60);
        }

        // Спавн сердечек
        if (this.lives < CFG.MAX_LIVES) {
            this._heartTimer -= k;
            if (this._heartTimer <= 0) {
                this._spawnHeart();
                this._heartTimer = rand(CFG.HEART_INTERVAL_MIN, CFG.HEART_INTERVAL_MAX);
            }
        }

        // Обновление предметов
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
            if (this.playerContainer && !it.hit) {
                var dx = it.sprite.x - this.playerContainer.x;
                var dy = it.sprite.y - this.playerContainer.y;
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
            if (this.level < CFG.LEVEL_GLITCH) {
                type = 'monster'; spriteKey = 'antisms';
            } else if (this.level < CFG.LEVEL_DEMON) {
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
            canShoot: (type === 'nlo' || type === 'demon'),
            shootTimer: rand(CFG.ENEMY_SHOOT_MIN_INTERVAL, CFG.ENEMY_SHOOT_MAX_INTERVAL),
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
            canShoot: false,
        });
    };

    PixiGame.prototype._spawnHeart = function () {
        var tex = this.textures.heart;
        if (!tex) { console.warn('[PixiGame] Нет текстуры heart'); return; }

        var sprite = new PIXI.Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.width = CFG.HEART_SIZE * 2.2;
        sprite.height = CFG.HEART_SIZE * 2.2;
        sprite.x = rand(60, this.W - 60);
        sprite.y = -50;

        this.app.stage.addChild(sprite);

        this.items.push({
            sprite: sprite,
            type: 'heart',
            damage: 0,
            radius: CFG.HEART_RADIUS,
            points: 0,
            vx: rand(-0.2, 0.2),
            vy: rand(CFG.HEART_FALL_SPEED_MIN, CFG.HEART_FALL_SPEED_MAX),
            rotSpeed: rand(-0.02, 0.02),
            hit: false,
            canShoot: false,
        });
    };

    // ============================================================
    // === НАШИ ПУЛИ ==============================================
    // ============================================================

    PixiGame.prototype._updateBullets = function (k) {
        for (var i = this.bullets.length - 1; i >= 0; i--) {
            var b = this.bullets[i];
            b.sprite.y += b.vy * k;
            b.life -= 0.01 * k;

            var hitItem = null;
            for (var j = 0; j < this.items.length; j++) {
                var it = this.items[j];
                if (it.type === 'bonus' || it.type === 'powerup' || it.type === 'heart') continue;
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
    // === ВРАЖЕСКИЕ ПУЛИ =========================================
    // ============================================================

    PixiGame.prototype._updateEnemyBullets = function (k) {
        // Стрельба врагов
        for (var i = 0; i < this.items.length; i++) {
            var it = this.items[i];
            if (!it.canShoot || it.hit) continue;
            if (it.sprite.y < CFG.ENEMY_SHOOT_MIN_Y) continue;

            it.shootTimer -= k;
            if (it.shootTimer <= 0) {
                this._fireEnemyBullet(it);
                it.shootTimer = rand(CFG.ENEMY_SHOOT_MIN_INTERVAL, CFG.ENEMY_SHOOT_MAX_INTERVAL);
            }
        }

        // Движение вражеских пуль
        for (var j = this.enemyBullets.length - 1; j >= 0; j--) {
            var eb = this.enemyBullets[j];
            eb.sprite.y += eb.vy * k;
            eb.sprite.x += eb.vx * k;
            eb.life -= 1 * k;

            // Попадание в игрока
            if (this.playerContainer) {
                var dx = eb.sprite.x - this.playerContainer.x;
                var dy = eb.sprite.y - this.playerContainer.y;
                var hitDist = eb.radius + CFG.PLAYER_SIZE / 2 - 8;
                if (dx * dx + dy * dy < hitDist * hitDist) {
                    this._onPlayerHitByBullet(eb);
                    this.app.stage.removeChild(eb.sprite);
                    eb.sprite.destroy();
                    if (eb.glow && eb.glow.parent) eb.glow.parent.removeChild(eb.glow);
                    if (eb.glow) eb.glow.destroy();
                    this.enemyBullets.splice(j, 1);
                    continue;
                }
            }

            if (eb.sprite.y > this.H + 30 || eb.life <= 0 ||
                eb.sprite.x < -30 || eb.sprite.x > this.W + 30) {
                this.app.stage.removeChild(eb.sprite);
                eb.sprite.destroy();
                if (eb.glow && eb.glow.parent) eb.glow.parent.removeChild(eb.glow);
                if (eb.glow) eb.glow.destroy();
                this.enemyBullets.splice(j, 1);
            }
        }
    };

    PixiGame.prototype._fireEnemyBullet = function (it) {
        var bullet = new PIXI.Graphics();
        bullet.beginFill(0xff4040, 1);
        bullet.drawCircle(0, 0, CFG.ENEMY_BULLET_SIZE);
        bullet.endFill();
        bullet.beginFill(0xfff0f0, 1);
        bullet.drawCircle(0, 0, CFG.ENEMY_BULLET_SIZE * 0.4);
        bullet.endFill();

        bullet.x = it.sprite.x;
        bullet.y = it.sprite.y + it.radius * 0.7;

        var glow = new PIXI.Graphics();
        glow.beginFill(0xff4040, 0.3);
        glow.drawCircle(0, 0, CFG.ENEMY_BULLET_SIZE * 2);
        glow.endFill();
        glow.x = bullet.x;
        glow.y = bullet.y;

        this.app.stage.addChild(glow);
        this.app.stage.addChild(bullet);

        this.enemyBullets.push({
            sprite: bullet,
            glow: glow,
            vx: 0,
            vy: CFG.ENEMY_BULLET_SPEED,
            radius: CFG.ENEMY_BULLET_SIZE + 2,
            life: CFG.ENEMY_BULLET_LIFE,
        });

        this._spawnParticles(bullet.x, bullet.y, 0xff4040, 5, {
            speedMin: 1, speedMax: 3,
            lifeMin: 0.3, lifeMax: 0.6,
            sizeMin: 1, sizeMax: 2.5,
        });

        if (SmsikGame.Audio) SmsikGame.Audio.playEnemyShoot();
    };

    PixiGame.prototype._syncAllEnemyGlows = function () {
        for (var i = 0; i < this.enemyBullets.length; i++) {
            var eb = this.enemyBullets[i];
            if (eb.glow) {
                eb.glow.x = eb.sprite.x;
                eb.glow.y = eb.sprite.y;
            }
        }
    };

    PixiGame.prototype._onPlayerHitByBullet = function (eb) {
        this.lives -= CFG.ENEMY_BULLET_DAMAGE;
        if (this.lives < 0) this.lives = 0;
        this._updateLives();

        this.playerHitTimer = 15;

        this._spawnParticles(eb.sprite.x, eb.sprite.y, 0xff4040, 12, {
            speedMin: 3, speedMax: 7,
            lifeMin: 0.6, lifeMax: 1.0,
            sizeMin: 2, sizeMax: 4,
        });

        this._flash(0xff4040, 150);

        if (SmsikGame.Audio) SmsikGame.Audio.playDamage();

        if (this.lives <= 0) this._gameOver();
    };

    // ============================================================
    // === ЧАСТИЦЫ ================================================
    // ============================================================

    PixiGame.prototype._spawnParticles = function (x, y, color, count, opts) {
        opts = opts || {};
        var speedMin = opts.speedMin || 2;
        var speedMax = opts.speedMax || 6;
        var lifeMin = opts.lifeMin || 0.8;
        var lifeMax = opts.lifeMax || 1.4;
        var sizeMin = opts.sizeMin || 2;
        var sizeMax = opts.sizeMax || 5;

        if (IS_MOBILE) count = Math.ceil(count * 0.6);

        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = rand(speedMin, speedMax);
            var size = rand(sizeMin, sizeMax);

            var p = new PIXI.Graphics();
            p.beginFill(color, 1);
            p.drawCircle(0, 0, size);
            p.endFill();
            p.x = x;
            p.y = y;
            p._vx = Math.cos(angle) * speed;
            p._vy = Math.sin(angle) * speed - 1;
            p._life = rand(lifeMin, lifeMax);
            p._maxLife = p._life;

            this.particleLayer.addChild(p);
            this.particles.push(p);
        }

        if (this.particles.length > CFG.MAX_PARTICLES) {
            var extra = this.particles.length - CFG.MAX_PARTICLES;
            for (var j = 0; j < extra; j++) {
                var old = this.particles.shift();
                if (old && old.parent) old.parent.removeChild(old);
                if (old) old.destroy();
            }
        }
    };

    PixiGame.prototype._updateParticles = function (k) {
        for (var i = this.particles.length - 1; i >= 0; i--) {
            var p = this.particles[i];
            p.x += p._vx * k;
            p.y += p._vy * k;
            p._vy += CFG.PARTICLE_GRAVITY * k;
            p._vx *= 0.97;
            p._vy *= 0.97;
            p._life -= 0.02 * k;

            if (p._life <= 0) {
                if (p.parent) p.parent.removeChild(p);
                p.destroy();
                this.particles.splice(i, 1);
                continue;
            }

            var ratio = p._life / p._maxLife;
            p.alpha = ratio;
            p.scale.set(ratio);
        }
    };

    // ============================================================
    // === ВСПЛЫВАЮЩИЕ ТЕКСТЫ =====================================
    // ============================================================

    PixiGame.prototype._popText = function (x, y, text, color) {
        var t = new PIXI.Text(text, {
            fontFamily: 'Arial, sans-serif',
            fontSize: 22,
            fill: color,
            fontWeight: 'bold',
            stroke: 0x000000,
            strokeThickness: 4,
        });
        t.anchor.set(0.5);
        t.x = x;
        t.y = y;
        t._life = 1.2;
        t._maxLife = 1.2;
        t._vy = -1.5;
        this.app.stage.addChild(t);
        this.texts.push(t);
    };

    PixiGame.prototype._updateTexts = function (k) {
        for (var i = this.texts.length - 1; i >= 0; i--) {
            var t = this.texts[i];
            t.y += t._vy * k;
            t._vy *= 0.98;
            t._life -= 0.02 * k;
            if (t._life <= 0) {
                this.app.stage.removeChild(t);
                t.destroy();
                this.texts.splice(i, 1);
            } else {
                t.alpha = Math.min(1, t._life * 1.5);
            }
        }
    };

    // ============================================================
    // === ОБРАБОТКА СТОЛКНОВЕНИЙ =================================
    // ============================================================

    PixiGame.prototype._onItemHit = function (it) {
        if (it.type === 'bonus') {
            this.score += it.points;
            this._updateScore();
            this._checkLevelUp();
            this._popText(it.sprite.x, it.sprite.y, '+' + it.points, 0xffd280);

            this._spawnParticles(it.sprite.x, it.sprite.y, 0x64C8BD, 14, {
                speedMin: 3, speedMax: 7, lifeMin: 0.7, lifeMax: 1.2,
                sizeMin: 2, sizeMax: 4,
            });
            this._spawnParticles(it.sprite.x, it.sprite.y, 0xffd280, 8, {
                speedMin: 2, speedMax: 5, lifeMin: 0.6, lifeMax: 1.0,
                sizeMin: 1.5, sizeMax: 3,
            });
            if (SmsikGame.Audio) SmsikGame.Audio.playPickupBonus();
        } else if (it.type === 'powerup') {
            this.weaponActive = true;
            this.weaponTimer = CFG.WEAPON_DURATION;
            this.weaponMaxTimer = CFG.WEAPON_DURATION;
            this.fireCooldown = CFG.WEAPON_COOLDOWN;

            this._popText(it.sprite.x, it.sprite.y, '🔫 15с!', 0xffd280);

            this._spawnParticles(it.sprite.x, it.sprite.y, 0xffd280, 30, {
                speedMin: 4, speedMax: 10, lifeMin: 1.0, lifeMax: 1.8,
                sizeMin: 2, sizeMax: 5,
            });
            this._flash(0xffd280, 250);
            if (SmsikGame.Audio) SmsikGame.Audio.playPickupStar();
        } else if (it.type === 'heart') {
            this._onHeartPickup(it);
        } else {
            this._onEnemyDamage(it);
        }
    };

    PixiGame.prototype._onHeartPickup = function (it) {
        var wasFull = this.lives >= CFG.MAX_LIVES;

        if (!wasFull) {
            this.lives++;
            this._updateLives();
            this._popText(it.sprite.x, it.sprite.y, '+1 ❤️', 0xfb7e87);
        } else {
            this.score += 50;
            this._updateScore();
            this._popText(it.sprite.x, it.sprite.y, '+50', 0xffd280);
        }

        this._spawnParticles(it.sprite.x, it.sprite.y, 0xfb7e87, 20, {
            speedMin: 3, speedMax: 8, lifeMin: 0.8, lifeMax: 1.4,
            sizeMin: 2, sizeMax: 5,
        });
        this._spawnParticles(it.sprite.x, it.sprite.y, 0xffd0e0, 10, {
            speedMin: 2, speedMax: 5, lifeMin: 0.6, lifeMax: 1.0,
            sizeMin: 1.5, sizeMax: 3,
        });
        this._flash(0xfb7e87, 200);
        if (SmsikGame.Audio) SmsikGame.Audio.playPickupHeart();
    };

    PixiGame.prototype._onEnemyDamage = function (it) {
        this.lives -= it.damage;
        if (this.lives < 0) this.lives = 0;
        this._updateLives();

        this.playerHitTimer = 15;

        this._spawnParticles(it.sprite.x, it.sprite.y, 0xff4040, 18, {
            speedMin: 3, speedMax: 8, lifeMin: 0.7, lifeMax: 1.3,
            sizeMin: 2, sizeMax: 5,
        });

        if (it.damage >= 3) this._flash(0xff0000, 350);
        else if (it.damage === 2) this._flash(0xff4040, 250);
        else this._flash(0xff8080, 180);

        if (SmsikGame.Audio) SmsikGame.Audio.playDamage();

        if (this.lives <= 0) this._gameOver();
    };

    PixiGame.prototype._onEnemyKilled = function (it) {
        this.score += it.points;
        this._updateScore();
        this._checkLevelUp();
        this._popText(it.sprite.x, it.sprite.y, '+' + it.points, 0xffd280);

        var color;
        if (it.type === 'demon') color = 0xff4040;
        else if (it.type === 'nlo') color = 0x40e0d0;
        else color = 0xa060ff;

        this._spawnParticles(it.sprite.x, it.sprite.y, color, 20, {
            speedMin: 3, speedMax: 9, lifeMin: 0.8, lifeMax: 1.4,
            sizeMin: 2, sizeMax: 5,
        });
        this._spawnParticles(it.sprite.x, it.sprite.y, 0xffd280, 8, {
            speedMin: 2, speedMax: 5, lifeMin: 0.5, lifeMax: 0.9,
            sizeMin: 1.5, sizeMax: 3,
        });

        if (it.type === 'demon') this._flash(0xff4040, 200);
        if (SmsikGame.Audio) SmsikGame.Audio.playExplosion();
    };

    // ============================================================
    // === HUD ====================================================
    // ============================================================

    PixiGame.prototype._updateScore = function () {
        if (this.hud.score) this.hud.score.text = 'Очки: ' + this.score;
    };

    PixiGame.prototype._updateLives = function () {
        if (!this.hud.hearts) return;
        for (var i = 0; i < this.hud.hearts.length; i++) {
            this.hud.hearts[i].alpha = i < this.lives ? 1.0 : 0.2;
        }
    };

    PixiGame.prototype._checkLevelUp = function () {
        var newLevel = Math.floor(this.score / CFG.LEVEL_STEP) + 1;
        if (newLevel > this.level) {
            this.level = newLevel;
            this.speedMul *= CFG.LEVEL_SPEED_UP;
            if (this.hud.level) this.hud.level.text = 'Ур. ' + this.level;

            var cx = this.playerContainer ? this.playerContainer.x : this.W / 2;
            var cy = this.playerContainer ? this.playerContainer.y : this.H - 70;

            this._spawnParticles(cx, cy, 0xffd280, 40, {
                speedMin: 5, speedMax: 14, lifeMin: 1.2, lifeMax: 2.0,
                sizeMin: 2, sizeMax: 5,
            });
            this._flash(0xffd280, 400);
            if (SmsikGame.Audio) SmsikGame.Audio.playLevelUp();
            console.log('[PixiGame] Уровень', this.level);
        }
    };

    // ============================================================
    // === GAME OVER ==============================================
    // ============================================================

    PixiGame.prototype._gameOver = function () {
        this.running = false;
        console.log('[PixiGame] Игра окончена. Счёт:', this.score);

        var cx = this.playerContainer ? this.playerContainer.x : this.W / 2;
        var cy = this.playerContainer ? this.playerContainer.y : this.H - 70;

        this._spawnParticles(cx, cy, 0xff4040, 40, {
            speedMin: 5, speedMax: 14, lifeMin: 1.5, lifeMax: 2.5,
            sizeMin: 3, sizeMax: 6,
        });
        this._flash(0xff0000, 500);

        if (SmsikGame.Audio) SmsikGame.Audio.playGameOver();

        if (this.hud.score) {
            this.hud.score.text = '🏆 ' + this.score + ' очков!';
            this.hud.score.style.fontSize = 36;
        }

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

        // Удаляем наши пули
        for (var j = 0; j < this.bullets.length; j++) {
            this.app.stage.removeChild(this.bullets[j].sprite);
            this.bullets[j].sprite.destroy();
        }
        this.bullets = [];

        // Удаляем вражеские пули
        for (var e = 0; e < this.enemyBullets.length; e++) {
            if (this.enemyBullets[e].sprite.parent) {
                this.enemyBullets[e].sprite.parent.removeChild(this.enemyBullets[e].sprite);
            }
            this.enemyBullets[e].sprite.destroy();
            if (this.enemyBullets[e].glow && this.enemyBullets[e].glow.parent) {
                this.enemyBullets[e].glow.parent.removeChild(this.enemyBullets[e].glow);
            }
            if (this.enemyBullets[e].glow) this.enemyBullets[e].glow.destroy();
        }
        this.enemyBullets = [];

        // Удаляем частицы
        for (var p = 0; p < this.particles.length; p++) {
            if (this.particles[p].parent) {
                this.particles[p].parent.removeChild(this.particles[p]);
            }
            this.particles[p].destroy();
        }
        this.particles = [];

        // Удаляем тексты
        for (var t = 0; t < this.texts.length; t++) {
            if (this.texts[t].parent) {
                this.texts[t].parent.removeChild(this.texts[t]);
            }
            this.texts[t].destroy();
        }
        this.texts = [];

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
        this._heartTimer = rand(CFG.HEART_INTERVAL_MIN, CFG.HEART_INTERVAL_MAX);

        if (this.playerContainer) {
            this.playerContainer.x = this.W / 2;
            this.playerContainer.y = this.H - 70;
        }
        this.playerVx = 0;
        this.playerTilt = 0;

        if (this.gunSprite) this.gunSprite.visible = false;
        if (this.hud.weaponContainer) this.hud.weaponContainer.visible = false;
        if (this.hud.score) this.hud.score.style.fontSize = 20;
        if (this.flashOverlay) this.flashOverlay.alpha = 0;

        this.playerHitTimer = 0;
        if (this.player) this.player.tint = 0xffffff;
        if (this.playerGlow) {
            this.playerGlow.tint = 0x64c8bd;
            this.playerGlow.alpha = 0.5;
        }

        this._updateScore();
        this._updateLives();
        if (this.hud.level) this.hud.level.text = 'Ур. 1';

        this.running = true;
    };

    // Экспорт класса в SmsikGame
    SmsikGame.PixiGame = PixiGame;

    console.log('[Core] Часть 3/3 загружена. spark-core.js собран полностью (v0.6.0)');

})();