/**
 * FestaCMS — Спарк: Космическая Доставка
 * Космический фон: туманности (5 типов), планеты, кометы
 *
 * v0.8.1:
 *   - Радиальная маска для туманностей (нет квадратных краёв)
 *   - Планеты уменьшены (радиус 30–70, холст ×4)
 *   - Туманности меньше и прозрачнее
 */

(function () {
    'use strict';

    var SmsikGame = window.SmsikGame = window.SmsikGame || {};

    var rand  = SmsikGame.utils.rand;
    var clamp = SmsikGame.utils.clamp;
    var pick  = SmsikGame.utils.pick;

    var IS_MOBILE = SmsikGame.IS_MOBILE;

    var BG_CFG = {
        NEBULA_COUNT: IS_MOBILE ? 3 : 5,
        PLANET_COUNT: IS_MOBILE ? 2 : 4,
        COMET_INTERVAL_MIN: 12 * 60,
        COMET_INTERVAL_MAX: 25 * 60,
        NEBULA_TEX_SIZE: IS_MOBILE ? 512 : 768,
        PLANET_TEX_MUL: 4,
    };

    var NEBULA_PALETTES = [
        { name: 'hydrogen', colors: [[255,80,100],[255,140,180],[200,50,110],[255,180,140]], core: [255,220,220] },
        { name: 'oxygen',   colors: [[80,220,220],[64,200,189],[40,140,200],[140,220,255]], core: [220,255,255] },
        { name: 'violet',   colors: [[180,90,255],[140,50,200],[255,110,190],[100,40,180]], core: [240,220,255] },
        { name: 'gold',     colors: [[255,200,110],[240,150,70],[255,170,90],[200,120,50]], core: [255,240,200] },
        { name: 'deep_blue',colors: [[70,130,255],[50,90,200],[130,190,255],[30,70,170]],   core: [200,220,255] }
    ];

    var NEBULA_SHAPES = ['blob', 'spiral', 'filament', 'diffuse', 'wisp'];

    var PLANET_PALETTES = [
        { type: 'terran',  base: ['#0d2a4a', '#1a5080', '#3a8ac0', '#80c0e8'], land: ['#2a5a2a', '#3a7a3a', '#5a9a5a'], cloud: 'rgba(255,255,255,0.5)', atmosphere: 'rgba(120,190,255,0.6)', hasRing: false },
        { type: 'gas',     base: ['#5c3a1a', '#a8784a', '#d8a870', '#f0d0a0'], land: null, cloud: 'rgba(255,240,220,0.3)', atmosphere: 'rgba(255,200,140,0.5)', hasRing: true, ringColor: 'rgba(220,180,140,0.75)' },
        { type: 'ice',     base: ['#0a4a52', '#1a7288', '#40a8c0', '#a0dce8'], land: ['#d8f0f8', '#a8e0f0'], cloud: 'rgba(255,255,255,0.4)', atmosphere: 'rgba(140,230,240,0.6)', hasRing: false },
        { type: 'desert',  base: ['#4a1a0a', '#8a3a1a', '#c66a3a', '#e0a070'], land: ['#6a2010', '#9a4830'], cloud: null, atmosphere: 'rgba(255,140,80,0.5)', hasRing: false },
        { type: 'lava',    base: ['#3a0808', '#7a1010', '#c04040', '#f08080'], land: ['#ff5020', '#ff8040', '#ffb060'], cloud: null, atmosphere: 'rgba(255,90,40,0.6)', hasRing: false },
        { type: 'purple',  base: ['#2a0a3a', '#5a2a7a', '#9050b0', '#c890e0'], land: ['#4a1a6a', '#7038a0'], cloud: 'rgba(230,210,250,0.4)', atmosphere: 'rgba(190,130,230,0.55)', hasRing: false }
    ];

    SmsikGame.Background = {

        app: null,
        W: 0,
        H: 0,
        layer: null,

        nebulas: [],
        planets: [],
        comets: [],

        _cometTimer: 0,
        _usedNebulaPalettes: [],
        _usedNebulaShapes: [],
        _usedPlanetTypes: [],

        init: function (app, W, H) {
            this.app = app;
            this.W = W;
            this.H = H;

            this.layer = new PIXI.Container();
            this.layer.zIndex = 1;
            app.stage.addChild(this.layer);

            this._usedNebulaPalettes = [];
            this._usedNebulaShapes = [];
            this._usedPlanetTypes = [];

            this._createNebulas();
            this._createPlanets();
            this._cometTimer = rand(BG_CFG.COMET_INTERVAL_MIN, BG_CFG.COMET_INTERVAL_MAX);

            console.log('[Background] Фон создан:', this.nebulas.length, 'туманностей,', this.planets.length, 'планет');
        },

        _createNebulas: function () {
            this.nebulas = [];

            for (var i = 0; i < BG_CFG.NEBULA_COUNT; i++) {
                var pal = this._nextNebulaPalette();
                var shape = this._nextNebulaShape();

                var size = rand(this.W * 0.35, this.W * 0.55);
                var tex = this._createNebulaTexture(shape, pal);
                var sprite = new PIXI.Sprite(tex);
                sprite.anchor.set(0.5);
                sprite.alpha = rand(0.35, 0.55);
                sprite.x = rand(-this.W * 0.1, this.W * 1.1);
                sprite.y = rand(-this.H * 0.1, this.H * 1.1);
                sprite.width = size;
                sprite.height = size;

                this.layer.addChild(sprite);

                this.nebulas.push({
                    sprite: sprite,
                    vx: rand(-0.08, 0.08),
                    vy: rand(-0.04, 0.04),
                    size: size
                });

                console.log('[Background] Туманность:', shape, '/', pal.name);
            }
        },

        _nextNebulaPalette: function () {
            var available = NEBULA_PALETTES.filter(function (p) {
                return this._usedNebulaPalettes.indexOf(p.name) === -1;
            }.bind(this));
            if (available.length === 0) { this._usedNebulaPalettes = []; available = NEBULA_PALETTES; }
            var pal = pick(available);
            this._usedNebulaPalettes.push(pal.name);
            return pal;
        },

        _nextNebulaShape: function () {
            var available = NEBULA_SHAPES.filter(function (s) {
                return this._usedNebulaShapes.indexOf(s) === -1;
            }.bind(this));
            if (available.length === 0) { this._usedNebulaShapes = []; available = NEBULA_SHAPES; }
            var shape = pick(available);
            this._usedNebulaShapes.push(shape);
            return shape;
        },

        _createNebulaTexture: function (shape, pal) {
            var S = BG_CFG.NEBULA_TEX_SIZE;
            var canvas = document.createElement('canvas');
            canvas.width = S;
            canvas.height = S;
            var ctx = canvas.getContext('2d');

            ctx.globalCompositeOperation = 'lighter';

            switch (shape) {
                case 'blob':     this._drawNebulaBlob(ctx, S, pal); break;
                case 'spiral':   this._drawNebulaSpiral(ctx, S, pal); break;
                case 'filament': this._drawNebulaFilament(ctx, S, pal); break;
                case 'diffuse':  this._drawNebulaDiffuse(ctx, S, pal); break;
                case 'wisp':     this._drawNebulaWisp(ctx, S, pal); break;
                default:         this._drawNebulaBlob(ctx, S, pal);
            }

            this._drawNebulaStars(ctx, S, pal);

            // === РАДИАЛЬНАЯ МАСКА (главный фикс!) ===
            // Затухание к краям — убирает квадратные границы
            ctx.globalCompositeOperation = 'destination-in';
            var mask = ctx.createRadialGradient(S/2, S/2, S * 0.1, S/2, S/2, S * 0.5);
            mask.addColorStop(0, 'rgba(0,0,0,1)');
            mask.addColorStop(0.6, 'rgba(0,0,0,0.85)');
            mask.addColorStop(0.85, 'rgba(0,0,0,0.3)');
            mask.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = mask;
            ctx.fillRect(0, 0, S, S);

            ctx.globalCompositeOperation = 'source-over';
            return PIXI.Texture.from(canvas);
        },

        _drawNebulaBlob: function (ctx, S, pal) {
            var cx = S / 2, cy = S / 2;
            var coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.3);
            coreGrad.addColorStop(0, 'rgba(' + pal.core[0] + ',' + pal.core[1] + ',' + pal.core[2] + ',0.6)');
            coreGrad.addColorStop(0.4, 'rgba(' + pal.colors[1][0] + ',' + pal.colors[1][1] + ',' + pal.colors[1][2] + ',0.4)');
            coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = coreGrad;
            ctx.fillRect(0, 0, S, S);

            for (var i = 0; i < 40; i++) {
                var col = pick(pal.colors);
                var x = cx + rand(-S * 0.28, S * 0.28);
                var y = cy + rand(-S * 0.28, S * 0.28);
                var r = rand(S * 0.04, S * 0.15);
                var a = rand(0.08, 0.22);
                var grad = ctx.createRadialGradient(x, y, 0, x, y, r);
                grad.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + a + ')');
                grad.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        },

        _drawNebulaSpiral: function (ctx, S, pal) {
            var cx = S / 2, cy = S / 2;
            var arms = 2 + Math.floor(Math.random() * 2);
            var turns = rand(1.5, 2.5);

            for (var arm = 0; arm < arms; arm++) {
                var startAngle = (arm / arms) * Math.PI * 2;
                var points = 150;
                for (var i = 0; i < points; i++) {
                    var t = i / points;
                    var angle = startAngle + t * turns * Math.PI * 2;
                    var radius = t * S * 0.4;
                    var x = cx + Math.cos(angle) * radius;
                    var y = cy + Math.sin(angle) * radius;
                    var col = pick(pal.colors);
                    var blobR = S * (0.03 + (1 - t) * 0.05) * rand(0.7, 1.3);
                    var alpha = rand(0.1, 0.25) * (1 - t * 0.5);
                    var grad = ctx.createRadialGradient(x, y, 0, x, y, blobR);
                    grad.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + alpha + ')');
                    grad.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(x, y, blobR, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            var coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.12);
            coreGrad.addColorStop(0, 'rgba(' + pal.core[0] + ',' + pal.core[1] + ',' + pal.core[2] + ',0.7)');
            coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = coreGrad;
            ctx.fillRect(0, 0, S, S);
        },

        _drawNebulaFilament: function (ctx, S, pal) {
            var strands = 8;
            for (var s = 0; s < strands; s++) {
                var startX = rand(S * 0.2, S * 0.8);
                var startY = rand(S * 0.2, S * 0.8);
                var angle = Math.random() * Math.PI * 2;
                var length = rand(S * 0.25, S * 0.45);
                var steps = 40;
                var wobble = rand(0.3, 0.8);

                for (var i = 0; i < steps; i++) {
                    var t = i / steps;
                    var wobbleAngle = angle + Math.sin(t * Math.PI * 4) * wobble;
                    var x = startX + Math.cos(wobbleAngle) * length * t;
                    var y = startY + Math.sin(wobbleAngle) * length * t;
                    var col = pick(pal.colors);
                    var r = rand(S * 0.015, S * 0.04) * (1 - t * 0.6);
                    var alpha = rand(0.15, 0.3) * (1 - t * 0.5);
                    var grad = ctx.createRadialGradient(x, y, 0, x, y, r);
                    grad.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + alpha + ')');
                    grad.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        },

        _drawNebulaDiffuse: function (ctx, S, pal) {
            for (var i = 0; i < 100; i++) {
                var col = pick(pal.colors);
                var x = rand(S * 0.15, S * 0.85);
                var y = rand(S * 0.15, S * 0.85);
                var d = Math.sqrt(Math.pow(x - S/2, 2) + Math.pow(y - S/2, 2));
                var centerFade = 1 - (d / (S * 0.5));
                if (centerFade < 0) centerFade = 0;
                var r = rand(S * 0.05, S * 0.12);
                var a = rand(0.03, 0.1) * (0.5 + centerFade * 0.5);
                var grad = ctx.createRadialGradient(x, y, 0, x, y, r);
                grad.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + a + ')');
                grad.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        },

        _drawNebulaWisp: function (ctx, S, pal) {
            var wisps = 6;
            for (var w = 0; w < wisps; w++) {
                var baseX = rand(S * 0.25, S * 0.75);
                var baseY = rand(S * 0.25, S * 0.75);
                var baseAngle = Math.random() * Math.PI * 2;
                var points = 60;
                var length = rand(S * 0.15, S * 0.35);
                ctx.lineCap = 'round';
                var col = pick(pal.colors);

                for (var i = 0; i < points; i++) {
                    var t = i / points;
                    var wobble = Math.sin(t * Math.PI * 6 + w) * 0.5;
                    var angle = baseAngle + wobble;
                    var x = baseX + Math.cos(angle) * length * t;
                    var y = baseY + Math.sin(angle) * length * t;
                    var lineWidth = rand(S * 0.004, S * 0.015);
                    var alpha = rand(0.15, 0.35) * (1 - t * 0.3);
                    ctx.beginPath();
                    ctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + alpha + ')';
                    ctx.lineWidth = lineWidth;
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + Math.cos(angle) * 5, y + Math.sin(angle) * 5);
                    ctx.stroke();
                }
            }
        },

        _drawNebulaStars: function (ctx, S, pal) {
            for (var i = 0; i < 25; i++) {
                var x = rand(S * 0.2, S * 0.8);
                var y = rand(S * 0.2, S * 0.8);
                var d = Math.sqrt(Math.pow(x - S/2, 2) + Math.pow(y - S/2, 2));
                var fade = 1 - (d / (S * 0.5));
                if (fade < 0.2) continue;
                var r = rand(0.8, 2);
                var a = rand(0.5, 1) * fade;
                var grad = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
                grad.addColorStop(0, 'rgba(' + pal.core[0] + ',' + pal.core[1] + ',' + pal.core[2] + ',' + a + ')');
                grad.addColorStop(1, 'rgba(' + pal.core[0] + ',' + pal.core[1] + ',' + pal.core[2] + ',0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(x, y, r * 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        },

        _createPlanets: function () {
            this.planets = [];

            for (var i = 0; i < BG_CFG.PLANET_COUNT; i++) {
                var pal = this._nextPlanetPalette();
                // Уменьшен радиус: 30–70 (было 45–100)
                var radius = rand(30, 70);
                var tex = this._createPlanetTexture(radius, pal);
                var sprite = new PIXI.Sprite(tex);
                sprite.anchor.set(0.5);
                sprite.x = rand(radius * 2, this.W - radius * 2);
                sprite.y = rand(this.H * 0.05, this.H * 0.7);
                sprite.alpha = rand(0.9, 1.0);

                this.layer.addChild(sprite);

                this.planets.push({
                    sprite: sprite,
                    radius: radius,
                    vx: rand(-0.08, 0.08),
                    vy: rand(0.01, 0.04)
                });

                console.log('[Background] Планета:', pal.type, 'radius:', Math.round(radius));
            }
        },

        _nextPlanetPalette: function () {
            var available = PLANET_PALETTES.filter(function (p) {
                return this._usedPlanetTypes.indexOf(p.type) === -1;
            }.bind(this));
            if (available.length === 0) { this._usedPlanetTypes = []; available = PLANET_PALETTES; }
            var pal = pick(available);
            this._usedPlanetTypes.push(pal.type);
            return pal;
        },

        _createPlanetTexture: function (radius, pal) {
            var texSize = Math.ceil(radius * BG_CFG.PLANET_TEX_MUL);
            var canvas = document.createElement('canvas');
            canvas.width = texSize;
            canvas.height = texSize;
            var ctx = canvas.getContext('2d');

            ctx.clearRect(0, 0, texSize, texSize);

            var cx = texSize / 2;
            var cy = texSize / 2;

            // Атмосфера (дальний ореол)
            var atmoOuter = radius * 1.5;
            var atmoGrad = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, atmoOuter);
            atmoGrad.addColorStop(0, pal.atmosphere);
            atmoGrad.addColorStop(0.5, this._fadeColor(pal.atmosphere, 0.25));
            atmoGrad.addColorStop(1, this._fadeColor(pal.atmosphere, 0));
            ctx.fillStyle = atmoGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, atmoOuter, 0, Math.PI * 2);
            ctx.fill();

            // Кольцо сзади
            if (pal.hasRing && pal.ringColor) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(-0.35);
                ctx.scale(1, 0.22);
                ctx.beginPath();
                ctx.arc(0, 0, radius * 1.7, Math.PI, Math.PI * 2);
                ctx.strokeStyle = pal.ringColor;
                ctx.lineWidth = radius * 0.18;
                ctx.stroke();
                for (var r = 0; r < 3; r++) {
                    ctx.beginPath();
                    ctx.arc(0, 0, radius * (1.58 + r * 0.07), Math.PI, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255,240,220,' + (0.2 - r * 0.05) + ')';
                    ctx.lineWidth = radius * 0.025;
                    ctx.stroke();
                }
                ctx.restore();
            }

            // Основной круг
            var bodyGrad = ctx.createRadialGradient(
                cx - radius * 0.35, cy - radius * 0.35, radius * 0.1,
                cx, cy, radius
            );
            bodyGrad.addColorStop(0, pal.base[3]);
            bodyGrad.addColorStop(0.4, pal.base[2]);
            bodyGrad.addColorStop(0.75, pal.base[1]);
            bodyGrad.addColorStop(1, pal.base[0]);
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = bodyGrad;
            ctx.fill();

            // Поверхность
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.clip();

            if (pal.type === 'gas') {
                for (var b = 0; b < 12; b++) {
                    var by = cy - radius + (b * radius * 2 / 12);
                    var bh = (radius * 2) / 12;
                    ctx.fillStyle = pal.base[b % pal.base.length];
                    ctx.globalAlpha = rand(0.4, 0.7);
                    ctx.fillRect(cx - radius, by, radius * 2, bh);
                }
                ctx.globalAlpha = 0.55;
                var sx = cx + rand(-radius * 0.3, radius * 0.3);
                var sy = cy + rand(-radius * 0.2, radius * 0.2);
                var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius * 0.3);
                sg.addColorStop(0, pal.base[0]);
                sg.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = sg;
                ctx.beginPath();
                ctx.ellipse(sx, sy, radius * 0.3, radius * 0.16, 0, 0, Math.PI * 2);
                ctx.fill();
            } else if (pal.land) {
                for (var c = 0; c < 10; c++) {
                    var col = pick(pal.land);
                    var contX = cx + rand(-radius * 0.65, radius * 0.65);
                    var contY = cy + rand(-radius * 0.65, radius * 0.65);
                    var contR = rand(radius * 0.12, radius * 0.32);
                    for (var p = 0; p < 6; p++) {
                        var px = contX + rand(-contR * 0.5, contR * 0.5);
                        var py = contY + rand(-contR * 0.5, contR * 0.5);
                        var pr = contR * rand(0.4, 0.9);
                        ctx.fillStyle = col;
                        ctx.globalAlpha = rand(0.7, 0.95);
                        ctx.beginPath();
                        ctx.arc(px, py, pr, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            ctx.globalAlpha = 1;
            ctx.restore();

            // Облака
            if (pal.cloud) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.clip();
                for (var cl = 0; cl < 15; cl++) {
                    var cloudX = cx + rand(-radius * 0.9, radius * 0.9);
                    var cloudY = cy + rand(-radius * 0.9, radius * 0.9);
                    var cloudR = rand(radius * 0.1, radius * 0.25);
                    ctx.fillStyle = pal.cloud;
                    ctx.globalAlpha = rand(0.15, 0.35);
                    ctx.beginPath();
                    ctx.ellipse(cloudX, cloudY, cloudR, cloudR * 0.35, rand(0, Math.PI), 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
                ctx.restore();
            }

            // Тень
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.clip();
            var shadowGrad = ctx.createRadialGradient(
                cx + radius * 0.45, cy + radius * 0.45, radius * 0.15,
                cx, cy, radius * 1.1
            );
            shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
            shadowGrad.addColorStop(0.6, 'rgba(0,0,0,0.2)');
            shadowGrad.addColorStop(0.9, 'rgba(0,0,0,0.65)');
            shadowGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
            ctx.fillStyle = shadowGrad;
            ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
            ctx.restore();

            // Блик
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.clip();
            var highGrad = ctx.createRadialGradient(
                cx - radius * 0.4, cy - radius * 0.4, 0,
                cx - radius * 0.4, cy - radius * 0.4, radius * 0.9
            );
            highGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
            highGrad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
            highGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = highGrad;
            ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
            ctx.restore();

            // Кольцо спереди
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
                    ctx.arc(0, 0, radius * (1.58 + r2 * 0.07), 0, Math.PI);
                    ctx.strokeStyle = 'rgba(255,240,220,' + (0.25 - r2 * 0.06) + ')';
                    ctx.lineWidth = radius * 0.025;
                    ctx.stroke();
                }
                ctx.restore();
            }

            return PIXI.Texture.from(canvas);
        },

        _fadeColor: function (rgba, factor) {
            var match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (!match) return rgba;
            var a = match[4] !== undefined ? parseFloat(match[4]) : 1;
            return 'rgba(' + match[1] + ',' + match[2] + ',' + match[3] + ',' + (a * factor) + ')';
        },

        _spawnComet: function () {
            var fromLeft = Math.random() < 0.5;
            var startX = fromLeft ? rand(-50, this.W * 0.4) : rand(this.W * 0.6, this.W + 50);
            var angle = (fromLeft ? rand(30, 55) : rand(125, 150)) * Math.PI / 180;
            var speed = rand(3, 6);
            var cometColor = pick([0xFFD280, 0x64C8BD, 0xFB7E87, 0x8CC4FF]);
            var rgb = [(cometColor >> 16) & 0xff, (cometColor >> 8) & 0xff, cometColor & 0xff];

            var canvas = document.createElement('canvas');
            canvas.width = 40;
            canvas.height = 40;
            var ctx = canvas.getContext('2d');
            var grad = ctx.createRadialGradient(20, 20, 0, 20, 20, 20);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(0.3, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.9)');
            grad.addColorStop(0.7, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.3)');
            grad.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
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

        update: function (k) {
            for (var i = 0; i < this.nebulas.length; i++) {
                var n = this.nebulas[i];
                n.sprite.x += n.vx * k;
                n.sprite.y += n.vy * k;
                if (n.sprite.x < -n.size) n.sprite.x = this.W + n.size;
                if (n.sprite.x > this.W + n.size) n.sprite.x = -n.size;
                if (n.sprite.y < -n.size) n.sprite.y = this.H + n.size;
                if (n.sprite.y > this.H + n.size) n.sprite.y = -n.size;
            }

            for (var j = 0; j < this.planets.length; j++) {
                var p = this.planets[j];
                p.sprite.x += p.vx * k;
                p.sprite.y += p.vy * k;
                if (p.sprite.y - p.radius * 2.5 > this.H) {
                    p.sprite.y = -p.radius * 2.5;
                    p.sprite.x = rand(p.radius * 2, this.W - p.radius * 2);
                    p.vx = rand(-0.08, 0.08);
                }
                if (p.sprite.x < -p.radius * 2.5) p.sprite.x = this.W + p.radius * 2.5;
                if (p.sprite.x > this.W + p.radius * 2.5) p.sprite.x = -p.radius * 2.5;
            }

            this._cometTimer -= k;
            if (this._cometTimer <= 0) {
                this._spawnComet();
                this._cometTimer = rand(BG_CFG.COMET_INTERVAL_MIN, BG_CFG.COMET_INTERVAL_MAX);
            }

            for (var c = this.comets.length - 1; c >= 0; c--) {
                var comet = this.comets[c];
                comet.head.x += comet.vx * k;
                comet.head.y += comet.vy * k;

                comet.trailTimer -= k;
                if (comet.trailTimer <= 0 && !IS_MOBILE) {
                    comet.trailTimer = 2;
                    var tp = new PIXI.Graphics();
                    tp.beginFill(comet.color, 0.6);
                    tp.drawCircle(0, 0, rand(1, 2.5));
                    tp.endFill();
                    tp.x = comet.head.x;
                    tp.y = comet.head.y;
                    tp._life = 1;
                    this.layer.addChild(tp);
                    comet.trail.push(tp);
                }

                for (var t = comet.trail.length - 1; t >= 0; t--) {
                    var part = comet.trail[t];
                    part._life -= 0.03 * k;
                    part.alpha = part._life * 0.6;
                    part.scale.set(part._life);
                    if (part._life <= 0) {
                        this.layer.removeChild(part);
                        part.destroy();
                        comet.trail.splice(t, 1);
                    }
                }

                if (comet.head.y > this.H + 100 || comet.head.x < -100 || comet.head.x > this.W + 100) {
                    for (var tt = 0; tt < comet.trail.length; tt++) {
                        if (comet.trail[tt].parent) this.layer.removeChild(comet.trail[tt]);
                        comet.trail[tt].destroy();
                    }
                    this.layer.removeChild(comet.head);
                    comet.head.destroy();
                    this.comets.splice(c, 1);
                }
            }
        }
    };

    console.log('[Background] Модуль загружен (v0.8.1)');

})();