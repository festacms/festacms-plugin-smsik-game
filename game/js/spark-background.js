/**
 * FestaCMS — Спарк: Космическая Доставка
 * Космический фон: туманности, планеты, кометы
 *
 * v0.6.1:
 *   - Модуль фона
 *   - Туманности (радиальные градиенты)
 *   - Планеты (разные цвета и размеры)
 *   - Кометы (пролетают редко)
 */

(function () {
    'use strict';

    var SmsikGame = window.SmsikGame = window.SmsikGame || {};

    var rand  = SmsikGame.utils.rand;
    var clamp = SmsikGame.utils.clamp;
    var pick  = SmsikGame.utils.pick;

    var IS_MOBILE = SmsikGame.IS_MOBILE;

    // ============================================================
    // === КОНФИГ ФОНА ============================================
    // ============================================================

    var BG_CFG = {
        NEBULA_COUNT: IS_MOBILE ? 2 : 4,
        PLANET_COUNT: IS_MOBILE ? 1 : 3,
        COMET_INTERVAL_MIN: 15 * 60,   // 15 секунд
        COMET_INTERVAL_MAX: 30 * 60,   // 30 секунд
    };

    // Палитры планет
    var PLANET_PALETTES = [
        { type: 'gas',    body: ['#3a3f80', '#5e63b0', '#8d92d8', '#b0b3e8'], ring: 'rgba(200, 200, 240, 0.55)' },
        { type: 'ice',    body: ['#0e5a5e', '#218278', '#64C8BD', '#a5e3dd'], ring: 'rgba(160, 230, 220, 0.5)'  },
        { type: 'desert', body: ['#8B6508', '#DAA520', '#F0C674', '#FBE5B8'], ring: null },
        { type: 'lava',   body: ['#4a0f14', '#8B1A1A', '#CD5C5C', '#F08080'], ring: null },
        { type: 'distant',body: ['#1a3a5c', '#4169E1', '#87CEEB', '#E8F4FF'], ring: null },
    ];

    // ============================================================
    // === МОДУЛЬ =================================================
    // ============================================================

    SmsikGame.Background = {

        app: null,
        W: 0,
        H: 0,
        layer: null,

        nebulas: [],
        planets: [],
        comets: [],

        _cometTimer: 0,

        // ============================================================
        // ИНИЦИАЛИЗАЦИЯ
        // ============================================================

        init: function (app, W, H) {
            this.app = app;
            this.W = W;
            this.H = H;

            // Отдельный контейнер для фона (лежит над bgSprite, но под игроками)
            this.layer = new PIXI.Container();
            app.stage.addChild(this.layer);

            this._createNebulas();
            this._createPlanets();
            this._cometTimer = rand(BG_CFG.COMET_INTERVAL_MIN, BG_CFG.COMET_INTERVAL_MAX);

            console.log('[Background] Фон создан:', this.nebulas.length, 'туманностей,', this.planets.length, 'планет');
        },

        // ============================================================
        // СОЗДАНИЕ ТУМАННОСТЕЙ
        // ============================================================

        _createNebulas: function () {
            this.nebulas = [];

            var nebPalettes = [
                { rgb: [60, 80, 180],  alpha: 0.10 },
                { rgb: [120, 60, 180], alpha: 0.09 },
                { rgb: [40, 130, 140], alpha: 0.08 },
                { rgb: [150, 60, 100], alpha: 0.07 },
                { rgb: [180, 100, 60], alpha: 0.06 },
            ];

            for (var i = 0; i < BG_CFG.NEBULA_COUNT; i++) {
                var pal = pick(nebPalettes);
                var radius = rand(this.W * 0.15, this.W * 0.35);

                var tex = this._createNebulaTexture(radius, pal.rgb, pal.alpha);
                var sprite = new PIXI.Sprite(tex);
                sprite.anchor.set(0.5);
                sprite.x = rand(-this.W * 0.1, this.W * 1.1);
                sprite.y = rand(-this.H * 0.1, this.H * 1.1);

                this.layer.addChild(sprite);

                this.nebulas.push({
                    sprite: sprite,
                    vx: rand(-0.05, 0.05),
                    vy: rand(-0.02, 0.02),
                    radius: radius,
                });
            }
        },

        _createNebulaTexture: function (radius, rgb, alpha) {
            var size = Math.ceil(radius * 2);
            var canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            var ctx = canvas.getContext('2d');

            var grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            grad.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')');
            grad.addColorStop(0.4, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (alpha * 0.6) + ')');
            grad.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');

            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, size, size);

            return PIXI.Texture.from(canvas);
        },

        // ============================================================
        // СОЗДАНИЕ ПЛАНЕТ
        // ============================================================

        _createPlanets: function () {
            this.planets = [];

            for (var i = 0; i < BG_CFG.PLANET_COUNT; i++) {
                var pal = pick(PLANET_PALETTES);
                var radius = pal.type === 'distant'
                    ? rand(15, 25)
                    : rand(40, 80);

                var tex = this._createPlanetTexture(radius, pal);
                var sprite = new PIXI.Sprite(tex);
                sprite.anchor.set(0.5);
                sprite.x = rand(-radius, this.W + radius);
                sprite.y = rand(this.H * 0.1, this.H * 0.65);

                this.layer.addChild(sprite);

                this.planets.push({
                    sprite: sprite,
                    radius: radius,
                    vx: rand(-0.08, 0.08),
                    vy: rand(0.01, 0.04),
                    rot: rand(0, Math.PI * 2),
                    rotSpeed: rand(-0.0005, 0.0005),
                });
            }
        },

        _createPlanetTexture: function (radius, pal) {
            var size = Math.ceil(radius * 2.6);
            var canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            var ctx = canvas.getContext('2d');

            ctx.translate(size / 2, size / 2);

            // Свечение
            var glow = ctx.createRadialGradient(0, 0, radius * 0.7, 0, 0, radius * 1.3);
            glow.addColorStop(0, 'rgba(' + this._hexToRgb(pal.body[2]) + ',0.3)');
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.beginPath();
            ctx.fillStyle = glow;
            ctx.arc(0, 0, radius * 1.3, 0, Math.PI * 2);
            ctx.fill();

            // Кольцо (сзади)
            if (pal.ring) {
                ctx.save();
                ctx.rotate(-0.3);
                ctx.scale(1, 0.25);
                ctx.beginPath();
                ctx.strokeStyle = pal.ring;
                ctx.lineWidth = 4;
                ctx.arc(0, 0, radius * 1.4, Math.PI, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // Основной круг планеты
            var bodyGrad = ctx.createRadialGradient(
                -radius * 0.3, -radius * 0.3, radius * 0.1,
                0, 0, radius
            );
            bodyGrad.addColorStop(0, pal.body[3]);
            bodyGrad.addColorStop(0.4, pal.body[2]);
            bodyGrad.addColorStop(0.75, pal.body[1]);
            bodyGrad.addColorStop(1, pal.body[0]);

            ctx.beginPath();
            ctx.fillStyle = bodyGrad;
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();

            // Тень сбоку
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.clip();

            var shadow = ctx.createRadialGradient(
                radius * 0.4, radius * 0.4, radius * 0.2,
                0, 0, radius
            );
            shadow.addColorStop(0, 'rgba(0,0,0,0)');
            shadow.addColorStop(0.7, 'rgba(0,0,0,0.15)');
            shadow.addColorStop(1, 'rgba(0,0,0,0.55)');
            ctx.fillStyle = shadow;
            ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
            ctx.restore();

            // Кольцо (спереди)
            if (pal.ring) {
                ctx.save();
                ctx.rotate(-0.3);
                ctx.scale(1, 0.25);
                ctx.beginPath();
                ctx.strokeStyle = pal.ring;
                ctx.lineWidth = 4;
                ctx.arc(0, 0, radius * 1.4, 0, Math.PI);
                ctx.stroke();
                ctx.restore();
            }

            return PIXI.Texture.from(canvas);
        },

        _hexToRgb: function (hex) {
            hex = hex.replace('#', '');
            var r = parseInt(hex.substr(0, 2), 16);
            var g = parseInt(hex.substr(2, 2), 16);
            var b = parseInt(hex.substr(4, 2), 16);
            return r + ',' + g + ',' + b;
        },

        // ============================================================
        // СОЗДАНИЕ КОМЕТЫ
        // ============================================================

        _spawnComet: function () {
            var fromLeft = Math.random() < 0.5;
            var startX = fromLeft ? rand(-50, this.W * 0.4) : rand(this.W * 0.6, this.W + 50);
            var angle = (fromLeft ? rand(30, 55) : rand(125, 150)) * Math.PI / 180;
            var speed = rand(3, 6);

            var cometColor = pick([0xFFD280, 0x64C8BD, 0xFB7E87, 0x8CC4FF]);

            // Тело кометы — светящийся круг
            var head = new PIXI.Graphics();
            head.beginFill(cometColor, 1);
            head.drawCircle(0, 0, rand(2, 3.5));
            head.endFill();

            // Свечение
            var glow = new PIXI.Graphics();
            glow.beginFill(cometColor, 0.3);
            glow.drawCircle(0, 0, 10);
            glow.endFill();

            head.x = startX;
            head.y = rand(-80, -20);
            glow.x = startX;
            glow.y = head.y;

            this.layer.addChild(glow);
            this.layer.addChild(head);

            this.comets.push({
                head: head,
                glow: glow,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: cometColor,
                trail: [],
                trailTimer: 0,
            });
        },

        // ============================================================
        // ОБНОВЛЕНИЕ
        // ============================================================

        update: function (k) {
            // Туманности
            for (var i = 0; i < this.nebulas.length; i++) {
                var n = this.nebulas[i];
                n.sprite.x += n.vx * k;
                n.sprite.y += n.vy * k;

                // Зациклить по границам
                if (n.sprite.x < -n.radius) n.sprite.x = this.W + n.radius;
                if (n.sprite.x > this.W + n.radius) n.sprite.x = -n.radius;
                if (n.sprite.y < -n.radius) n.sprite.y = this.H + n.radius;
                if (n.sprite.y > this.H + n.radius) n.sprite.y = -n.radius;
            }

            // Планеты
            for (var j = 0; j < this.planets.length; j++) {
                var p = this.planets[j];
                p.sprite.x += p.vx * k;
                p.sprite.y += p.vy * k;
                p.rot += p.rotSpeed * k;

                // Зациклить по вертикали
                if (p.sprite.y - p.radius > this.H) {
                    p.sprite.y = -p.radius;
                    p.sprite.x = rand(-p.radius, this.W + p.radius);
                    p.vx = rand(-0.08, 0.08);
                }
                if (p.sprite.x < -p.radius * 2) p.sprite.x = this.W + p.radius;
                if (p.sprite.x > this.W + p.radius * 2) p.sprite.x = -p.radius;
            }

            // Кометы
            this._cometTimer -= k;
            if (this._cometTimer <= 0) {
                this._spawnComet();
                this._cometTimer = rand(BG_CFG.COMET_INTERVAL_MIN, BG_CFG.COMET_INTERVAL_MAX);
            }

            for (var c = this.comets.length - 1; c >= 0; c--) {
                var comet = this.comets[c];
                comet.head.x += comet.vx * k;
                comet.head.y += comet.vy * k;
                comet.glow.x = comet.head.x;
                comet.glow.y = comet.head.y;

                // След (частицы)
                comet.trailTimer -= k;
                if (comet.trailTimer <= 0 && !IS_MOBILE) {
                    comet.trailTimer = 2;
                    var trailParticle = new PIXI.Graphics();
                    trailParticle.beginFill(comet.color, 0.6);
                    trailParticle.drawCircle(0, 0, rand(1, 2));
                    trailParticle.endFill();
                    trailParticle.x = comet.head.x;
                    trailParticle.y = comet.head.y;
                    trailParticle._life = 1;
                    this.layer.addChild(trailParticle);
                    comet.trail.push(trailParticle);
                }

                // Обновление следа
                for (var t = comet.trail.length - 1; t >= 0; t--) {
                    var tp = comet.trail[t];
                    tp._life -= 0.03 * k;
                    tp.alpha = tp._life * 0.6;
                    tp.scale.set(tp._life);
                    if (tp._life <= 0) {
                        this.layer.removeChild(tp);
                        tp.destroy();
                        comet.trail.splice(t, 1);
                    }
                }

                // Удаление кометы
                if (comet.head.y > this.H + 100 ||
                    comet.head.x < -100 ||
                    comet.head.x > this.W + 100) {
                    for (var tt = 0; tt < comet.trail.length; tt++) {
                        if (comet.trail[tt].parent) {
                            this.layer.removeChild(comet.trail[tt]);
                        }
                        comet.trail[tt].destroy();
                    }
                    this.layer.removeChild(comet.head);
                    comet.head.destroy();
                    this.layer.removeChild(comet.glow);
                    comet.glow.destroy();
                    this.comets.splice(c, 1);
                }
            }
        }
    };

    console.log('[Background] Модуль загружен (v0.6.1)');

})();