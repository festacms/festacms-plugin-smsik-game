/**
 * FestaCMS — Спарк: Космическая Доставка
 * Звук и музыка (Web Audio API, синтез)
 *
 * v0.7.0:
 *   - Синтез всех 8 звуковых эффектов
 *   - Хелперы: playTone, playNoise, playChord
 *   - Осцилляторы, фильтры, envelopes
 *   - Ноль звуковых файлов
 */

(function () {
    'use strict';

    var SmsikGame = window.SmsikGame = window.SmsikGame || {};

    SmsikGame.Audio = {

        // ============================================================
        // СОСТОЯНИЕ
        // ============================================================

        ctx: null,
        enabled: true,
        initialized: false,
        musicPlaying: false,
        masterGain: null,
        musicGain: null,
        sfxGain: null,
        noiseBuffer: null,

        // ============================================================
        // ИНИЦИАЛИЗАЦИЯ
        // ============================================================

        init: function () {
            if (this.initialized) return;
            if (this.ctx) return;

            try {
                var AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) {
                    console.warn('[Audio] Web Audio API не поддерживается');
                    this.enabled = false;
                    return;
                }

                this.ctx = new AudioContext();

                // Цепочка: звуки → sfxGain → masterGain → speaker
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 1.0;
                this.masterGain.connect(this.ctx.destination);

                this.sfxGain = this.ctx.createGain();
                this.sfxGain.gain.value = 0.6;
                this.sfxGain.connect(this.masterGain);

                this.musicGain = this.ctx.createGain();
                this.musicGain.gain.value = 0.3;
                this.musicGain.connect(this.masterGain);

                // Предгенерируем буфер белого шума (для взрывов)
                this._createNoiseBuffer();

                this.initialized = true;
                console.log('[Audio] Web Audio API готов, частота:', this.ctx.sampleRate, 'Hz');

            } catch (e) {
                console.warn('[Audio] Ошибка инициализации:', e);
                this.enabled = false;
            }
        },

        resume: function () {
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(function () {});
            }
        },

        _createNoiseBuffer: function () {
            var sampleRate = this.ctx.sampleRate;
            var duration = 1.0;  // 1 секунда шума
            var length = sampleRate * duration;
            var buffer = this.ctx.createBuffer(1, length, sampleRate);
            var data = buffer.getChannelData(0);
            for (var i = 0; i < length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            this.noiseBuffer = buffer;
        },

        // ============================================================
        // ХЕЛПЕР: воспроизведение тона
        // ============================================================
        // freq       — начальная частота (Гц)
        // duration   — длительность (сек)
        // type       — 'sine' | 'square' | 'sawtooth' | 'triangle'
        // volume     — громкость (0..1)
        // freqEnd    — конечная частота (для sweep, опционально)
        // delay      — задержка старта (сек, по умолчанию 0)

        playTone: function (freq, duration, type, volume, freqEnd, delay) {
            if (!this.enabled || !this.initialized) return;

            var ctx = this.ctx;
            var t = ctx.currentTime + (delay || 0);

            var osc = ctx.createOscillator();
            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(freq, t);

            if (freqEnd !== undefined && freqEnd !== null) {
                osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t + duration);
            }

            var gain = ctx.createGain();
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(volume || 0.3, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(t);
            osc.stop(t + duration + 0.02);
        },

        // ============================================================
        // ХЕЛПЕР: воспроизведение шума (для взрывов)
        // ============================================================

        playNoise: function (duration, volume, filterType, filterFreq, filterEnd) {
            if (!this.enabled || !this.initialized) return;
            if (!this.noiseBuffer) return;

            var ctx = this.ctx;
            var t = ctx.currentTime;

            var source = ctx.createBufferSource();
            source.buffer = this.noiseBuffer;

            var filter = ctx.createBiquadFilter();
            filter.type = filterType || 'lowpass';
            filter.frequency.setValueAtTime(filterFreq || 1000, t);
            if (filterEnd !== undefined && filterEnd !== null) {
                filter.frequency.exponentialRampToValueAtTime(Math.max(filterEnd, 1), t + duration);
            }

            var gain = ctx.createGain();
            gain.gain.setValueAtTime(volume || 0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

            source.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxGain);

            source.start(t);
            source.stop(t + duration);
        },

        // ============================================================
        // ХЕЛПЕР: аккорд (несколько тонов)
        // ============================================================

        playChord: function (freqs, duration, type, volume, delay) {
            for (var i = 0; i < freqs.length; i++) {
                this.playTone(freqs[i], duration, type, volume, null, (delay || 0) + i * 0.02);
            }
        },

        // ============================================================
        // ЗВУК 1: ВЫСТРЕЛ 🔫
        // ============================================================
        // Короткий, резкий. Пила вниз + шумовой щелчок.

        playShoot: function () {
            if (!this.enabled || !this.initialized) return;

            // Пила: 800 → 200 Hz за 0.08 сек
            this.playTone(800, 0.08, 'sawtooth', 0.12, 200);
            // Шумовой щелчок
            this.playNoise(0.05, 0.08, 'highpass', 2000);
        },

        // ============================================================
        // ЗВУК 2: ВЗРЫВ 💥
        // ============================================================
        // Мощный burst шума с падающим фильтром

        playExplosion: function () {
            if (!this.enabled || !this.initialized) return;

            // Шум: фильтр lowpass 2000 → 200 Hz за 0.3 сек
            this.playNoise(0.3, 0.25, 'lowpass', 2000, 200);
            // Низкий гул
            this.playTone(80, 0.2, 'triangle', 0.15, 40);
        },

        // ============================================================
        // ЗВУК 3: ПОДБОР ЗВЕЗДЫ ⭐
        // ============================================================
        // Восходящее арпеджио — праздник!

        playPickupStar: function () {
            if (!this.enabled || !this.initialized) return;

            // Арпеджио: C5 → E5 → G5 → C6 (523, 659, 784, 1047 Hz)
            var notes = [523, 659, 784, 1047];
            for (var i = 0; i < notes.length; i++) {
                this.playTone(notes[i], 0.12, 'sine', 0.15, null, i * 0.05);
            }
            // Дополнительный «дзынь»
            this.playTone(1568, 0.25, 'triangle', 0.08, null, 0.15);
        },

        // ============================================================
        // ЗВУК 4: ПОДБОР ЖИЗНИ ❤️
        // ============================================================
        // Хрустальный звон — два высоких тона

        playPickupHeart: function () {
            if (!this.enabled || !this.initialized) return;

            // Два кристальных тона
            this.playTone(1047, 0.15, 'sine', 0.12);        // C6
            this.playTone(1319, 0.2, 'sine', 0.10, null, 0.08);  // E6
            // Мягкое эхо
            this.playTone(2093, 0.3, 'sine', 0.06, null, 0.15);  // C7
        },

        // ============================================================
        // ЗВУК 5: ПОДБОР БОНУСА 🎁
        // ============================================================
        // Короткое восходящее арпеджио (попроще звезды)

        playPickupBonus: function () {
            if (!this.enabled || !this.initialized) return;

            // Два тона: G5 → C6
            this.playTone(784, 0.08, 'sine', 0.10);
            this.playTone(1047, 0.12, 'sine', 0.10, null, 0.06);
        },

        // ============================================================
        // ЗВУК 6: УРОН 💀
        // ============================================================
        // Низкий тон + дисторшн-эффект через шум

        playDamage: function () {
            if (!this.enabled || !this.initialized) return;

            // Низкий тон с падением
            this.playTone(150, 0.2, 'sawtooth', 0.18, 80);
            // Резкий шум
            this.playNoise(0.15, 0.15, 'lowpass', 800, 400);
        },

        // ============================================================
        // ЗВУК 7: НОВЫЙ УРОВЕНЬ 🎺
        // ============================================================
        // Торжественное арпеджио вверх

        playLevelUp: function () {
            if (!this.enabled || !this.initialized) return;

            // Мажорный аккорд: C5, E5, G5, C6
            var notes = [523, 659, 784, 1047];
            for (var i = 0; i < notes.length; i++) {
                this.playTone(notes[i], 0.15, 'triangle', 0.12, null, i * 0.08);
            }
            // Финальный аккорд
            this.playChord([523, 659, 784], 0.4, 'sine', 0.08, 0.4);
        },

        // ============================================================
        // ЗВУК 8: GAME OVER ☠️
        // ============================================================
        // Нисходящий sweep + низкий гул

        playGameOver: function () {
            if (!this.enabled || !this.initialized) return;

            // Нисходящая гамма: C5 → G4 → E4 → C4
            var notes = [523, 392, 330, 262];
            for (var i = 0; i < notes.length; i++) {
                this.playTone(notes[i], 0.25, 'sawtooth', 0.12, null, i * 0.15);
            }
            // Низкий гул в конце
            this.playTone(100, 0.8, 'triangle', 0.15, 60, 0.6);
        },

        // ============================================================
        // ЗВУК 9: ВЫСТРЕЛ ВРАГА 🔴
        // ============================================================
        // Глухой хлопок

        playEnemyShoot: function () {
            if (!this.enabled || !this.initialized) return;

            this.playTone(400, 0.06, 'square', 0.06, 200);
            this.playNoise(0.04, 0.05, 'lowpass', 1000);
        },

        // ============================================================
        // ЗВУК 10: КЛИК КНОПКИ 🖱
        // ============================================================

        playButtonClick: function () {
            if (!this.enabled || !this.initialized) return;

            this.playTone(1200, 0.03, 'sine', 0.08, 800);
        },

        // ============================================================
        // МУЗЫКА (пока не реализовано, будет в v0.8)
        // ============================================================

        startMusic: function () {
            if (!this.enabled || !this.initialized) return;
            if (this.musicPlaying) return;
            this.musicPlaying = true;
            // TODO v0.8: космический ambient-луп
        },

        stopMusic: function () {
            this.musicPlaying = false;
        },

        // ============================================================
        // УПРАВЛЕНИЕ
        // ============================================================

        setEnabled: function (on) {
            this.enabled = !!on;
            if (!this.enabled) this.stopMusic();
            try {
                localStorage.setItem('spark_audio_enabled', this.enabled ? '1' : '0');
            } catch (e) {}
        },

        isEnabled: function () {
            return this.enabled;
        },

        setSfxVolume: function (v) {
            v = Math.max(0, Math.min(1, v));
            if (this.sfxGain) {
                this.sfxGain.gain.value = v * 0.6;
            }
        },

        setMusicVolume: function (v) {
            v = Math.max(0, Math.min(1, v));
            if (this.musicGain) {
                this.musicGain.gain.value = v * 0.3;
            }
        }
    };

    console.log('[Audio] Модуль загружен (v0.7.0 — синтез звуков)');

})();