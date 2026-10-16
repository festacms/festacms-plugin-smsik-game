/**
 * FestaCMS — Игра «Смсик: Космическая доставка» (страница 404)
 * 
 * Версия 1.5:
 *   - спрайты SVG для персонажей и элементов (без эмодзи)
 *   - fix: ограничение буфера canvas для 4K-мониторов
 *   - fix: стрельба после подбора звезды
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
    // === КОНСТАНТЫ ==============================================
    // ============================================================

    var CFG = {
        PLAYER_SIZE:      44,
        PLAYER_ACC:       1.15,
        PLAYER_MAX_V:     14,
        PLAYER_FRICTION:  0.90,
        MOUSE_LERP:       0.22,
        MOUSE_DEADZONE:   1.5,

        MAX_DPR:          IS_MOBILE ? 1 : 2,
        STAR_COUNT_MUL:   IS_MOBILE ? 0.35 : 1.0,
        NEBULA_COUNT:     IS_MOBILE ? 2 : 6,
        PLANET_COUNT:     IS_MOBILE ? 1 : 3,
        MAX_PARTICLES:    IS_MOBILE ? 100 : 400,
        USE_SHADOW:       !IS_MOBILE,
        USE_STAR_TWINKLE: !IS_MOBILE,
        USE_COMETS:       !IS_MOBILE,
        USE_FAR_ROCKS:    !IS_MOBILE,
        USE_METEORS:      !IS_MOBILE,

        MAX_LIVES:        5,
        POINTS_BONUS:     10,

        SPAWN_RATE_BASE:  40,
        SPAWN_LEVEL_STEP: 0.08,
        ITEM_FALL_MIN:    1.6,
        ITEM_FALL_MAX:    2.8,

        BONUS_CHANCE:     0.45,

        COMBO_STEP:       3,
        COMBO_MAX:        4,

        LEVEL_STEP:       200,
        LEVEL_SPEED_UP:   1.15,

        WEAPON_DURATION:  8 * 60,
        WEAPON_COOLDOWN:  9,
        BULLET_SPEED:     14,
        BULLET_SIZE:      4,
        BULLET_LIFE:      120,

        POWERUP_INTERVAL_MIN: 15 * 60,
        POWERUP_INTERVAL_MAX: 25 * 60,

        HEART_INTERVAL_BY_LIVES: {
            1: [20 * 60, 35 * 60],
            2: [40 * 60, 60 * 60],
            3: [60 * 60, 90 * 60],
            4: [120 * 60, 180 * 60],
        },

        DEATH_SAVE_THRESHOLD: 1000,
        DEATH_SAVE_DURATION:  180,

        POINTS_ENEMY:     5,
        POINTS_NLO:       15,
        POINTS_DEMON:     50,
        POINTS_ASTEROID:  10,
        POINTS_FIREBALL:  15,

        SHOP_PRICE_LIFE:   200,
        SHOP_PRICE_WEAPON: 100,

        SWIPE_SENSITIVITY: 1.8,
        TILT_DEADZONE:     1,
        TILT_MAX_ANGLE:    10,
        TILT_SMOOTH:       0.35,

        API_URL:          '/api/404_score.php',
        LS_NAME_KEY:      'starfall_player_name',
        LS_BUFFS_KEY:     'starfall_pending_buffs',
        LS_CONTROL_KEY:   'starfall_control_mode',
        LS_VIBRO_KEY:     'starfall_vibro_enabled',
    };

    var BONUS_EMOJIS  = ['🎁', '🎉', '🎈', '🎂', '🎊', '🥳', '💝'];
    var POWERUP_EMOJI = '⭐';
    var HEART_EMOJI   = '💖';

    var ENEMY_MONSTER = { type: 'monster', emoji: '👾', damage: 1, size: 38, radius: 22, speedMul: 1.0, color: '#A060FF', glow: 'rgba(160, 96, 255, 0.8)', shake: 1 };
    var ENEMY_NLO     = { type: 'nlo',     emoji: '🛸', damage: 2, size: 42, radius: 24, speedMul: 1.2, color: '#40E0D0', glow: 'rgba(64, 224, 208, 0.8)',  shake: 1.5 };
    var ENEMY_DEMON   = { type: 'demon',   emoji: '😈', damage: 3, size: 46, radius: 26, speedMul: 1.4, color: '#FF4040', glow: 'rgba(255, 64, 64, 0.9)',   shake: 2.2 };

    var PLANET_PALETTES = [
        { type: 'gas',     body: ['#3a3f80', '#5e63b0', '#8d92d8', '#b0b3e8'], glow: 'rgba(120, 130, 220, 0.35)', ring: 'rgba(200, 200, 240, 0.55)' },
        { type: 'ice',     body: ['#0e5a5e', '#218278', '#64C8BD', '#a5e3dd'], glow: 'rgba(100, 200, 189, 0.35)', ring: 'rgba(160, 230, 220, 0.5)' },
        { type: 'desert',  body: ['#8B6508', '#DAA520', '#F0C674', '#FBE5B8'], glow: 'rgba(230, 190, 90, 0.3)',  ring: null },
        { type: 'lava',    body: ['#4a0f14', '#8B1A1A', '#CD5C5C', '#F08080'], glow: 'rgba(220, 90, 90, 0.3)',   ring: null },
        { type: 'distant', body: ['#1a3a5c', '#4169E1', '#87CEEB', '#E8F4FF'], glow: 'rgba(140, 180, 240, 0.4)', ring: null },
    ];

    function rand(min, max) { return min + Math.random() * (max - min); }
    function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // ============================================================
    // === КЭШ ПЛАНЕТЫ ============================================
    // ============================================================

    function cachePlanet(planet, DPR) {
        var r = planet.r;
        var size = r * 4;
        var canvas = document.createElement('canvas');
        canvas.width  = Math.ceil(size * DPR);
        canvas.height = Math.ceil(size * DPR);
        var c = canvas.getContext('2d');
        c.scale(DPR, DPR);
        c.translate(size / 2, size / 2);

        var glow = c.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.7);
        glow.addColorStop(0, planet.palette.glow);
        glow.addColorStop(0.5, planet.palette.glow.replace(/[\d.]+\)$/, '0.1)'));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        c.beginPath(); c.fillStyle = glow;
        c.arc(0, 0, r * 1.7, 0, Math.PI * 2); c.fill();

        if (planet.hasRing && planet.palette.ring) {
            c.save();
            c.rotate(planet.ringTilt); c.scale(1, 0.25);
            c.beginPath(); c.strokeStyle = planet.palette.ring; c.lineWidth = 6;
            c.arc(0, 0, r * 1.55, Math.PI, Math.PI * 2);
            c.stroke(); c.restore();
        }

        var bg = c.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.1, 0, 0, r);
        bg.addColorStop(0, planet.palette.body[3]);
        bg.addColorStop(0.4, planet.palette.body[2]);
        bg.addColorStop(0.75, planet.palette.body[1]);
        bg.addColorStop(1, planet.palette.body[0]);
        c.beginPath(); c.fillStyle = bg;
        c.arc(0, 0, r, 0, Math.PI * 2); c.fill();

        c.save();
        c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.clip();

        if (planet.palette.type === 'gas') {
            for (var b = 0; b < 6; b++) {
                var by = -r + (b * r * 2 / 6);
                var bh = r * 2 / 6;
                var a = 0.08 + Math.sin(b * planet.seed) * 0.06;
                c.fillStyle = 'rgba(255,255,255,' + Math.max(0, a) + ')';
                c.fillRect(-r, by, r * 2, bh * 0.6);
                c.fillStyle = 'rgba(0,0,0,' + Math.max(0, a * 0.8) + ')';
                c.fillRect(-r, by + bh * 0.6, r * 2, bh * 0.4);
            }
            if (planet.seed > 50) {
                c.beginPath();
                c.fillStyle = 'rgba(200, 100, 100, 0.4)';
                c.ellipse(r * 0.3, r * 0.1, r * 0.25, r * 0.15, 0, 0, Math.PI * 2);
                c.fill();
            }
        } else if (planet.palette.type === 'ice') {
            c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1;
            for (var t = 0; t < 5; t++) {
                c.beginPath();
                var x1 = -r + Math.random() * r * 2;
                var y1 = -r + Math.random() * r * 2;
                c.moveTo(x1, y1);
                c.lineTo(x1 + rand(-r * 0.3, r * 0.3), y1 + rand(-r * 0.3, r * 0.3));
                c.stroke();
            }
        } else if (planet.palette.type === 'lava') {
            for (var l = 0; l < 6; l++) {
                c.beginPath();
                c.fillStyle = 'rgba(255,200,100,' + rand(0.15, 0.35) + ')';
                c.arc(rand(-r * 0.7, r * 0.7), rand(-r * 0.7, r * 0.7), rand(2, 6), 0, Math.PI * 2);
                c.fill();
            }
        }

        var sg = c.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.3, 0, 0, r);
        sg.addColorStop(0, 'rgba(0,0,0,0)');
        sg.addColorStop(0.7, 'rgba(0,0,0,0.15)');
        sg.addColorStop(1, 'rgba(0,0,0,0.65)');
        c.fillStyle = sg;
        c.fillRect(-r, -r, r * 2, r * 2);
        c.restore();

        if (planet.hasRing && planet.palette.ring) {
            c.save();
            c.rotate(planet.ringTilt); c.scale(1, 0.25);
            c.beginPath(); c.strokeStyle = planet.palette.ring; c.lineWidth = 6;
            c.arc(0, 0, r * 1.55, 0, Math.PI);
            c.stroke(); c.restore();
        }

        c.beginPath();
        c.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        c.lineWidth = 1;
        c.arc(0, 0, r, 0, Math.PI * 2);
        c.stroke();

        planet.cache = canvas;
        planet.cacheSize = size;
    }

    // ============================================================
    // === КЛАСС ИГРЫ =============================================
    // ============================================================

    function Game(stageEl) {
        this.stage  = stageEl;
        this.canvas = stageEl.querySelector('canvas') || stageEl.appendChild(document.createElement('canvas'));
        this.ctx    = this.canvas.getContext('2d', { alpha: false });

        this.W = 0; this.H = 0; this.DPR = 1;
        this.running = false; this.animId = null; this.lastTs = 0; this.frame = 0;

        this.stars = []; this.nebulas = []; this.planets = []; this.farRocks = [];
        this.comets = []; this.meteors = [];
        this.items = []; this.bullets = []; this.particles = []; this.announcements = [];

        this.player = null;

        this.lives = CFG.MAX_LIVES; this.score = 0; this.level = 1;
        this.speedMul = 1; this.comboCount = 0; this.multiplier = 1;

        this.buffExtraLives = 0;
        this.buffWeapon = false;

        this.weaponActive = false; this.weaponTimer = 0; this.fireCooldown = 0; this.fireHeld = false;

        this.pointer = { x: 0, active: false };
        this.keys = { left: false, right: false };

        this.touch = {
            active: false,
            lastX: 0,
            pointerId: null,
        };
        this.tilt = 0;
        this.tiltEnabled = false;
        this.vibroEnabled = true;

        this._cometTimer = 0; this._meteorTimer = 0; this._itemTimer = 0;
        this._powerupTimer = 0; this._heartTimer = 0;
        this._gameStartTime = 0;

        this._deathSave = null;

        this._fps = 0; this._fpsAcc = 0; this._fpsFrames = 0;

        this.hud = { lives: null, score: null, flash: null, level: null, combo: null, weapon: null, weaponTimer: null };

        this._onGameOverCallback = null;
        this._controlMode = 'swipe';

        this._boundResize     = this._onResize.bind(this);
        this._boundKeyDown    = this._onKeyDown.bind(this);
        this._boundKeyUp      = this._onKeyUp.bind(this);
        this._boundMouse      = this._onMouseMove.bind(this);
        this._boundMouseDown  = this._onMouseDown.bind(this);
        this._boundMouseUp    = this._onMouseUp.bind(this);
        this._boundTouchStart = this._onTouchStart.bind(this);
        this._boundTouchMove  = this._onTouchMove.bind(this);
        this._boundTouchEnd   = this._onTouchEnd.bind(this);
        this._boundTilt       = this._onTilt.bind(this);
        this._boundLoop       = this._loop.bind(this);

        this._attachEvents();
        this._initHud();
        this._initScene();
    }

    Game.prototype._initHud = function () {
        this.hud.lives       = this.stage.querySelector('#starfallLives');
        this.hud.score       = this.stage.querySelector('#starfallScore');
        this.hud.flash       = this.stage.querySelector('.starfall-flash');
        this.hud.level       = this.stage.querySelector('#starfallLevel');
        this.hud.combo       = this.stage.querySelector('#starfallCombo');
        this.hud.weapon      = this.stage.querySelector('#starfallWeapon');
        this.hud.weaponTimer = this.stage.querySelector('#starfallWeaponTimer');
    };

    Game.prototype._updateHudLives = function () {
        if (!this.hud.lives) return;
        var totalLives = CFG.MAX_LIVES + this.buffExtraLives;
        var full  = '❤️'.repeat(Math.max(0, this.lives));
        var empty = '🖤'.repeat(Math.max(0, totalLives - this.lives));
        this.hud.lives.textContent = full + empty;
        this.hud.lives.classList.add('is-hit');
        var self = this;
        setTimeout(function () { self.hud.lives.classList.remove('is-hit'); }, 400);
    };

    Game.prototype._updateHudScore = function () {
        if (this.hud.score) this.hud.score.textContent = this.score;
    };

    Game.prototype._updateHudLevel = function () {
        if (this.hud.level) this.hud.level.textContent = 'Ур. ' + this.level;
    };

    Game.prototype._updateHudCombo = function () {
        if (!this.hud.combo) return;
        if (this.multiplier > 1) {
            this.hud.combo.textContent = '🔥 Комбо ×' + this.multiplier;
            this.hud.combo.classList.add('is-visible');
        } else {
            this.hud.combo.classList.remove('is-visible');
        }
    };

    Game.prototype._updateHudWeapon = function () {
        if (!this.hud.weapon) return;
        if (this.weaponActive) {
            this.hud.weapon.classList.add('is-active');
            if (this.hud.weaponTimer) this.hud.weaponTimer.textContent = (this.weaponTimer / 60).toFixed(1);
        } else {
            this.hud.weapon.classList.remove('is-active');
        }
    };

    Game.prototype._shakeStage = function (intensity) {
        intensity = intensity || 1;
        var s = this.stage;
        s.style.setProperty('--shake-intensity', intensity);
        s.classList.add('is-shaking');
        setTimeout(function () {
            s.classList.remove('is-shaking');
            s.style.removeProperty('--shake-intensity');
        }, 250);
    };

    Game.prototype._flash = function (type) {
        if (!this.hud.flash) return;
        var el = this.hud.flash;
        el.classList.remove('is-red', 'is-gold', 'is-weapon', 'is-dark');
        void el.offsetWidth;
        el.classList.add('is-' + type);
        var dur = type === 'dark' ? 150 : 180;
        setTimeout(function () { el.classList.remove('is-red', 'is-gold', 'is-weapon', 'is-dark'); }, dur);
    };

    Game.prototype._vibrate = function (pattern) {
        if (!this.vibroEnabled) return;
        if (!('vibrate' in navigator)) return;
        try { navigator.vibrate(pattern); } catch (e) {}
    };

    Game.prototype._initScene = function () {
        this.resize();
        this._createPlayer();
        this._createBackground();
    };

    Game.prototype._createPlayer = function () {
        this.player = { x: this.W / 2, y: this.H - 70, baseY: this.H - 70, vx: 0, tilt: 0, trail: [] };
    };

    Game.prototype._createBackground = function () {
        var W = this.W, H = this.H;
        var starMul = CFG.STAR_COUNT_MUL;

        this.stars = [];
        var layers = [
            { count: Math.floor(W * H / 20000 * starMul), speed: 0.10, minR: 0.2, maxR: 0.5, alpha: [0.15, 0.35], color: '210, 220, 255' },
            { count: Math.floor(W * H / 18000 * starMul), speed: 0.25, minR: 0.4, maxR: 0.9, alpha: [0.35, 0.7],  color: '255, 255, 255' },
            { count: Math.floor(W * H / 28000 * starMul), speed: 0.5,  minR: 0.6, maxR: 1.2, alpha: [0.5, 0.85],  color: '255, 255, 255' },
            { count: Math.floor(W * H / 45000 * starMul), speed: 1.0,  minR: 0.8, maxR: 1.8, alpha: [0.7, 1.0],   color: '255, 250, 235' },
        ];
        for (var l = 0; l < layers.length; l++) {
            var L = layers[l];
            for (var i = 0; i < L.count; i++) {
                this.stars.push({
                    x: Math.random() * W, y: Math.random() * H,
                    r: rand(L.minR, L.maxR), speed: L.speed,
                    alpha: rand(L.alpha[0], L.alpha[1]), color: L.color,
                    twinkle: Math.random() * Math.PI * 2,
                    twinkleSpeed: rand(0.02, 0.06),
                    bright: false,
                });
            }
        }
        if (!IS_MOBILE) {
            for (var b = 0; b < 4; b++) {
                this.stars.push({
                    x: Math.random() * W, y: Math.random() * H,
                    r: rand(1.5, 2.2), speed: 0.3, alpha: 1, color: '255, 255, 255',
                    twinkle: Math.random() * Math.PI * 2, twinkleSpeed: rand(0.03, 0.07), bright: true,
                });
            }
        }

        this.nebulas = [];
        var nebs = [
            { rgb: [60, 80, 180], alpha: 0.10 }, { rgb: [120, 60, 180], alpha: 0.08 },
            { rgb: [40, 130, 140], alpha: 0.08 }, { rgb: [150, 60, 100], alpha: 0.06 },
            { rgb: [180, 100, 60],  alpha: 0.05 },
        ];
        for (var n = 0; n < CFG.NEBULA_COUNT; n++) {
            var nc = pick(nebs);
            this.nebulas.push({
                x: rand(-W * 0.2, W * 1.2), y: rand(-H * 0.2, H * 1.2),
                r: rand(W * 0.18, W * 0.45), rgb: nc.rgb, alpha: nc.alpha,
                vx: rand(-0.03, 0.03), vy: rand(-0.015, 0.015),
            });
        }

        this.planets = [];
        for (var p = 0; p < CFG.PLANET_COUNT; p++) {
            var pal = pick(PLANET_PALETTES);
            var rad = pal.type === 'distant' ? rand(20, 32) : rand(55, 110);
            var planet = {
                x: rand(-rad, W + rad), y: rand(H * 0.1, H * 0.65),
                r: rad, palette: pal, vx: rand(-0.12, 0.12), vy: rand(0.02, 0.05),
                rot: rand(0, Math.PI * 2), rotSpeed: rand(-0.0008, 0.0008),
                hasRing: !!pal.ring && Math.random() > 0.45, ringTilt: rand(-0.5, 0.5),
                seed: Math.random() * 100,
            };
            cachePlanet(planet, this.DPR);
            this.planets.push(planet);
        }

        this.farRocks = [];
        if (CFG.USE_FAR_ROCKS) {
            for (var r = 0; r < Math.floor(W / 100); r++) {
                this.farRocks.push({
                    x: Math.random() * W, y: Math.random() * H,
                    r: rand(1.2, 3.5), speed: rand(0.3, 1.0), vx: rand(-0.15, 0.15),
                    rot: Math.random() * Math.PI * 2, rotSpeed: rand(-0.03, 0.03),
                    alpha: rand(0.12, 0.3),
                });
            }
        }

        this.comets = []; this._cometTimer = rand(60, 180);
        this.meteors = []; this._meteorTimer = rand(30, 90);
        this.items = []; this.bullets = []; this.particles = []; this.announcements = [];
        this._itemTimer = rand(20, 40);
        this._powerupTimer = rand(8 * 60, 12 * 60);
        this._heartTimer = rand(30 * 60, 60 * 60);
        this._deathSave = null;
    };

    Game.prototype._onResize = function () { this.resize(); };

    // ============================================================
    // === RESIZE — ограничение буфера для 4K =====================
    // ============================================================
    Game.prototype.resize = function () {
        var rect = this.stage.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        var MAX_CANVAS_W = 1920;
        var MAX_CANVAS_H = 1080;

        var dpr = Math.min(window.devicePixelRatio || 1, CFG.MAX_DPR);

        dpr = Math.min(
            dpr,
            MAX_CANVAS_W / rect.width,
            MAX_CANVAS_H / rect.height
        );

        this.DPR = dpr;
        this.W = rect.width;
        this.H = rect.height;

        this.canvas.width  = Math.floor(this.W * this.DPR);
        this.canvas.height = Math.floor(this.H * this.DPR);
        this.canvas.style.width  = this.W + 'px';
        this.canvas.style.height = this.H + 'px';
        this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

        if (this.player) {
            this.player.y = this.H - 70; this.player.baseY = this.H - 70;
            this.player.x = clamp(this.player.x, 40, this.W - 40);
        }

        if (this.stars.length === 0 || Math.abs(this._lastW - this.W) > 100 || Math.abs(this._lastH - this.H) > 100) {
            this._createBackground(); this._lastW = this.W; this._lastH = this.H;
        }
    };

    Game.prototype._attachEvents = function () {
        window.addEventListener('resize', this._boundResize);
        document.addEventListener('keydown', this._boundKeyDown);
        document.addEventListener('keyup', this._boundKeyUp);
        this.stage.addEventListener('mousemove', this._boundMouse);
        this.stage.addEventListener('mousedown', this._boundMouseDown);
        document.addEventListener('mouseup', this._boundMouseUp);

        if (IS_MOBILE) {
            this.stage.addEventListener('touchstart',  this._boundTouchStart, { passive: false });
            this.stage.addEventListener('touchmove',   this._boundTouchMove,  { passive: false });
            this.stage.addEventListener('touchend',    this._boundTouchEnd,    { passive: false });
            this.stage.addEventListener('touchcancel', this._boundTouchEnd,    { passive: false });
        }
    };

    Game.prototype.destroy = function () {
        window.removeEventListener('resize', this._boundResize);
        document.removeEventListener('keydown', this._boundKeyDown);
        document.removeEventListener('keyup', this._boundKeyUp);
        this.stage.removeEventListener('mousemove', this._boundMouse);
        this.stage.removeEventListener('mousedown', this._boundMouseDown);
        document.removeEventListener('mouseup', this._boundMouseUp);
        this.stage.removeEventListener('touchstart', this._boundTouchStart);
        this.stage.removeEventListener('touchmove', this._boundTouchMove);
        this.stage.removeEventListener('touchend', this._boundTouchEnd);
        this.stage.removeEventListener('touchcancel', this._boundTouchEnd);
        window.removeEventListener('deviceorientation', this._boundTilt);
        this.stop();
    };

    Game.prototype.setControlMode = function (mode) {
        this._controlMode = mode;

        if (mode !== 'tilt') {
            window.removeEventListener('deviceorientation', this._boundTilt);
            this.tiltEnabled = false;
            this.tilt = 0;
        } else {
            this._enableTilt();
        }
    };

    Game.prototype._enableTilt = function () {
        var self = this;

        if (typeof DeviceOrientationEvent === 'undefined') {
            this._controlMode = 'swipe';
            try { localStorage.setItem(CFG.LS_CONTROL_KEY, 'swipe'); } catch (e) {}
            return;
        }

        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(function (state) {
                    if (state === 'granted') {
                        window.addEventListener('deviceorientation', self._boundTilt);
                        self.tiltEnabled = true;
                    } else {
                        self._controlMode = 'swipe';
                        try { localStorage.setItem(CFG.LS_CONTROL_KEY, 'swipe'); } catch (e) {}
                    }
                })
                .catch(function () {
                    self._controlMode = 'swipe';
                    try { localStorage.setItem(CFG.LS_CONTROL_KEY, 'swipe'); } catch (e) {}
                });
        } else {
            window.addEventListener('deviceorientation', this._boundTilt);
            this.tiltEnabled = true;
        }
    };

    Game.prototype._onTilt = function (e) {
        if (!this.running) return;
        var g = e.gamma || 0;
        this.tilt = clamp(g, -CFG.TILT_MAX_ANGLE * 1.5, CFG.TILT_MAX_ANGLE * 1.5);
    };

    Game.prototype._onMouseMove = function (e) {
        if (!this.running) return;
        var rect = this.stage.getBoundingClientRect();
        this.pointer.x = e.clientX - rect.left;
        this.pointer.active = true;
    };
    Game.prototype._onMouseDown = function () { if (this.running) this.fireHeld = true; };
    Game.prototype._onMouseUp   = function () { this.fireHeld = false; };

    Game.prototype._onTouchStart = function (e) {
        if (!this.running) return;
        if (e.target.closest('button')) return;

        var t = e.touches[0];
        if (!t) return;

        this.touch.active = true;
        this.touch.lastX = t.clientX;
        this.touch.pointerId = t.identifier;

        if (this.vibroEnabled && 'vibrate' in navigator) {
            try { navigator.vibrate(1); } catch (err) {}
        }

        e.preventDefault();
    };

    Game.prototype._onTouchMove = function (e) {
        if (!this.running || !this.touch.active) return;
        if (this._controlMode !== 'swipe') return;

        var t = null;
        for (var i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === this.touch.pointerId) {
                t = e.touches[i];
                break;
            }
        }
        if (!t) return;

        var deltaX = t.clientX - this.touch.lastX;
        this.touch.lastX = t.clientX;

        if (this.player) {
            var margin = CFG.PLAYER_SIZE / 2 + 4;
            this.player.x = clamp(
                this.player.x + deltaX * CFG.SWIPE_SENSITIVITY,
                margin,
                this.W - margin
            );
            this.player.vx = deltaX * CFG.SWIPE_SENSITIVITY;
        }

        e.preventDefault();
    };

    Game.prototype._onTouchEnd = function (e) {
        var found = false;
        for (var i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === this.touch.pointerId) {
                found = true;
                break;
            }
        }
        if (!found) {
            this.touch.active = false;
            this.touch.pointerId = null;
        }
    };

    Game.prototype._onKeyDown = function (e) {
        var h = false, k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'ф' || k === 'Ф') { this.keys.left = true; h = true; }
        if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'в' || k === 'В') { this.keys.right = true; h = true; }
        if (k === ' ' || k === 'Spacebar' || k === 'Space') { this.fireHeld = true; h = true; }
        if (h) { if (k !== ' ') this.pointer.active = false; if (this.running) e.preventDefault(); }
    };

    Game.prototype._onKeyUp = function (e) {
        var k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'ф' || k === 'Ф') this.keys.left = false;
        if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'в' || k === 'В') this.keys.right = false;
        if (k === ' ' || k === 'Spacebar' || k === 'Space') this.fireHeld = false;
    };

    Game.prototype.start = function () {
        if (this.running) return;

        this.running = true;
        this.lastTs = 0; this.frame = 0;
        this.pointer.active = false;
        this.keys.left = this.keys.right = false;
        this.fireHeld = false;
        this.touch.active = false;
        this.touch.pointerId = null;
        this.tilt = 0;

        this.lives = CFG.MAX_LIVES + this.buffExtraLives;
        this.score = 0; this.level = 1;
        this.speedMul = 1;
        this.comboCount = 0; this.multiplier = 1;
        this.fireCooldown = 0;

        if (this.buffWeapon) {
            this.weaponActive = true;
            this.weaponTimer = CFG.WEAPON_DURATION;
        } else {
            this.weaponActive = false;
            this.weaponTimer = 0;
        }

        this.items = []; this.bullets = []; this.particles = []; this.announcements = [];
        this._itemTimer = rand(20, 40);
        this._powerupTimer = rand(8 * 60, 12 * 60);
        this._heartTimer = rand(30 * 60, 60 * 60);
        this._deathSave = null;

        this._gameStartTime = Date.now();

        this._createPlayer();
        this._updateHudLives(); this._updateHudScore(); this._updateHudLevel();
        this._updateHudCombo(); this._updateHudWeapon();

        this.animId = requestAnimationFrame(this._boundLoop);

        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

        this.buffExtraLives = 0;
        this.buffWeapon = false;
    };

    Game.prototype.stop = function () {
        this.running = false;
        if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; }
    };

    Game.prototype.restart = function () {
        this.stop();
        this.start();
    };

    Game.prototype._loop = function (ts) {
        if (!this.running) return;
        if (!this.lastTs) this.lastTs = ts;
        var dt = Math.min(ts - this.lastTs, IS_MOBILE ? 32 : 24);
        this.lastTs = ts; this.frame++;

        this._fpsAcc += dt;
        this._fpsFrames++;
        if (this._fpsAcc >= 500) {
            this._fps = Math.round(1000 * this._fpsFrames / this._fpsAcc);
            this._fpsAcc = 0; this._fpsFrames = 0;
        }

        this._update(dt);
        this._draw();
        this._drawFps();

        this.animId = requestAnimationFrame(this._boundLoop);
    };

    Game.prototype._update = function (dt) {
        this._updateStars(dt); this._updateNebulas(dt); this._updatePlanets(dt);
        if (CFG.USE_FAR_ROCKS) this._updateFarRocks(dt);
        if (CFG.USE_COMETS) this._updateComets(dt);
        if (CFG.USE_METEORS) this._updateMeteors(dt);
        this._updateWeapon(dt); this._updateItems(dt); this._updateBullets(dt);
        this._updateParticles(dt); this._updateAnnouncements(dt); this._updatePlayer(dt);
    };

    Game.prototype._updateStars = function (dt) {
        var k = dt / 16;
        for (var i = 0; i < this.stars.length; i++) {
            var s = this.stars[i];
            s.y += s.speed * k;
            if (CFG.USE_STAR_TWINKLE) s.twinkle += s.twinkleSpeed * k;
            if (s.y > this.H + 5) { s.y = -5; s.x = Math.random() * this.W; }
        }
    };

    Game.prototype._updateNebulas = function (dt) {
        var k = dt / 16;
        for (var i = 0; i < this.nebulas.length; i++) {
            var n = this.nebulas[i];
            n.x += n.vx * k; n.y += n.vy * k;
            if (n.x < -n.r) n.x = this.W + n.r;
            if (n.x > this.W + n.r) n.x = -n.r;
            if (n.y < -n.r) n.y = this.H + n.r;
            if (n.y > this.H + n.r) n.y = -n.r;
        }
    };

    Game.prototype._updatePlanets = function (dt) {
        var k = dt / 16;
        for (var i = 0; i < this.planets.length; i++) {
            var p = this.planets[i];
            p.x += p.vx * k; p.y += p.vy * k; p.rot += p.rotSpeed * k;
            if (p.y - p.r > this.H) { p.y = -p.r; p.x = rand(-p.r, this.W + p.r); p.vx = rand(-0.12, 0.12); }
            if (p.x < -p.r * 2) p.x = this.W + p.r;
            if (p.x > this.W + p.r * 2) p.x = -p.r;
        }
    };

    Game.prototype._updateFarRocks = function (dt) {
        var k = dt / 16;
        for (var i = 0; i < this.farRocks.length; i++) {
            var r = this.farRocks[i];
            r.y += r.speed * k; r.x += r.vx * k; r.rot += r.rotSpeed * k;
            if (r.y > this.H + 10) { r.y = -10; r.x = Math.random() * this.W; }
            if (r.x < -10) r.x = this.W + 10;
            if (r.x > this.W + 10) r.x = -10;
        }
    };

    Game.prototype._updateComets = function (dt) {
        var k = dt / 16;
        this._cometTimer -= k;
        if (this._cometTimer <= 0) { this._spawnComet(); this._cometTimer = rand(180, 420); }
        for (var i = this.comets.length - 1; i >= 0; i--) {
            var c = this.comets[i];
            c.x += c.vx * k; c.y += c.vy * k; c.age += k;
            if (c.y - 40 > this.H || c.x < -100 || c.x > this.W + 100) this.comets.splice(i, 1);
        }
    };

    Game.prototype._spawnComet = function () {
        var fromLeft = Math.random() < 0.5;
        var sx = fromLeft ? rand(-50, this.W * 0.4) : rand(this.W * 0.6, this.W + 50);
        var a = (fromLeft ? rand(30, 55) : rand(125, 150)) * Math.PI / 180;
        var sp = rand(3, 6);
        this.comets.push({
            x: sx, y: rand(-80, -20),
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            length: rand(80, 160), size: rand(1.5, 3),
            color: pick([200, 220, 40, 15, 280]), age: 0,
        });
    };

    Game.prototype._updateMeteors = function (dt) {
        var k = dt / 16;
        this._meteorTimer -= k;
        if (this._meteorTimer <= 0) { this._spawnMeteor(); this._meteorTimer = rand(60, 180); }
        for (var i = this.meteors.length - 1; i >= 0; i--) {
            var m = this.meteors[i];
            m.x += m.vx * k; m.y += m.vy * k; m.rot += m.rotSpeed * k; m.age += k; m.flicker += 0.2 * k;
            if (m.y - 60 > this.H || m.x < -100 || m.x > this.W + 100) this.meteors.splice(i, 1);
        }
    };

    Game.prototype._spawnMeteor = function () {
        var t = randInt(0, 2), sx, vx, vy;
        var sp = rand(2, 5);
        if (t === 0) { sx = rand(0, this.W); vx = rand(-0.3, 0.3); vy = sp; }
        else if (t === 1) { sx = rand(-50, this.W * 0.3); var a1 = rand(35, 60) * Math.PI / 180; vx = Math.cos(a1) * sp; vy = Math.sin(a1) * sp; }
        else { sx = rand(this.W * 0.7, this.W + 50); var a2 = rand(120, 145) * Math.PI / 180; vx = Math.cos(a2) * sp; vy = Math.sin(a2) * sp; }
        this.meteors.push({
            x: sx, y: rand(-60, -10), vx: vx, vy: vy, r: rand(2, 5),
            rot: Math.random() * Math.PI * 2, rotSpeed: rand(-0.08, 0.08),
            age: 0, flicker: 0, color: Math.random() < 0.5 ? 'orange' : 'blue',
        });
    };

    Game.prototype._updateWeapon = function (dt) {
        var k = dt / 16;
        if (this.weaponActive) {
            this.weaponTimer -= k;
            if (this.weaponTimer <= 0) {
                this.weaponActive = false; this.weaponTimer = 0;
                this._updateHudWeapon();
            } else {
                this._updateHudWeapon();
            }
        }
        this.fireCooldown -= k;
        if (this.fireHeld && this.weaponActive && this.fireCooldown <= 0) {
            this._fireBullet();
            this.fireCooldown = CFG.WEAPON_COOLDOWN;
        }
    };

    Game.prototype._fireBullet = function () {
        var p = this.player;
        this.bullets.push({ x: p.x, y: p.y - CFG.PLAYER_SIZE / 2, vy: -CFG.BULLET_SPEED, life: 1, age: 0 });
        p.vx += rand(-0.5, 0.5);
        for (var i = 0; i < 3; i++) {
            this.particles.push({
                kind: 'spark', x: p.x, y: p.y - CFG.PLAYER_SIZE / 2,
                vx: rand(-1, 1), vy: rand(-2, -0.5),
                life: 1, lifeSpeed: 0.08, size: rand(1, 2.5), color: '#FFD280',
            });
        }
        this._trimParticles();
    };

    Game.prototype._updateBullets = function (dt) {
        var k = dt / 16;
        for (var i = this.bullets.length - 1; i >= 0; i--) {
            var b = this.bullets[i];
            b.y += b.vy * k; b.age += k;
            b.life = 1 - b.age / CFG.BULLET_LIFE;
            if (b.y < -20 || b.life <= 0) { this.bullets.splice(i, 1); continue; }

            var hit = false;
            for (var j = this.items.length - 1; j >= 0; j--) {
                var it = this.items[j];
                var dx = b.x - it.x, dy = b.y - it.y;
                if (dx * dx + dy * dy < it.radius * it.radius) {
                    this._onBulletHit(it);
                    this.items.splice(j, 1);
                    hit = true;
                    break;
                }
            }
            if (hit) this.bullets.splice(i, 1);
        }
    };

    Game.prototype._onBulletHit = function (it) {
        var gained = 0;
        if (it.type === 'monster')  gained = CFG.POINTS_ENEMY    * this.multiplier;
        if (it.type === 'nlo')      gained = CFG.POINTS_NLO      * this.multiplier;
        if (it.type === 'demon')    gained = CFG.POINTS_DEMON    * this.multiplier;
        if (it.type === 'asteroid') gained = CFG.POINTS_ASTEROID * this.multiplier;
        if (it.type === 'fireball') gained = CFG.POINTS_FIREBALL * this.multiplier;

        if (gained > 0) {
            this.score += gained;
            this._updateHudScore();
            this._checkLevelUp();
            var color = it.type === 'demon' ? '#FF4040' : it.type === 'nlo' ? '#40E0D0' : it.type === 'fireball' ? '#FF9050' : it.type === 'asteroid' ? '#A0A0B0' : '#A060FF';
            this._burst(it.x, it.y, color, 16);
            this._burst(it.x, it.y, '#FFD280', 8);
            this._popText(it.x, it.y, '+' + gained, '#FFD280');
            return;
        }

        if (it.type === 'bonus') {
            this._burst(it.x, it.y, '#64C8BD', 12);
            this._popText(it.x, it.y, '💔', '#5A7070');
        } else if (it.type === 'powerup') {
            this._burst(it.x, it.y, '#FFD280', 16);
            this._popText(it.x, it.y, '💫', '#5A7070');
        }
    };
    Game.prototype._pickEnemy = function () {
        var roll = Math.random();
        if (this.level <= 3) return ENEMY_MONSTER;
        if (this.level <= 6) return roll < 0.75 ? ENEMY_MONSTER : ENEMY_NLO;
        if (roll < 0.65) return ENEMY_MONSTER;
        if (roll < 0.90) return ENEMY_NLO;
        return ENEMY_DEMON;
    };

    Game.prototype._updateItems = function (dt) {
        var k = dt / 16;

        var spawnInterval = CFG.SPAWN_RATE_BASE * (1 + (this.level - 1) * CFG.SPAWN_LEVEL_STEP);

        this._itemTimer -= k;
        if (this._itemTimer <= 0) {
            this._spawnItem();
            this._itemTimer = spawnInterval + rand(-8, 8);
        }

        this._powerupTimer -= k;
        if (this._powerupTimer <= 0) {
            this._spawnPowerup();
            this._powerupTimer = rand(CFG.POWERUP_INTERVAL_MIN, CFG.POWERUP_INTERVAL_MAX);
        }

        var totalLives = CFG.MAX_LIVES + this.buffExtraLives;
        if (this.lives < totalLives && this.lives >= 1) {
            var range = CFG.HEART_INTERVAL_BY_LIVES[this.lives];
            if (range) {
                this._heartTimer -= k;
                if (this._heartTimer <= 0) {
                    this._spawnHeart();
                    this._heartTimer = rand(range[0], range[1]);
                }
            }
        }

        var pickedUpThisFrame = false;

        for (var i = this.items.length - 1; i >= 0; i--) {
            var it = this.items[i];
            it.y += it.vy * k; it.x += it.vx * k; it.rot += it.rotSpeed * k; it.age += k;
            if (it.x < 20 || it.x > this.W - 20) it.vx *= -1;

            if (!pickedUpThisFrame) {
                var dx = it.x - this.player.x, dy = it.y - this.player.y;
                var hitDist = it.radius + CFG.PLAYER_SIZE / 2 - 6;

                if (dx * dx + dy * dy < hitDist * hitDist) {
                    if (it.type === 'bonus')          this._onBonusCatch(it);
                    else if (it.type === 'powerup')   this._onPowerupCatch(it);
                    else if (it.type === 'heart')     this._onHeartCatch(it);
                    else                              this._onEnemyHit(it);
                    this.items.splice(i, 1);
                    pickedUpThisFrame = true;
                    continue;
                }
            }

            if (it.y > this.H + 60) {
                if (it.type === 'bonus') this._resetCombo();
                this.items.splice(i, 1);
            }
        }
    };

    Game.prototype._spawnItem = function () {
        var roll = Math.random();
        var type = 'enemy';

        if (roll < CFG.BONUS_CHANCE) {
            type = 'bonus';
        } else {
            var er = Math.random();
            if (this.level >= 6 && er < 0.12) {
                type = 'fireball';
            } else if (this.level >= 4 && er < 0.20) {
                type = 'asteroid';
            }
        }

        var item = { x: rand(40, this.W - 40), y: -40, rot: 0, rotSpeed: rand(-0.05, 0.05), age: 0 };

        if (type === 'bonus') {
            item.type = 'bonus';
            item.emoji = pick(BONUS_EMOJIS);
            item.vy = rand(CFG.ITEM_FALL_MIN, CFG.ITEM_FALL_MAX) * this.speedMul;
            item.vx = rand(-0.5, 0.5);
            item.size = 34; item.radius = 20;
        } else if (type === 'asteroid') {
            item.type = 'asteroid';
            item.emoji = '🪨';
            item.vy = rand(CFG.ITEM_FALL_MIN, CFG.ITEM_FALL_MAX) * 0.85 * this.speedMul;
            item.vx = rand(-0.4, 0.4);
            item.size = 42; item.radius = 26;
            item.damage = 1;
        } else if (type === 'fireball') {
            item.type = 'fireball';
            item.emoji = '☄️';
            item.vy = rand(CFG.ITEM_FALL_MIN, CFG.ITEM_FALL_MAX) * 1.5 * this.speedMul;
            item.vx = rand(-0.9, 0.9);
            item.size = 42; item.radius = 26;
            item.damage = 1;
        } else {
            var enemy = this._pickEnemy();
            item.type = enemy.type;
            item.emoji = enemy.emoji;
            item.damage = enemy.damage;
            item.size = enemy.size;
            item.radius = enemy.radius;
            item.color = enemy.color;
            item.glow = enemy.glow;
            item.shake = enemy.shake;
            item.vy = rand(CFG.ITEM_FALL_MIN, CFG.ITEM_FALL_MAX) * enemy.speedMul * this.speedMul;
            item.vx = rand(-0.7, 0.7);
        }

        this.items.push(item);
    };

    Game.prototype._spawnPowerup = function () {
        this.items.push({
            type: 'powerup', emoji: POWERUP_EMOJI,
            x: rand(60, this.W - 60), y: -50,
            vy: rand(1.4, 2.0) * this.speedMul, vx: rand(-0.3, 0.3),
            rot: 0, rotSpeed: rand(-0.03, 0.03),
            size: 44, radius: 26, age: 0,
        });
    };

    Game.prototype._spawnHeart = function () {
        this.items.push({
            type: 'heart', emoji: HEART_EMOJI,
            x: rand(60, this.W - 60), y: -50,
            vy: rand(1.2, 1.6) * this.speedMul, vx: rand(-0.2, 0.2),
            rot: 0, rotSpeed: rand(-0.02, 0.02),
            size: 46, radius: 26, age: 0,
        });
    };

    Game.prototype._onBonusCatch = function (it) {
        this.comboCount++;
        var nm = Math.min(1 + Math.floor(this.comboCount / CFG.COMBO_STEP), CFG.COMBO_MAX);
        if (nm !== this.multiplier) { this.multiplier = nm; this._updateHudCombo(); }

        var gained = CFG.POINTS_BONUS * this.multiplier;
        this.score += gained;
        this._updateHudScore();
        this._checkLevelUp();

        this._burst(it.x, it.y, '#64C8BD', 14);
        this._burst(it.x, it.y, '#FFD280', 10);
        this._flash('gold');
        this._popText(it.x, it.y, '+' + gained, '#FFD280');
        this._vibrate(15);
    };

    Game.prototype._onPowerupCatch = function (it) {
        this.weaponActive = true;
        this.weaponTimer = CFG.WEAPON_DURATION;
        this.fireHeld = false;
        this.fireCooldown = CFG.WEAPON_COOLDOWN;

        this._updateHudWeapon();
        this._flash('weapon');
        this._burst(it.x, it.y, '#FFD280', 24);
        this._popText(it.x, it.y, '⭐ ОРУЖИЕ!', '#FFD280');
        this._announce('⭐ ОРУЖИЕ АКТИВИРОВАНО!', '#FFD280');
        this._vibrate(40);
    };

    Game.prototype._onHeartCatch = function (it) {
        var totalLives = CFG.MAX_LIVES + this.buffExtraLives;

        if (it.isDeathSave) {
            this._onHeartSaveCaught();
            return;
        }

        if (this.lives < totalLives) {
            this.lives++;
            this._updateHudLives();
            this._burst(it.x, it.y, '#FF80B0', 22);
            this._flash('weapon');
            this._popText(it.x, it.y, '+1 ❤️', '#FF80B0');
            this._announce('💖 +1 ЖИЗНЬ!', '#FF80B0');
            this._vibrate(30);
        } else {
            this.score += 100;
            this._updateHudScore();
            this._checkLevelUp();
            this._burst(it.x, it.y, '#FF80B0', 18);
            this._popText(it.x, it.y, '+100', '#FFD280');
        }
    };

    Game.prototype._onEnemyHit = function (it) {
        var dmg = it.damage || 1;

        this.lives -= dmg;
        if (this.lives < 0) this.lives = 0;
        this._updateHudLives();

        if (dmg === 1) {
            this._shakeStage(1);
            this._flash('red');
            this._vibrate(60);
        } else if (dmg === 2) {
            this._shakeStage(1.5);
            this._flash('red');
            this._vibrate([50, 30, 50]);
        } else if (dmg >= 3) {
            this._shakeStage(2.2);
            this._flash('red');
            this._flash('dark');
            this._vibrate([80, 40, 80, 40, 120]);
        }

        this._resetCombo();

        var color = dmg >= 3 ? '#FF4040' : dmg === 2 ? '#40E0D0' : '#A060FF';
        this._burst(it.x, it.y, color, 20);
        this._popText(it.x, it.y, '−' + dmg + ' ❤️', color);

        if (this.lives <= 0) {
            this._checkDeathSave();
        }
    };

    Game.prototype._checkDeathSave = function () {
        if (this._deathSave) { this._onGameOver(); return; }
        if (this.score < CFG.DEATH_SAVE_THRESHOLD) { this._onGameOver(); return; }

        this.lives = 1;
        this._updateHudLives();

        var heart = {
            type: 'heart', emoji: HEART_EMOJI,
            x: rand(this.W * 0.3, this.W * 0.7), y: -60,
            vy: (this.H + 120) / CFG.DEATH_SAVE_DURATION,
            vx: 0, rot: 0, rotSpeed: 0,
            size: 80, radius: 50, age: 0, isDeathSave: true,
        };

        this.items.push(heart);
        this._deathSave = heart;

        this._announce('💖 СПАСЕНИЕ!', '#FF80B0');
        this._flash('weapon');
    };

    Game.prototype._onHeartSaveCaught = function () {
        this._deathSave = null;
        this.lives = 1;
        this._updateHudLives();
        this._announce('💖 СПАСЕНИЕ УДАЛОСЬ!', '#FF80B0');
        this._flash('gold');
    };

    Game.prototype._resetCombo = function () {
        this.comboCount = 0; this.multiplier = 1;
        this._updateHudCombo();
    };

    Game.prototype._checkLevelUp = function () {
        var nl = Math.floor(this.score / CFG.LEVEL_STEP) + 1;
        if (nl > this.level) {
            this.level = nl; this.speedMul *= CFG.LEVEL_SPEED_UP;
            this._updateHudLevel();
            this._announce('🎺 УРОВЕНЬ ' + this.level + '!', '#FFD280');
            this._flash('gold');
        }
    };

    Game.prototype._onGameOver = function () {
        this.stop();
        var duration = Math.round((Date.now() - this._gameStartTime) / 1000);
        if (this._onGameOverCallback) {
            this._onGameOverCallback(this.score, this.level, duration);
        }
    };

    Game.prototype._updateParticles = function (dt) {
        var k = dt / 16;
        for (var i = this.particles.length - 1; i >= 0; i--) {
            var p = this.particles[i];
            p.x += p.vx * k; p.y += p.vy * k;
            p.vy += 0.08 * k;
            p.vx *= 0.98; p.vy *= 0.98;
            p.life -= p.lifeSpeed * k;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    };

    Game.prototype._trimParticles = function () {
        if (this.particles.length > CFG.MAX_PARTICLES) {
            this.particles.splice(0, this.particles.length - CFG.MAX_PARTICLES);
        }
    };

    Game.prototype._burst = function (x, y, color, count) {
        if (IS_MOBILE) count = Math.ceil(count * 0.6);
        for (var i = 0; i < count; i++) {
            var a = Math.random() * Math.PI * 2;
            var s = 1.5 + Math.random() * 5;
            this.particles.push({
                kind: 'spark', x: x, y: y,
                vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1,
                life: 1, lifeSpeed: rand(0.015, 0.028),
                size: rand(1.5, 3.5), color: color,
            });
        }
        this._trimParticles();
    };

    Game.prototype._popText = function (x, y, text, color) {
        this.particles.push({
            kind: 'text', x: x, y: y, vx: 0, vy: -1.2,
            life: 1, lifeSpeed: 0.014,
            text: text, color: color, size: 20,
        });
        this._trimParticles();
    };

    Game.prototype._announce = function (text, color) {
        this.announcements.push({ text: text, color: color, life: 1, lifeSpeed: 0.012 });
    };

    Game.prototype._updateAnnouncements = function (dt) {
        var k = dt / 16;
        for (var i = this.announcements.length - 1; i >= 0; i--) {
            this.announcements[i].life -= this.announcements[i].lifeSpeed * k;
            if (this.announcements[i].life <= 0) this.announcements.splice(i, 1);
        }
    };

    Game.prototype._updatePlayer = function (dt) {
        var k = dt / 16;
        var p = this.player;
        var margin = CFG.PLAYER_SIZE / 2 + 4;
        var px = p.x;

        var keyboardActive = this.keys.left || this.keys.right;
        var tiltActive = (this._controlMode === 'tilt') && this.tiltEnabled;
        var swipeActive = (this._controlMode === 'swipe') && this.touch.active && IS_MOBILE;

        if (keyboardActive) {
            this.pointer.active = false;
            if (this.keys.left)  p.vx -= CFG.PLAYER_ACC * k;
            if (this.keys.right) p.vx += CFG.PLAYER_ACC * k;
            p.vx *= CFG.PLAYER_FRICTION;
            p.vx = clamp(p.vx, -CFG.PLAYER_MAX_V, CFG.PLAYER_MAX_V);
            p.x += p.vx * k;
        } else if (tiltActive) {
            this.pointer.active = false;
            var t = this.tilt;
            var absT = Math.abs(t);

            if (absT < CFG.TILT_DEADZONE) {
                t = 0;
            } else {
                t = t - (CFG.TILT_DEADZONE * (t > 0 ? 1 : -1));
            }

            var maxT = CFG.TILT_MAX_ANGLE - CFG.TILT_DEADZONE;
            var force = clamp(t / maxT, -1, 1);

            var targetVx = force * CFG.PLAYER_MAX_V;
            p.vx += (targetVx - p.vx) * CFG.TILT_SMOOTH * k;

            p.x += p.vx * k;
        } else if (swipeActive) {
            this.pointer.active = false;
            p.vx *= 0.88;
        } else if (this.pointer.active && !IS_MOBILE) {
            var tx = clamp(this.pointer.x, margin, this.W - margin);
            var diff = tx - p.x;
            if (Math.abs(diff) < CFG.MOUSE_DEADZONE) {
                p.vx *= 0.7;
            } else {
                p.x += diff * CFG.MOUSE_LERP * k;
                p.vx = (p.x - px) / Math.max(k, 0.001);
            }
        } else {
            p.vx *= 0.85;
            p.x += p.vx * k;
        }

        p.x = clamp(p.x, margin, this.W - margin);
        p.tilt = clamp(p.vx * 0.025, -0.30, 0.30);

        p.trail.push({ x: p.x, y: p.y, life: 1, speed: Math.abs(p.vx) });
        for (var i = p.trail.length - 1; i >= 0; i--) {
            p.trail[i].life -= 0.035 * k;
            if (p.trail[i].life <= 0) p.trail.splice(i, 1);
        }
        if (p.trail.length > 22) p.trail.shift();
    };

    // ============================================================
    // === ОТРИСОВКА ==============================================
    // ============================================================

    Game.prototype._draw = function () {
        this._drawBackground(); this._drawNebulas(); this._drawStars();
        this._drawPlanets();
        if (CFG.USE_FAR_ROCKS) this._drawFarRocks();
        if (CFG.USE_COMETS) this._drawComets();
        if (CFG.USE_METEORS) this._drawMeteors();
        this._drawItems(); this._drawBullets();
        this._drawParticles(); this._drawPlayer(); this._drawAnnouncements();
    };

    Game.prototype._drawFps = function () {
        if (!IS_MOBILE) return;
        if (!this._fps) return;
        var ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = this._fps < 40 ? '#FF4040' : this._fps < 55 ? '#FFD280' : '#64C8BD';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('FPS: ' + this._fps, 8, this.H - 8);
        ctx.restore();
    };

    Game.prototype._drawBackground = function () {
        var ctx = this.ctx;
        var g = ctx.createLinearGradient(0, 0, 0, this.H);
        g.addColorStop(0, '#000104');
        g.addColorStop(0.4, '#02030a');
        g.addColorStop(0.75, '#040611');
        g.addColorStop(1, '#000105');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.W, this.H);
    };

    Game.prototype._drawNebulas = function () {
        var ctx = this.ctx;
        for (var i = 0; i < this.nebulas.length; i++) {
            var n = this.nebulas[i];
            var g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
            g.addColorStop(0, 'rgba(' + n.rgb[0] + ',' + n.rgb[1] + ',' + n.rgb[2] + ',' + n.alpha + ')');
            g.addColorStop(0.5, 'rgba(' + n.rgb[0] + ',' + n.rgb[1] + ',' + n.rgb[2] + ',' + (n.alpha * 0.4) + ')');
            g.addColorStop(1, 'rgba(' + n.rgb[0] + ',' + n.rgb[1] + ',' + n.rgb[2] + ',0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
        }
    };

    Game.prototype._drawStars = function () {
        var ctx = this.ctx;
        for (var i = 0; i < this.stars.length; i++) {
            var s = this.stars[i];
            if (s.bright && !IS_MOBILE) {
                ctx.save();
                ctx.translate(s.x, s.y); ctx.rotate(s.twinkle * 0.15);
                var g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.r * 6);
                g.addColorStop(0, 'rgba(' + s.color + ',0.9)');
                g.addColorStop(0.5, 'rgba(' + s.color + ',0.2)');
                g.addColorStop(1, 'rgba(' + s.color + ',0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(0, 0, s.r * 6, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(' + s.color + ',0.7)';
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(-s.r * 4, 0); ctx.lineTo(s.r * 4, 0);
                ctx.moveTo(0, -s.r * 4); ctx.lineTo(0, s.r * 4);
                ctx.stroke();
                ctx.restore();
            } else {
                var alpha = s.alpha;
                if (CFG.USE_STAR_TWINKLE) {
                    var tw = 0.75 + Math.sin(s.twinkle) * 0.25;
                    alpha = s.alpha * tw;
                }
                ctx.beginPath();
                ctx.fillStyle = 'rgba(' + s.color + ',' + alpha + ')';
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    };

    Game.prototype._drawPlanets = function () {
        var ctx = this.ctx;
        for (var i = 0; i < this.planets.length; i++) {
            var p = this.planets[i];
            if (!p.cache) continue;
            var size = p.cacheSize;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.drawImage(p.cache, -size / 2, -size / 2, size, size);
            ctx.restore();
        }
    };

    Game.prototype._drawFarRocks = function () {
        var ctx = this.ctx;
        for (var i = 0; i < this.farRocks.length; i++) {
            var r = this.farRocks[i];
            ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
            ctx.beginPath(); ctx.fillStyle = 'rgba(150,150,170,' + r.alpha + ')';
            ctx.arc(0, 0, r.r, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    };

    Game.prototype._drawComets = function () {
        var ctx = this.ctx;
        for (var i = 0; i < this.comets.length; i++) {
            var c = this.comets[i];
            var l = Math.sqrt(c.vx * c.vx + c.vy * c.vy) || 1;
            var dx = -c.vx / l, dy = -c.vy / l;
            var tx = c.x + dx * c.length, ty = c.y + dy * c.length;
            var g = ctx.createLinearGradient(c.x, c.y, tx, ty);
            var h = c.color;
            g.addColorStop(0, 'hsla(' + h + ',90%,85%,0.95)');
            g.addColorStop(0.3, 'hsla(' + h + ',80%,65%,0.6)');
            g.addColorStop(1, 'hsla(' + h + ',70%,50%,0)');
            ctx.strokeStyle = g; ctx.lineWidth = c.size * 3; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.beginPath(); ctx.fillStyle = '#fff';
            ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2); ctx.fill();
        }
    };

    Game.prototype._drawMeteors = function () {
        var ctx = this.ctx;
        for (var i = 0; i < this.meteors.length; i++) {
            var m = this.meteors[i];
            var l = Math.sqrt(m.vx * m.vx + m.vy * m.vy) || 1;
            var dx = -m.vx / l, dy = -m.vy / l;
            var tl = m.r * 8, h = m.color === 'orange' ? 25 : 210;
            var tx = m.x + dx * tl, ty = m.y + dy * tl;
            var g = ctx.createLinearGradient(m.x, m.y, tx, ty);
            g.addColorStop(0, 'hsla(' + h + ',100%,75%,0.9)');
            g.addColorStop(0.4, 'hsla(' + h + ',95%,60%,0.5)');
            g.addColorStop(1, 'hsla(' + h + ',90%,50%,0)');
            ctx.strokeStyle = g; ctx.lineWidth = m.r * 1.5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.save();
            ctx.translate(m.x, m.y); ctx.rotate(m.rot);
            ctx.beginPath(); ctx.fillStyle = 'rgba(30,20,15,0.9)';
            ctx.arc(0, 0, m.r, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
    };

    // ============================================================
    // === РИСУЕМ ПРЕДМЕТЫ ЧЕРЕЗ СПРАЙТЫ =========================
    // ============================================================
    Game.prototype._drawItems = function () {
        var ctx = this.ctx;
        var S = window.FestaSprites;

        for (var i = 0; i < this.items.length; i++) {
            var it = this.items[i];
            var spriteKey = null;
            var drawSize = it.size * 2.2;
            var pulse = 1;

            // Определяем ключ спрайта
            if (it.type === 'monster')      spriteKey = 'antisms';
            else if (it.type === 'nlo')     spriteKey = 'glitch';
            else if (it.type === 'demon')   spriteKey = 'demon';
            else if (it.type === 'bonus')   spriteKey = 'gift';
            else if (it.type === 'powerup') spriteKey = 'star';
            else if (it.type === 'heart')   spriteKey = 'heart';
            else if (it.type === 'asteroid') spriteKey = 'asteroid';
            else if (it.type === 'fireball') spriteKey = 'fireball';

            // Пульсация для некоторых
            if (it.type === 'powerup') {
                pulse = 1 + Math.sin(it.age * 0.2) * 0.12;
            } else if (it.type === 'heart') {
                pulse = 1 + Math.sin(it.age * 0.18) * 0.1;
            } else if (it.type === 'demon') {
                pulse = 1 + Math.sin(it.age * 0.3) * 0.08;
            } else if (it.type === 'bonus') {
                pulse = 1 + Math.sin(it.age * 0.15) * 0.07;
            }

            var img = spriteKey && S ? S.get(spriteKey) : null;
            if (img) {
                var w = drawSize * pulse;
                var h = drawSize * pulse;

                // Для heart death save — побольше
                if (it.type === 'heart' && it.isDeathSave) {
                    w *= 1.4;
                    h *= 1.4;
                }

                ctx.save();
                ctx.translate(it.x, it.y);
                ctx.rotate(it.rot);
                ctx.drawImage(img, -w / 2, -h / 2, w, h);
                ctx.restore();
            } else {
                // Фолбэк — эмодзи, если спрайт не загрузился
                ctx.save();
                ctx.translate(it.x, it.y);
                ctx.rotate(it.rot);
                if (it.emoji) {
                    ctx.font = it.size + 'px "Segoe UI Emoji", sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(it.emoji, 0, 0);
                }
                ctx.restore();
            }
        }
    };

    // ============================================================
    // === РИСУЕМ ПУЛИ ЧЕРЕЗ СПРАЙТЫ ==============================
    // ============================================================
    Game.prototype._drawBullets = function () {
        var ctx = this.ctx;
        var S = window.FestaSprites;
        var bulletImg = S ? S.get('bullet') : null;

        for (var i = 0; i < this.bullets.length; i++) {
            var b = this.bullets[i];

            if (bulletImg) {
                var size = CFG.BULLET_SIZE * 6;
                ctx.drawImage(bulletImg, b.x - size / 2, b.y - size / 2, size, size);
            } else {
                // Фолбэк — старая логика с градиентом
                var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, CFG.BULLET_SIZE * 4);
                g.addColorStop(0, 'rgba(255,210,128,1)');
                g.addColorStop(0.4, 'rgba(255,200,80,0.6)');
                g.addColorStop(1, 'rgba(255,200,80,0)');
                ctx.beginPath(); ctx.fillStyle = g;
                ctx.arc(b.x, b.y, CFG.BULLET_SIZE * 4, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.fillStyle = '#FFFDE0';
                ctx.arc(b.x, b.y, CFG.BULLET_SIZE, 0, Math.PI * 2); ctx.fill();
            }
        }
    };

    Game.prototype._drawParticles = function () {
        var ctx = this.ctx;
        for (var i = 0; i < this.particles.length; i++) {
            var p = this.particles[i];
            if (p.kind === 'spark') {
                ctx.beginPath();
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.kind === 'text') {
                ctx.save();
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.fillStyle = p.color;
                ctx.font = 'bold ' + p.size + 'px "Nunito",sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(p.text, p.x, p.y);
                ctx.restore();
            }
        }
        ctx.globalAlpha = 1;
    };

    // ============================================================
    // === РИСУЕМ СМСИКА ЧЕРЕЗ СПРАЙТЫ ===========================
    // ============================================================
    Game.prototype._drawPlayer = function () {
        var ctx = this.ctx;
        var p = this.player;
        var S = window.FestaSprites;

        // След-шлейф
        for (var i = 0; i < p.trail.length; i++) {
            var t = p.trail[i];
            var inten = t.speed ? Math.min(t.speed / 8, 1) : 0.2;
            var sz = CFG.PLAYER_SIZE * (0.3 + t.life * 0.35) * (0.6 + inten * 0.4);
            var al = t.life * 0.35 * (0.4 + inten * 0.6);
            ctx.beginPath();
            ctx.fillStyle = 'rgba(100,200,189,' + al + ')';
            ctx.arc(t.x, t.y, sz * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.tilt);

        // Ореол вокруг игрока
        var gc = this.lives <= 1 ? '251,126,135' : '100,200,189';
        var g = ctx.createRadialGradient(0, 0, 0, 0, 0, CFG.PLAYER_SIZE);
        g.addColorStop(0, 'rgba(' + gc + ',0.55)');
        g.addColorStop(0.5, 'rgba(' + gc + ',0.15)');
        g.addColorStop(1, 'rgba(' + gc + ',0)');
        ctx.beginPath();
        ctx.fillStyle = g;
        ctx.arc(0, 0, CFG.PLAYER_SIZE, 0, Math.PI * 2);
        ctx.fill();

        // Смсик (спрайт)
        var smsikImg = S ? S.get('smsik') : null;
        if (smsikImg) {
            var size = CFG.PLAYER_SIZE * 2.4;
            ctx.drawImage(smsikImg, -size / 2, -size / 2, size, size);
        } else {
            // Фолбэк — эмодзи
            ctx.font = CFG.PLAYER_SIZE + 'px "Segoe UI Emoji", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.lives <= 1 ? '😰' : '😊', 0, 0);
        }

        ctx.restore();

        // Иконка пушки над игроком
        if (this.weaponActive) {
            ctx.save();
            ctx.translate(p.x, p.y - CFG.PLAYER_SIZE / 2 - 18);
            ctx.rotate(p.tilt * 0.5);

            var gunImg = S ? S.get('gun') : null;
            if (gunImg) {
                ctx.drawImage(gunImg, -16, -16, 32, 32);
            } else {
                ctx.font = '24px "Segoe UI Emoji", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🔫', 0, 0);
            }

            ctx.restore();
        }
    };

    Game.prototype._drawAnnouncements = function () {
        var ctx = this.ctx;
        var cx = this.W / 2, cy = this.H * 0.35;
        for (var i = 0; i < this.announcements.length; i++) {
            var a = this.announcements[i];
            var al = Math.min(1, a.life * 2);
            var sc = 1 + (1 - a.life) * 0.15;
            ctx.save();
            ctx.globalAlpha = al;
            ctx.translate(cx, cy);
            ctx.scale(sc, sc);
            ctx.fillStyle = a.color;
            ctx.font = 'bold 38px "Nunito",sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(a.text, 0, 0);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    };
    // ============================================================
    // === ПУБЛИЧНЫЙ API ==========================================
    // ============================================================

    var instance = null;

    window.FestaStarfall = {
        init: function (stageEl) {
            if (!stageEl) return null;
            if (instance && instance.stage === stageEl) return instance;
            if (instance) instance.destroy();
            instance = new Game(stageEl);
            return instance;
        },
        start: function () { if (instance) instance.start(); },
        stop: function () { if (instance) instance.stop(); },
        get instance() { return instance; }
    };

    // ============================================================
    // === UI: OVERLAY, ЛИДЕРБОРД, ПАСХАЛКА, ПАУЗА, МАГАЗИН =======
    // ============================================================

    var els = {};
    var isPaused = false;
    var pauseStartedAt = 0;

    var session = {
        score: 0,
        level: 1,
        duration: 0,
        spent: 0,
        boughtLife: false,
        boughtWeapon: false,
        scoreSent: false,
    };

    function $(id) { return document.getElementById(id); }

    function cacheElements() {
        els.stage        = $('starfallStage');
        els.startOverlay = $('starfallStartOverlay');
        els.endOverlay   = $('starfallEndOverlay');
        els.pauseOverlay = $('starfallPauseOverlay');
        els.controlsOverlay = $('starfallControlsOverlay');
        els.settingsOverlay = $('starfallSettingsOverlay');
        els.nameInput    = $('starfallNameInput');
        els.nameError    = $('starfallNameError');
        els.startBtn     = $('starfallStartBtn');
        els.playAgainBtn = $('starfallPlayAgainBtn');
        els.endHomeBtn   = $('starfallEndHomeBtn');
        els.resumeBtn    = $('starfallResumeBtn');
        els.restartBtn   = $('starfallRestartBtn');
        els.homeBtn      = $('starfallHomeBtn');
        els.pauseTimer   = $('starfallPauseTimer');
        els.endEmoji     = $('starfallEndEmoji');
        els.endTitle     = $('starfallEndTitle');
        els.endScore     = $('starfallEndScore');
        els.endMessage   = $('starfallEndMessage');
        els.endLb        = $('starfallEndLb');
        els.endLbList    = $('starfallEndLbList');
        els.endLbTabs    = $('starfallEndLbTabs');
        els.startLbList  = $('starfallLbList');
        els.startLbTabs  = $('starfallLbTabs');
        els.shop         = $('starfallShop');
        els.shopBalance  = $('starfallShopBalance');
        els.shopTotal    = $('starfallShopTotal');
        els.buyLife      = $('starfallBuyLife');
        els.buyWeapon    = $('starfallBuyWeapon');

        els.settingsBtn     = $('starfallSettingsBtn');
        els.closeBtn        = $('starfallCloseBtn');
        els.fireBtn         = $('starfallFireBtn');
        els.controlsBackBtn = $('starfallControlsBackBtn');
        els.settingsCloseBtn = $('starfallSettingsCloseBtn');
        els.vibroToggle     = $('starfallVibroToggle');
        els.vibroRow        = document.querySelector('.starfall-settings-row-vibro');
    }

    // ------------------------------------------------------------
    // --- Имя ----------------------------------------------------
    // ------------------------------------------------------------

    function loadSavedName() {
        try { return localStorage.getItem(CFG.LS_NAME_KEY) || ''; }
        catch (e) { return ''; }
    }

    function saveName(name) {
        try { localStorage.setItem(CFG.LS_NAME_KEY, name); } catch (e) {}
    }

    function validateName(name) {
        name = String(name || '').trim();
        if (name.length < 2) return { ok: false, msg: 'Имя слишком короткое (минимум 2 символа)' };
        if (name.length > 30) return { ok: false, msg: 'Имя слишком длинное (максимум 30 символов)' };
        if (!/^[\p{L}\p{N}\s\-_.]+$/u.test(name)) return { ok: false, msg: 'Только буквы, цифры, пробел, дефис, точка' };
        if (/(https?:\/\/|www\.|\.ru|\.com|@)/i.test(name)) return { ok: false, msg: 'Без ссылок и email' };
        if (/(.)\1{4,}/u.test(name)) return { ok: false, msg: 'Слишком много одинаковых символов' };
        return { ok: true, name: name };
    }

    // ------------------------------------------------------------
    // --- Настройки управления -----------------------------------
    // ------------------------------------------------------------

    function loadControlMode() {
        try {
            var m = localStorage.getItem(CFG.LS_CONTROL_KEY);
            if (m === 'swipe' || m === 'tilt') return m;
        } catch (e) {}
        return IS_MOBILE ? null : 'keyboard';
    }

    function saveControlMode(mode) {
        try { localStorage.setItem(CFG.LS_CONTROL_KEY, mode); } catch (e) {}
    }

    function loadVibroEnabled() {
        try {
            var v = localStorage.getItem(CFG.LS_VIBRO_KEY);
            return v === null ? true : v === '1';
        } catch (e) { return true; }
    }

    function saveVibroEnabled(v) {
        try { localStorage.setItem(CFG.LS_VIBRO_KEY, v ? '1' : '0'); } catch (e) {}
    }

    function isVibroSupported() {
        return 'vibrate' in navigator;
    }

    // ------------------------------------------------------------
    // --- Баффы --------------------------------------------------
    // ------------------------------------------------------------

    function loadBuffs() {
        try {
            var raw = localStorage.getItem(CFG.LS_BUFFS_KEY);
            if (!raw) return { extraLives: 0, weapon: false };
            var d = JSON.parse(raw);
            return {
                extraLives: Math.max(0, Math.min(5, parseInt(d.extraLives, 10) || 0)),
                weapon: !!d.weapon,
            };
        } catch (e) {
            return { extraLives: 0, weapon: false };
        }
    }

    function saveBuffs(buffs) {
        try { localStorage.setItem(CFG.LS_BUFFS_KEY, JSON.stringify(buffs)); } catch (e) {}
    }

    function clearBuffs() {
        try { localStorage.removeItem(CFG.LS_BUFFS_KEY); } catch (e) {}
    }

    function applyBuffsToGame(game) {
        var buffs = loadBuffs();
        game.buffExtraLives = buffs.extraLives;
        game.buffWeapon = buffs.weapon;
        clearBuffs();
    }

    // ------------------------------------------------------------
    // --- Лидерборд ----------------------------------------------
    // ------------------------------------------------------------

    function fetchLeaderboard(period) {
        return fetch(CFG.API_URL + '?period=' + encodeURIComponent(period), {
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
        .then(function (r) { return r.json(); })
        .catch(function () { return { ok: false, scores: [] }; });
    }

    function renderLeaderboard(listEl, scores, myName) {
        if (!listEl) return;
        listEl.innerHTML = '';

        if (!scores || !scores.length) {
            var li = document.createElement('li');
            li.className = 'starfall-lb-empty';
            li.textContent = 'Пока никто не играл — будь первым!';
            listEl.appendChild(li);
            return;
        }

        var myClean = (myName || '').toLowerCase().replace(/\s+/g, '');

        scores.forEach(function (s, idx) {
            var li = document.createElement('li');
            li.className = 'starfall-lb-item';

            var isMe = myClean && s.player_name.toLowerCase().replace(/\s+/g, '') === myClean;
            if (isMe) li.classList.add('is-me');

            var rankSpan = document.createElement('span');
            rankSpan.className = 'starfall-lb-rank';
            var medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
            rankSpan.textContent = medal || (idx + 1);

            var nameSpan = document.createElement('span');
            nameSpan.className = 'starfall-lb-name';
            nameSpan.textContent = s.player_name;
            if (s.is_easter_egg) {
                nameSpan.classList.add('is-easter-egg');
                nameSpan.dataset.name = s.player_name;
            }

            var scoreSpan = document.createElement('span');
            scoreSpan.className = 'starfall-lb-score';
            scoreSpan.textContent = s.score;

            li.appendChild(rankSpan);
            li.appendChild(nameSpan);
            li.appendChild(scoreSpan);
            listEl.appendChild(li);
        });
    }

    function bindLeaderboardTabs(tabsEl, listEl, myName) {
        if (!tabsEl) return;
        tabsEl.addEventListener('click', function (e) {
            var btn = e.target.closest('.starfall-lb-tab');
            if (!btn) return;
            tabsEl.querySelectorAll('.starfall-lb-tab').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            loadLeaderboardInto(listEl, btn.dataset.period, myName);
        });
    }

    function loadLeaderboardInto(listEl, period, myName) {
        if (!listEl) return;
        listEl.innerHTML = '<li class="starfall-lb-empty">Загружаем…</li>';
        fetchLeaderboard(period).then(function (data) {
            if (data.ok) {
                renderLeaderboard(listEl, data.scores, myName);
            } else {
                listEl.innerHTML = '<li class="starfall-lb-empty">Ошибка загрузки</li>';
            }
        });
    }

    function rainbowifyName(el) {
        if (!el || el.classList.contains('is-rainbow')) return;

        var text = el.dataset.name || el.textContent;
        var oldBadge = el.querySelector('.starfall-easter-badge');
        if (oldBadge) oldBadge.remove();

        var chars = Array.from(text);
        el.innerHTML = '';
        chars.forEach(function (ch, i) {
            var span = document.createElement('span');
            span.textContent = ch;
            span.style.animationDelay = (i * 0.07) + 's';
            span.className = 'starfall-rainbow-letter';
            el.appendChild(span);
        });

        el.classList.add('is-rainbow');

        var badge = document.createElement('span');
        badge.className = 'starfall-easter-badge';
        badge.innerHTML = '🥚 <span>Пасхалка найдена!</span>';
        el.appendChild(badge);

        setTimeout(function () {
            el.textContent = text;
            el.classList.remove('is-rainbow');
        }, 4000);
    }

    function bindEasterEggClicks(listEl) {
        if (!listEl) return;
        listEl.addEventListener('click', function (e) {
            var nameEl = e.target.closest('.starfall-lb-name.is-easter-egg');
            if (!nameEl) return;
            rainbowifyName(nameEl);
        });
    }

    // ------------------------------------------------------------
    // --- Overlay старта -----------------------------------------
    // ------------------------------------------------------------

    function showStartOverlay() {
        if (els.endOverlay) els.endOverlay.classList.add('is-hidden');
        if (els.pauseOverlay) els.pauseOverlay.classList.add('is-hidden');
        if (els.controlsOverlay) els.controlsOverlay.classList.add('is-hidden');
        if (els.settingsOverlay) els.settingsOverlay.classList.add('is-hidden');
        if (els.startOverlay) els.startOverlay.classList.remove('is-hidden');
    }

    function hideStartOverlay() {
        if (els.startOverlay) els.startOverlay.classList.add('is-hidden');
    }

    function showControlsOverlay() {
        if (els.startOverlay) els.startOverlay.classList.add('is-hidden');
        if (els.controlsOverlay) els.controlsOverlay.classList.remove('is-hidden');
    }

    function hideControlsOverlay() {
        if (els.controlsOverlay) els.controlsOverlay.classList.add('is-hidden');
        if (els.startOverlay) els.startOverlay.classList.remove('is-hidden');
    }

    function showSettingsOverlay(game) {
        if (!els.settingsOverlay) return;
        if (game.running) {
            isPaused = true;
            pauseStartedAt = Date.now();
            game.stop();
        }
        els.settingsOverlay.classList.remove('is-hidden');
        updateControlButtons(game);
    }

    function hideSettingsOverlay(game) {
        if (els.settingsOverlay) els.settingsOverlay.classList.add('is-hidden');
        if (isPaused) {
            var pauseEnded = Date.now();
            game._gameStartTime += pauseEnded - pauseStartedAt;
            isPaused = false;
            game.running = true;
            game.lastTs = 0;
            game.animId = requestAnimationFrame(game._boundLoop);
        }
    }

    function updateControlButtons(game) {
        var currentMode = game._controlMode;
        document.querySelectorAll('.starfall-choice-card').forEach(function (c) {
            c.classList.toggle('is-selected', c.dataset.mode === currentMode);
        });
        document.querySelectorAll('.starfall-choice-mini').forEach(function (c) {
            c.classList.toggle('is-selected', c.dataset.mode === currentMode);
        });
    }

    // ------------------------------------------------------------
    // --- Overlay конца + магазин --------------------------------
    // ------------------------------------------------------------

    function showEndOverlay(score, level, duration) {
        session.score = score;
        session.level = level;
        session.duration = duration;
        session.spent = 0;
        session.boughtLife = false;
        session.boughtWeapon = false;
        session.scoreSent = false;

        var emoji = '💫';
        var title = 'Игра окончена';
        var msg = 'Ты набрал ' + score + ' очков. Уровень ' + level + '.';

        if (score >= 3000) { emoji = '🏆'; title = 'Легенда!'; msg = 'Ого, ' + score + ' очков — это эпично!'; }
        else if (score >= 1500) { emoji = '🎉'; title = 'Великолепно!'; msg = score + ' очков — крутой результат!'; }
        else if (score >= 700) { emoji = '🌟'; title = 'Отличный результат!'; msg = score + ' очков — так держать!'; }
        else if (score >= 300) { emoji = '✨'; title = 'Неплохо!'; msg = score + ' очков. Попробуй ещё!'; }
        else { emoji = '💫'; title = 'Игра окончена'; msg = score + ' очков. Разомнись и попробуй ещё раз!'; }

        els.endEmoji.textContent = emoji;
        els.endTitle.textContent = title;
        els.endMessage.textContent = msg;
        els.endScore.textContent = score;

        updateShopUI();

        els.endLb.style.display = '';
        var name = loadSavedName();
        els.endLbTabs.querySelectorAll('.starfall-lb-tab').forEach(function (b) { b.classList.remove('active'); });
        var weekTab = els.endLbTabs.querySelector('[data-period="week"]');
        if (weekTab) weekTab.classList.add('active');
        loadLeaderboardInto(els.endLbList, 'week', name);

        if (els.startOverlay) els.startOverlay.classList.add('is-hidden');
        if (els.pauseOverlay) els.pauseOverlay.classList.add('is-hidden');
        els.endOverlay.classList.remove('is-hidden');
    }

    function updateShopUI() {
        var balance = session.score - session.spent;
        var total = Math.max(0, balance);

        if (els.shopBalance) els.shopBalance.textContent = balance;
        if (els.shopTotal)   els.shopTotal.textContent = total;

        if (els.buyLife) {
            if (session.boughtLife) {
                els.buyLife.classList.add('is-bought');
                els.buyLife.disabled = true;
                var priceEl = els.buyLife.querySelector('.starfall-shop-item-price');
                if (priceEl) priceEl.textContent = 'Куплено';
            } else if (balance < CFG.SHOP_PRICE_LIFE) {
                els.buyLife.disabled = true;
            } else {
                els.buyLife.disabled = false;
            }
        }

        if (els.buyWeapon) {
            if (session.boughtWeapon) {
                els.buyWeapon.classList.add('is-bought');
                els.buyWeapon.disabled = true;
                var priceEl2 = els.buyWeapon.querySelector('.starfall-shop-item-price');
                if (priceEl2) priceEl2.textContent = 'Куплено';
            } else if (balance < CFG.SHOP_PRICE_WEAPON) {
                els.buyWeapon.disabled = true;
            } else {
                els.buyWeapon.disabled = false;
            }
        }
    }

    function buyLife() {
        if (session.boughtLife) return;
        var balance = session.score - session.spent;
        if (balance < CFG.SHOP_PRICE_LIFE) return;

        session.spent += CFG.SHOP_PRICE_LIFE;
        session.boughtLife = true;
        updateShopUI();
    }

    function buyWeapon() {
        if (session.boughtWeapon) return;
        var balance = session.score - session.spent;
        if (balance < CFG.SHOP_PRICE_WEAPON) return;

        session.spent += CFG.SHOP_PRICE_WEAPON;
        session.boughtWeapon = true;
        updateShopUI();
    }

    // ------------------------------------------------------------
    // --- Отправка счёта -----------------------------------------
    // ------------------------------------------------------------

    function saveScore(name, score, duration) {
        var payload = {
            name: name,
            score: score,
            duration: duration || 0,
            screen_width: window.screen ? window.screen.width : 0,
            screen_height: window.screen ? window.screen.height : 0,
        };

        return fetch(CFG.API_URL, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify(payload),
        })
        .then(function (r) { return r.json().then(function (d) { return { httpOk: r.ok, data: d }; }); })
        .catch(function () { return { httpOk: false, data: { ok: false, message: 'Ошибка сети' } }; });
    }

    function flushSessionScore() {
        if (session.scoreSent) return Promise.resolve(null);
        session.scoreSent = true;

        var name = loadSavedName() || 'Игрок';
        var finalScore = Math.max(0, session.score - session.spent);

        return saveScore(name, finalScore, session.duration).then(function (res) {
            if (res.data && res.data.ok) {
                renderLeaderboard(els.endLbList, res.data.scores, name);
            }
            return res;
        });
    }

    // ------------------------------------------------------------
    // --- Пауза --------------------------------------------------
    // ------------------------------------------------------------

    function pauseGame(game) {
        if (!game.running || isPaused) return;
        isPaused = true;
        pauseStartedAt = Date.now();
        game.stop();

        if (els.pauseOverlay) {
            els.pauseOverlay.classList.remove('is-hidden');
            updatePauseTimer();
        }
    }

    function resumeGame(game) {
        if (!isPaused) return;
        var pauseEnded = Date.now();
        isPaused = false;

        game._gameStartTime += pauseEnded - pauseStartedAt;

        if (els.pauseOverlay) els.pauseOverlay.classList.add('is-hidden');

        game.running = true;
        game.lastTs = 0;
        game.animId = requestAnimationFrame(game._boundLoop);

        if (els.pauseTimer) els.pauseTimer.textContent = '0 сек';
    }

    function updatePauseTimer() {
        if (!els.pauseTimer) return;
        var el = els.pauseTimer;
        var tick = function () {
            if (!isPaused) return;
            var sec = Math.floor((Date.now() - pauseStartedAt) / 1000);
            el.textContent = sec + ' сек';
            setTimeout(tick, 250);
        };
        tick();
    }

    // ------------------------------------------------------------
    // --- Кнопка огня --------------------------------------------
    // ------------------------------------------------------------
    // ИСПРАВЛЕНО: убрана строка this.fireHeld = false; из ветки else.
    // Она сбрасывала состояние стрельбы каждый кадр и ломала
    // стрельбу на десктопе после подбора звезды.
    // ------------------------------------------------------------

    function bindFireButton(game) {
        if (!els.fireBtn) return;

        var origUpdateWeapon = Game.prototype._updateHudWeapon;
        Game.prototype._updateHudWeapon = function () {
            origUpdateWeapon.call(this);
            if (!els.fireBtn) return;

            if (this.weaponActive && IS_MOBILE) {
                els.fireBtn.classList.add('is-active');
            } else {
                els.fireBtn.classList.remove('is-active');
                els.fireBtn.classList.remove('is-pressed');
                // ⚠️ УБРАНО: this.fireHeld = false;
                // Стрельба проверяется через this.weaponActive в _updateWeapon.
            }
        };

        els.fireBtn.addEventListener('touchstart', function (e) {
            e.preventDefault();
            if (!game.weaponActive) return;
            game.fireHeld = true;
            this.classList.add('is-pressed');
        }, { passive: false });

        els.fireBtn.addEventListener('touchend', function (e) {
            e.preventDefault();
            game.fireHeld = false;
            this.classList.remove('is-pressed');
        }, { passive: false });

        els.fireBtn.addEventListener('touchcancel', function () {
            game.fireHeld = false;
            this.classList.remove('is-pressed');
        });

        els.fireBtn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            if (!game.weaponActive) return;
            game.fireHeld = true;
            this.classList.add('is-pressed');
        });
        els.fireBtn.addEventListener('mouseup', function () {
            game.fireHeld = false;
            this.classList.remove('is-pressed');
        });
        els.fireBtn.addEventListener('mouseleave', function () {
            game.fireHeld = false;
            this.classList.remove('is-pressed');
        });
    }
    // ------------------------------------------------------------
    // --- Инициализация UI ---------------------------------------
    // ------------------------------------------------------------

    function initUI(game) {
        cacheElements();

        document.body.classList.add('starfall-page');

        var savedName = loadSavedName();
        if (savedName && els.nameInput) els.nameInput.value = savedName;

        // === Вибрация ===
        var vibroSupported = isVibroSupported();
        game.vibroEnabled = vibroSupported && loadVibroEnabled();

        if (!vibroSupported && els.vibroRow) {
            els.vibroRow.style.display = 'none';
        }
        if (els.vibroToggle) {
            els.vibroToggle.checked = game.vibroEnabled;
            if (!vibroSupported) els.vibroToggle.disabled = true;
        }

        var savedMode = loadControlMode();
        if (savedMode) {
            game.setControlMode(savedMode);
        }

        var buffsAtStart = loadBuffs();
        if (buffsAtStart.extraLives > 0 || buffsAtStart.weapon) {
            var hint = [];
            if (buffsAtStart.extraLives > 0) hint.push('❤️ +' + buffsAtStart.extraLives + ' жизнь');
            if (buffsAtStart.weapon) hint.push('🔫 оружие');
            var buffInfo = document.createElement('div');
            buffInfo.style.cssText = 'margin: 0.5rem 0 1rem; padding: 0.5rem 1rem; background: rgba(255,210,128,0.15); border: 1px solid rgba(255,210,128,0.35); border-radius: 12px; color: #FFD280; font-weight: 700; font-size: 0.85rem; text-align: center;';
            buffInfo.textContent = '🎁 Куплено: ' + hint.join(' · ');
            if (els.startBtn && els.startBtn.parentNode) {
                els.startBtn.parentNode.insertBefore(buffInfo, els.startBtn);
            }
        }

        function startGameFromUI() {
            hideStartOverlay();
            if (els.controlsOverlay) els.controlsOverlay.classList.add('is-hidden');
            applyBuffsToGame(game);
            game.start();
            if (els.fireBtn && game.weaponActive) {
                els.fireBtn.classList.add('is-active');
            }
        }

        els.startBtn.addEventListener('click', function () {
            var name = els.nameInput.value.trim();
            var v = validateName(name);
            if (!v.ok) {
                els.nameError.textContent = v.msg;
                els.nameInput.classList.add('is-error');
                setTimeout(function () { els.nameInput.classList.remove('is-error'); }, 450);
                return;
            }

            els.nameError.textContent = '';
            saveName(v.name);

            if (IS_MOBILE && !loadControlMode()) {
                showControlsOverlay();
                return;
            }

            startGameFromUI();
        });

        els.nameInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') els.startBtn.click();
        });

        document.querySelectorAll('.starfall-choice-card').forEach(function (card) {
            card.addEventListener('click', function () {
                var mode = this.dataset.mode;
                saveControlMode(mode);
                game.setControlMode(mode);

                setTimeout(function () {
                    startGameFromUI();
                }, 200);
            });
        });

        if (els.controlsBackBtn) {
            els.controlsBackBtn.addEventListener('click', function () {
                hideControlsOverlay();
            });
        }

        if (els.settingsBtn) {
            els.settingsBtn.addEventListener('click', function () {
                showSettingsOverlay(game);
            });
        }

        if (els.settingsCloseBtn) {
            els.settingsCloseBtn.addEventListener('click', function () {
                hideSettingsOverlay(game);
            });
        }

        document.querySelectorAll('.starfall-choice-mini').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var mode = this.dataset.mode;
                saveControlMode(mode);
                game.setControlMode(mode);
                updateControlButtons(game);
            });
        });

        if (els.vibroToggle) {
            els.vibroToggle.addEventListener('change', function () {
                game.vibroEnabled = this.checked;
                saveVibroEnabled(this.checked);
            });
        }

        if (els.closeBtn) {
            els.closeBtn.addEventListener('click', function () {
                game.stop();
                els.stage.classList.add('is-hidden');
                document.body.classList.remove('starfall-page');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        bindFireButton(game);

        els.playAgainBtn.addEventListener('click', function () {
            flushSessionScore();

            var buffsToSave = { extraLives: 0, weapon: false };
            if (session.boughtLife) buffsToSave.extraLives = 1;
            if (session.boughtWeapon) buffsToSave.weapon = true;
            if (buffsToSave.extraLives > 0 || buffsToSave.weapon) {
                saveBuffs(buffsToSave);
            }

            els.endOverlay.classList.add('is-hidden');

            applyBuffsToGame(game);
            game.start();

            if (els.fireBtn && game.weaponActive) {
                els.fireBtn.classList.add('is-active');
            }

            session.score = 0;
            session.spent = 0;
            session.boughtLife = false;
            session.boughtWeapon = false;
            session.scoreSent = false;
        });

        if (els.endHomeBtn) {
            els.endHomeBtn.addEventListener('click', function () {
                flushSessionScore().then(function () {
                    setTimeout(function () { window.location.href = '/'; }, 150);
                });
            });
        }

        if (els.buyLife) {
            els.buyLife.addEventListener('click', function () { buyLife(); });
        }
        if (els.buyWeapon) {
            els.buyWeapon.addEventListener('click', function () { buyWeapon(); });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' || e.key === 'Esc') {
                if (game.running && !isPaused) {
                    pauseGame(game);
                    e.preventDefault();
                } else if (isPaused && els.pauseOverlay && !els.pauseOverlay.classList.contains('is-hidden')) {
                    resumeGame(game);
                    e.preventDefault();
                }
            }
        });

        if (els.resumeBtn) {
            els.resumeBtn.addEventListener('click', function () { resumeGame(game); });
        }
        if (els.restartBtn) {
            els.restartBtn.addEventListener('click', function () {
                isPaused = false;
                if (els.pauseOverlay) els.pauseOverlay.classList.add('is-hidden');
                game._gameStartTime = Date.now();
                game.restart();
            });
        }
        if (els.homeBtn) {
            els.homeBtn.addEventListener('click', function () {
                window.location.href = '/';
            });
        }

        if (els.pauseOverlay) {
            els.pauseOverlay.addEventListener('click', function (e) {
                if (e.target === els.pauseOverlay) resumeGame(game);
            });
        }

        bindLeaderboardTabs(els.startLbTabs, els.startLbList, loadSavedName());
        bindLeaderboardTabs(els.endLbTabs, els.endLbList, loadSavedName());

        bindEasterEggClicks(els.startLbList);
        bindEasterEggClicks(els.endLbList);

        loadLeaderboardInto(els.startLbList, 'week', loadSavedName());

        showStartOverlay();

        game._onGameOverCallback = function (score, level, duration) {
            showEndOverlay(score, level, duration);
            if (els.fireBtn) els.fireBtn.classList.remove('is-active');
        };

        window.addEventListener('beforeunload', function () {
            if (!session.scoreSent && session.score > 0) {
                var name = loadSavedName() || 'Игрок';
                var finalScore = Math.max(0, session.score - session.spent);
                session.scoreSent = true;

                try {
                    if (navigator.sendBeacon) {
                        var blob = new Blob([JSON.stringify({
                            name: name,
                            score: finalScore,
                            duration: session.duration,
                        })], { type: 'application/json' });
                        navigator.sendBeacon(CFG.API_URL, blob);
                    }
                } catch (e) {}
            }
        });
    }

    // ============================================================
    // === АВТОИНИЦИАЛИЗАЦИЯ ======================================
    // ============================================================

    document.addEventListener('DOMContentLoaded', function () {
        var stage = document.querySelector('.starfall-stage');
        if (!stage) return;

        // Загружаем спрайты ДО старта игры
        var spritesReady = window.FestaSprites
            ? window.FestaSprites.load()
            : Promise.resolve();

        spritesReady.then(function () {
            var game = window.FestaStarfall.init(stage);
            if (!game) return;

            initUI(game);
        });
    });

})();