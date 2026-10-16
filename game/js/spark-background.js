/**
 * FestaCMS — Спарк: Космическая Доставка
 * Космический фон: реалистичные туманности, планеты, кометы
 *
 * v0.7.0:
 *   - Многослойные туманности (40+ пятен с шумом и звёздочками)
 *   - Планеты с континентами, облаками, атмосферой и тенями
 *   - Кометы с длинным хвостом
 *   - Разные палитры для каждой туманности
 */

(function () {
    'use strict';

    var SmsikGame = window.SmsikGame = window.SmsikGame || {};

    var rand  = SmsikGame.utils.rand;
    var clamp = SmsikGame.utils.clamp;
    var pick  = SmsikGame.utils.pick;

    var IS_MOBILE = SmsikGame.IS_MOBILE;

    // ============================================================
    // === КОНФИГ =================================================
    // ============================================================

    var BG_CFG = {
        NEBULA_COUNT: IS_MOBILE ? 3 : 5,
        PLANET_COUNT: IS_MOBILE ? 2 : 4,
        COMET_INTERVAL_MIN: 12 * 60,
        COMET_INTERVAL_MAX: 25 * 60,
        NEBULA_TEX_SIZE: IS_MOBILE ? 256 : 512,
    };

    // Палитры для туманностей (как в реальном космосе)
    var NEBULA_PALETTES = [
        // Водородно-красная (как Туманность Ориона)
        {
            name: 'hydrogen',
            colors: [
                [255, 100, 100],
                [255, 150, 200],
                [200, 60, 120],
                [180, 40, 100]
            ],
            starColor: 0xffd0e0
        },
        // Кислородно-бирюзовая (как NGC 7000)
        {
            name: 'oxygen',
            colors: [
                [100, 220, 220],
                [64, 200, 189],
                [40, 140, 200],
                [120, 200, 255]
            ],
            starColor: 0xb8ebe4
        },
        // Фиолетово-розовая (как Туманность Бабочка)
        {
            name: 'violet',
            colors: [
                [180, 100, 255],
                [140, 60, 200],
                [255, 120, 200],
                [100, 40, 180]
            ],
            starColor: 0xd0b8ff
        },
        // Золотая (пыль)
        {
            name: 'gold',
            colors: [
                [255, 210, 128],
                [240, 160, 80],
                [255, 180, 100],
                [200, 130, 60]
            ],
            starColor: 0xffe0a0
        },
        // Глубокий синий (как Туманность Вуаль)
        {
            name: 'deep_blue',
            colors: [
                [80, 140, 255],
                [60, 100, 200],
                [140, 200, 255],
                [40, 80, 180]
            ],
            starColor: 0xa0c8ff
        }
    ];

    // Палитры планет
    var PLANET_PALETTES = [
        // Землеподобная
        {
            type: 'terran',
            base: ['#1a3a5c', '#2d6ba8', '#4a9fd8'],
            land: ['#2d5a2d', '#4a8a3a', '#7db87a'],
            cloud: '#ffffff',
            atmosphere: '#88c8ff',
            hasRing: false
        },
        // Газовый гигант (как Юпитер)
        {
            type: 'gas',
            base: ['#5c3a1a', '#a8784a', '#d8a870', '#e8c898'],
            land: null,
            cloud: 'rgba(255,240,220,0.4)',
            atmosphere: '#ffd8a0',
            hasRing: true,
            ringColor: 'rgba(220, 180, 140, 0.7)'
        },
        // Ледяная
        {
            type: 'ice',
            base: ['#0e5a5e', '#218278', '#64C8BD', '#a5e3dd'],
            land: null,
            cloud: 'rgba(255,255,255,0.5)',
            atmosphere: '#a5e3dd',
            hasRing: false
        },
        // Пустынная (как Марс)
        {
            type: 'desert',
            base: ['#5c2010', '#8B3A1A', '#c66a3a', '#d89060'],
            land: ['#7a2818', '#a04828'],
            cloud: null,
            atmosphere: '#ff8050',
            hasRing: false
        },
        // Лавовая
        {
            type: 'lava',
            base: ['#4a0f14', '#8B1A1A', '#CD5C5C', '#F08080'],
            land: ['#ff6020', '#ff8040'],
            cloud: null,
            atmosphere: '#ff6030',
            hasRing: false
        },
        // Пурпурная (как Венера)
        {
            type: 'purple',
            base: ['#3a1a4a', '#6b3a8a', '#a06bc0', '#d0a0e8'],
            land: ['#5a2a7a', '#8040a0'],
            cloud: 'rgba(220,200,240,0.4)',
            atmosphere: '#c090e0',
            hasRing: false
        }
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

            this.layer = new PIXI.Container();
            app.stage.addChild(this.layer);

            this._createNebulas();
            this._createPlanets();
            this._cometTimer = rand(BG_CFG.COMET_INTERVAL_MIN, BG_CFG.COMET_INTERVAL_MAX);

            console.log('[Background] Фон создан:', this.nebulas.length, 'туманностей,', this.planets.length, 'планет');
        },

        // ============================================================
        // ТУМАННОСТИ — многослойные, реалистичные
        // ============================================================

        _createNebulas: function () {
            this.nebulas = [];
            var usedPalettes = [];

            for (var i = 0; i < BG_CFG.NEBULA_COUNT; i++) {
                // Берём палитру, которой ещё не было (для разнообразия)
                var available = NEBULA_PALETTES.filter(function (p) {
                    return usedPalettes.indexOf(p.name) === -1;
                });
                if (available.length === 0) available = NEBULA_PALETTES;

                var pal = pick(available);
                usedPalettes.push(pal.name);

                var size = rand(this.W * 0.35, this.W * 0.65);
                var tex = this._createNebulaTexture(size, pal);
                var sprite = new PIXI.Sprite(tex);
                sprite.anchor.set(0.5);
                sprite.alpha = rand(0.55, 0.85);  // ← ЯРКОСТЬ! Было 0.1 — стало 0.55–0.85
                sprite.x = rand(-this.W * 0.15, this.W * 1.15);
                sprite.y = rand(-this.H * 0.15, this.H * 1.15);

                this.layer.addChild(sprite);

                this.nebulas.push({
                    sprite: sprite,
                    vx: rand(-0.08, 0.08),
                    vy: rand(-0.04, 0.04),
                    size: size
                });
            }
        },

        _createNebulaTexture: function (size, pal) {
            var canvas = document.createElement('canvas');
            canvas.width = BG_CFG.NEBULA_TEX_SIZE;
            canvas.height = BG_CFG.NEBULA_TEX_SIZE;
            var ctx = canvas.getContext('2d');
            var S = BG_CFG.NEBULA_TEX_SIZE;

            // Работаем в режиме "lighter" — наложение с яркостью
            ctx.globalCompositeOperation = 'lighter';

            // === Слой 1: Большие размытые пятна (основа) ===
            var baseBlobs = 25;
            for (var b = 0; b < baseBlobs; b++) {
                var col = pick(pal.colors);
                var cx = rand(S * 0.2, S * 0.8);
                var cy = rand(S * 0.2, S * 0.8);
                var r = rand(S * 0.15, S * 0.35);
                var a = rand(0.05, 0.12);

                var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
                grad.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + a + ')');
                grad.addColorStop(0.5, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (a * 0.5) + ')');
                grad.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0)');

                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, S, S);
            }

            // === Слой 2: Мелкие яркие сгустки (структура) ===
            var brightBlobs = 40;
            for (var s = 0; s < brightBlobs; s++) {
                var col2 = pick(pal.colors);
                var sx = rand(S * 0.25, S * 0.75);
                var sy = rand(S * 0.25, S * 0.75);
                var sr = rand(S * 0.03, S * 0.12);
                var sa = rand(0.15, 0.35);

                var grad2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
                grad2.addColorStop(0, 'rgba(' + col2[0] + ',' + col2[1] + ',' + col2[2] + ',' + sa + ')');
                grad2.addColorStop(1, 'rgba(' + col2[0] + ',' + col2[1] + ',' + col2[2] + ',0)');

                ctx.fillStyle = grad2;
                ctx.beginPath();
                ctx.arc(sx, sy, sr, 0, Math.PI * 2);
                ctx.fill();
            }

            // === Слой 3: Волокна (длинные тонкие структуры) ===
            var filaments = 15;
            ctx.lineCap = 'round';
            for (var f = 0; f < filaments; f++) {
                var col3 = pick(pal.colors);
                var x1 = rand(S * 0.2, S * 0.8);
                var y1 = rand(S * 0.2, S * 0.8);
                var angle = Math.random() * Math.PI * 2;
                var len = rand(S * 0.1, S * 0.3);

                var grad3 = ctx.createLinearGradient(x1, y1, x1 + Math.cos(angle) * len, y1 + Math.sin(angle) * len);
                grad3.addColorStop(0, 'rgba(' + col3[0] + ',' + col3[1] + ',' + col3[2] + ',0)');
                grad3.addColorStop(0.5, 'rgba(' + col3[0] + ',' + col3[1] + ',' + col3[2] + ',0.2)');
                grad3.addColorStop(1, 'rgba(' + col3[0] + ',' + col3[1] + ',' + col3[2] + ',0)');

                ctx.strokeStyle = grad3;
                ctx.lineWidth = rand(2, 8);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x1 + Math.cos(angle) * len, y1 + Math.sin(angle) * len);
                ctx.stroke();
            }

            // === Слой 4: Звёздочки внутри туманности ===
            var stars = 30;
            for (var st = 0; st < stars; st++) {
                var sx2 = rand(S * 0.2, S * 0.8);
                var sy2 = rand(S * 0.2, S * 0.8);
                var sr2 = rand(1, 2.5);
                var sa2 = rand(0.4, 0.9);

                // Светящаяся обводка
                var grad4 = ctx.createRadialGradient(sx2, sy2, 0, sx2, sy2, sr2 * 6);
                grad4.addColorStop(0, 'rgba(255,255,255,' + sa2 + ')');
                grad4.addColorStop(0.3, 'rgba(255,255,255,' + (sa2 * 0.3) + ')');
                grad4.addColorStop(1, 'rgba(255,255,255,0)');

                ctx.fillStyle = grad4;
                ctx.beginPath();
                ctx.arc(sx2, sy2, sr2 * 6, 0, Math.PI * 2);
                ctx.fill();

                // Яркая точка
                ctx.fillStyle = 'rgba(255,255,255,' + sa2 + ')';
                ctx.beginPath();
                ctx.arc(sx2, sy2, sr2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Сбросим режим
            ctx.globalCompositeOperation = 'source-over';

            return PIXI.Texture.from(canvas);
        },

        // ============================================================
        // ПЛАНЕТЫ — с континентами, облаками, атмосферой
        // ============================================================

        _createPlanets: function () {
            this.planets = [];
            var usedTypes = [];

            for (var i = 0; i < BG_CFG.PLANET_COUNT; i++) {
                var available = PLANET_PALETTES.filter(function (p) {
                    return usedTypes.indexOf(p.type) === -1;
                });
                if (available.length === 0) available = PLANET_PALETTES;

                var pal = pick(available);
                usedTypes.push(pal.type);

                var radius = rand(45, 110);
                var tex = this._createPlanetTexture(radius, pal);
                var sprite = new PIXI.Sprite(tex);
                sprite.anchor.set(0.5);
                sprite.x = rand(-radius, this.W + radius);
                sprite.y = rand(this.H * 0.05, this.H * 0.7);
                sprite.alpha = rand(0.85, 1.0);

                this.layer.addChild(sprite);

                this.planets.push({
                    sprite: sprite,
                    radius: radius,
                    vx: rand(-0.08, 0.08),
                    vy: rand(0.01, 0.04),
                    rot: rand(0, Math.PI * 2),
                    rotSpeed: rand(-0.0004, 0.0004)
                });
            }
        },

        _createPlanetTexture: function (radius, pal) {
            // Размер холста с запасом для кольца и атмосферы
            var texSize = Math.ceil(radius * 3.2);
            var canvas = document.createElement('canvas');
            canvas.width = texSize;
            canvas.height = texSize;
            var ctx = canvas.getContext('2d');

            var cx = texSize / 2;
            var cy = texSize / 2;

            // ============================================================
            // 1. АТМОСФЕРНЫЙ ОРЕОЛ (внешний)
            // ============================================================
            var atmoGrad = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.5);
            atmoGrad.addColorStop(0, pal.atmosphere + '00');
            atmoGrad.addColorStop(0.4, pal.atmosphere + '40');
            atmoGrad.addColorStop(0.7, pal.atmosphere + '20');
            atmoGrad.addColorStop(1, pal.atmosphere + '00');
            ctx.fillStyle = atmoGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 1.5, 0, Math.PI * 2);
            ctx.fill();

            // ============================================================
            // 2. КОЛЬЦО СЗАДИ (если есть)
            // ============================================================
            if (pal.hasRing && pal.ringColor) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(-0.35);
                ctx.scale(1, 0.22);

                // Основное кольцо
                ctx.beginPath();
                ctx.arc(0, 0, radius * 1.7, Math.PI, Math.PI * 2);
                ctx.strokeStyle = pal.ringColor;
                ctx.lineWidth = radius * 0.18;
                ctx.stroke();

                // Дополнительные полосы
                for (var r = 0; r < 3; r++) {
                    ctx.beginPath();
                    var rOff = radius * (1.55 + r * 0.1);
                    ctx.arc(0, 0, rOff, Math.PI, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255,255,255,' + (0.15 - r * 0.04) + ')';
                    ctx.lineWidth = radius * 0.04;
                    ctx.stroke();
                }

                ctx.restore();
            }

            // ============================================================
            // 3. ОСНОВНОЙ КРУГ ПЛАНЕТЫ
            // ============================================================

            // Базовый градиент (свет сверху-слева)
            var bodyGrad = ctx.createRadialGradient(
                cx - radius * 0.35, cy - radius * 0.35, radius * 0.1,
                cx, cy, radius
            );
            bodyGrad.addColorStop(0, pal.base[pal.base.length - 1]);
            bodyGrad.addColorStop(0.4, pal.base[pal.base.length - 2] || pal.base[0]);
            bodyGrad.addColorStop(0.75, pal.base[pal.base.length - 3] || pal.base[0]);
            bodyGrad.addColorStop(1, pal.base[0]);

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = bodyGrad;
            ctx.fill();

            // ============================================================
            // 4. КОНТИНЕНТЫ / ПОЛОСЫ (внутри планеты)
            // ============================================================
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.clip();

            if (pal.type === 'gas') {
                // Газовый гигант — горизонтальные полосы
                var bands = 10;
                for (var b = 0; b < bands; b++) {
                    var by = cy - radius + (b * radius * 2 / bands);
                    var bh = (radius * 2) / bands;
                    var col = pal.base[b % pal.base.length];
                    ctx.fillStyle = col;
                    ctx.globalAlpha = rand(0.3, 0.7);
                    ctx.fillRect(cx - radius, by, radius * 2, bh);
                }

                // Пятно-шторм (как Красное Пятно Юпитера)
                ctx.globalAlpha = 0.6;
                var stormX = cx + rand(-radius * 0.4, radius * 0.4);
                var stormY = cy + rand(-radius * 0.3, radius * 0.3);
                var stormGrad = ctx.createRadialGradient(stormX, stormY, 0, stormX, stormY, radius * 0.3);
                stormGrad.addColorStop(0, pal.base[0]);
                stormGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = stormGrad;
                ctx.beginPath();
                ctx.ellipse(stormX, stormY, radius * 0.3, radius * 0.2, 0, 0, Math.PI * 2);
                ctx.fill();

            } else if (pal.land) {
                // Планета с континентами
                var continents = 8;
                for (var c = 0; c < continents; c++) {
                    var col2 = pick(pal.land);
                    var contX = cx + rand(-radius * 0.7, radius * 0.7);
                    var contY = cy + rand(-radius * 0.7, radius * 0.7);
                    var contR = rand(radius * 0.15, radius * 0.4);

                    // Неровное пятно — через несколько кругов
                    var pieces = 5;
                    for (var p = 0; p < pieces; p++) {
                        var px = contX + rand(-contR * 0.5, contR * 0.5);
                        var py = contY + rand(-contR * 0.5, contR * 0.5);
                        var pr = contR * rand(0.4, 0.8);
                        ctx.fillStyle = col2;
                        ctx.globalAlpha = rand(0.6, 0.9);
                        ctx.beginPath();
                        ctx.arc(px, py, pr, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            ctx.globalAlpha = 1;
            ctx.restore();

            // ============================================================
            // 5. ОБЛАКА
            // ============================================================
            if (pal.cloud) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.clip();

                var clouds = 12;
                for (var cl = 0; cl < clouds; cl++) {
                    var cloudX = cx + rand(-radius, radius);
                    var cloudY = cy + rand(-radius, radius);
                    var cloudR = rand(radius * 0.15, radius * 0.35);

                    ctx.fillStyle = pal.cloud;
                    ctx.globalAlpha = rand(0.15, 0.35);
                    ctx.beginPath();
                    ctx.ellipse(cloudX, cloudY, cloudR, cloudR * 0.4, rand(0, Math.PI), 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.globalAlpha = 1;
                ctx.restore();
            }

            // ============================================================
            // 6. ТЕНЬ (справа-снизу)
            // ============================================================
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.clip();

            var shadowGrad = ctx.createRadialGradient(
                cx + radius * 0.4, cy + radius * 0.4, radius * 0.2,
                cx + radius * 0.3, cy + radius * 0.3, radius * 1.4
            );
            shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
            shadowGrad.addColorStop(0.5, 'rgba(0,0,0,0.15)');
            shadowGrad.addColorStop(0.85, 'rgba(0,0,0,0.6)');
            shadowGrad.addColorStop(1, 'rgba(0,0,0,0.9)');

            ctx.fillStyle = shadowGrad;
            ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
            ctx.restore();

            // ============================================================
            // 7. БЛИК СВЕТА (сверху-слева)
            // ============================================================
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.clip();

            var highlightGrad = ctx.createRadialGradient(
                cx - radius * 0.4, cy - radius * 0.4, 0,
                cx - radius * 0.4, cy - radius * 0.4, radius * 0.9
            );
            highlightGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
            highlightGrad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
            highlightGrad.addColorStop(1, 'rgba(255,255,255,0)');

            ctx.fillStyle = highlightGrad;
            ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
            ctx.restore();

            // ============================================================
            // 8. КОЛЬЦО СПЕРЕДИ (если есть)
            // ============================================================
            if (pal.hasRing && pal.ringColor) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(-0.35);
                ctx.scale(1, 0.22);

                ctx.beginPath();
                ctx.arc(0, 0, radius * 1.7, 0, Math.PI);
                ctx.strokeStyle = pal.ringColor;
                ctx.lineWidth = radius * 0.18;
                ctx.stroke();

                for (var r2 = 0; r2 < 3; r2++) {
                    ctx.beginPath();
                    var rOff2 = radius * (1.55 + r2 * 0.1);
                    ctx.arc(0, 0, rOff2, 0, Math.PI);
                    ctx.strokeStyle = 'rgba(255,255,255,' + (0.2 - r2 * 0.05) + ')';
                    ctx.lineWidth = radius * 0.04;
                    ctx.stroke();
                }

                ctx.restore();
            }

            return PIXI.Texture.from(canvas);
        },

        // ============================================================
        // КОМЕТЫ
        // ============================================================

        _spawnComet: function () {
            var fromLeft = Math.random() < 0.5;
            var startX = fromLeft ? rand(-50, this.W * 0.4) : rand(this.W * 0.6, this.W + 50);
            var angle = (fromLeft ? rand(30, 55) : rand(125, 150)) * Math.PI / 180;
            var speed = rand(3, 6);

            var cometColor = pick([0xFFD280, 0x64C8BD, 0xFB7E87, 0x8CC4FF]);
            var cometColorRGB = this._hexToRGBArray(cometColor);

            // Создаём текстуру кометы (светящееся ядро)
            var canvas = document.createElement('canvas');
            canvas.width = 40;
            canvas.height = 40;
            var ctx = canvas.getContext('2d');
            var grad = ctx.createRadialGradient(20, 20, 0, 20, 20, 20);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(0.3, 'rgba(' + cometColorRGB + ',0.9)');
            grad.addColorStop(0.7, 'rgba(' + cometColorRGB + ',0.3)');
            grad.addColorStop(1, 'rgba(' + cometColorRGB + ',0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 40, 40);

            var tex = PIXI.Texture.from(canvas);
            var head = new PIXI.Sprite(tex);
            head.anchor.set(0.5);
            head.x = startX;
            head.y = rand(-80, -20);
            head.width = 24;
            head.height = 24;

            this.layer.addChild(head);

            this.comets.push({
                head: head,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: cometColor,
                trail: [],
                trailTimer: 0
            });
        },

        _hexToRGBArray: function (hex) {
            var r = (hex >> 16) & 0xff;
            var g = (hex >> 8) & 0xff;
            var b = hex & 0xff;
            return r + ',' + g + ',' + b;
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

                if (n.sprite.x < -n.size) n.sprite.x = this.W + n.size;
                if (n.sprite.x > this.W + n.size) n.sprite.x = -n.size;
                if (n.sprite.y < -n.size) n.sprite.y = this.H + n.size;
                if (n.sprite.y > this.H + n.size) n.sprite.y = -n.size;
            }

            // Планеты
            for (var j = 0; j < this.planets.length; j++) {
                var p = this.planets[j];
                p.sprite.x += p.vx * k;
                p.sprite.y += p.vy * k;
                p.rot += p.rotSpeed * k;
                // Планеты не вращаются (там сложная текстура), только сдвигаются

                if (p.sprite.y - p.radius * 1.5 > this.H) {
                    p.sprite.y = -p.radius * 1.5;
                    p.sprite.x = rand(-p.radius, this.W + p.radius);
                    p.vx = rand(-0.08, 0.08);
                }
                if (p.sprite.x < -p.radius * 2) p.sprite.x = this.W + p.radius * 2;
                if (p.sprite.x > this.W + p.radius * 2) p.sprite.x = -p.radius * 2;
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

                // След из частиц
                comet.trailTimer -= k;
                if (comet.trailTimer <= 0 && !IS_MOBILE) {
                    comet.trailTimer = 2;
                    var trailParticle = new PIXI.Graphics();
                    trailParticle.beginFill(comet.color, 0.6);
                    trailParticle.drawCircle(0, 0, rand(1, 2.5));
                    trailParticle.endFill();
                    trailParticle.x = comet.head.x;
                    trailParticle.y = comet.head.y;
                    trailParticle._life = 1;
                    this.layer.addChild(trailParticle);
                    comet.trail.push(trailParticle);
                }

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
                    this.comets.splice(c, 1);
                }
            }
        }
    };

    console.log('[Background] Модуль загружен (v0.7.0 — реалистичные туманности)');

})();