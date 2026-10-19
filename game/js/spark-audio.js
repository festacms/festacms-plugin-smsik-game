/**
 * FestaCMS — Спарк: Космическая Доставка
 * Звук и музыка (Web Audio API, синтез)
 *
 * v0.16.3:
 *   - ИСПРАВЛЕНО: gain.gain.connect → gain.connect (бас не запускался)
 *   - startMusic ждёт resume AudioContext
 *   - Громкость музыки ×2
 *   - Богатый звук (не MIDI)
 */

(function () {
    'use strict';

    var SmsikGame = window.SmsikGame = window.SmsikGame || {};

    SmsikGame.Audio = {

        ctx: null,
        enabled: true,
        initialized: false,
        musicPlaying: false,

        masterGain: null,
        sfxGain: null,
        musicGain: null,
        compressor: null,
        reverb: null,
        reverbGain: null,
        sfxDelay: null,
        sfxDelayGain: null,

        noiseBuffer: null,
        musicNodes: [],

        _lastPlayTime: {},
        _activeVoices: 0,
        MAX_VOICES: 12,

        _canPlay: function (key, minIntervalMs) {
            var now = performance.now();
            var last = this._lastPlayTime[key] || 0;
            if (now - last < minIntervalMs) return false;
            this._lastPlayTime[key] = now;
            return true;
        },

        _checkVoices: function () {
            return this._activeVoices < this.MAX_VOICES;
        },

        _voiceStart: function () {
            this._activeVoices++;
            var self = this;
            setTimeout(function () {
                self._activeVoices--;
            }, 500);
        },

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
                console.log('[Audio] AudioContext создан. State:', this.ctx.state);

                this.compressor = this.ctx.createDynamicsCompressor();
                this.compressor.threshold.value = -18;
                this.compressor.knee.value = 8;
                this.compressor.ratio.value = 10;
                this.compressor.attack.value = 0.001;
                this.compressor.release.value = 0.15;
                this.compressor.connect(this.ctx.destination);

                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 0.85;
                this.masterGain.connect(this.compressor);

                this.sfxGain = this.ctx.createGain();
                this.sfxGain.gain.value = 0.5;
                this.sfxGain.connect(this.masterGain);

                this.musicGain = this.ctx.createGain();
                this.musicGain.gain.value = 0.75;
                this.musicGain.connect(this.masterGain);

                this.reverb = this.ctx.createConvolver();
                this.reverb.buffer = this._createReverbImpulse(8.0, 1.8);
                this.reverbGain = this.ctx.createGain();
                this.reverbGain.gain.value = 0.6;
                this.reverb.connect(this.reverbGain);
                this.reverbGain.connect(this.masterGain);

                this.sfxGain.connect(this.reverb);
                this.musicGain.connect(this.reverb);

                this.sfxDelay = this.ctx.createDelay(1.0);
                this.sfxDelay.delayTime.value = 0.12;
                this.sfxDelayGain = this.ctx.createGain();
                this.sfxDelayGain.gain.value = 0.10;
                this.sfxDelay.connect(this.sfxDelayGain);
                this.sfxDelayGain.connect(this.reverb);
                this.sfxGain.connect(this.sfxDelay);

                this._createNoiseBuffer();

                this.initialized = true;
                console.log('[Audio] Web Audio v0.16.3 готов. State:', this.ctx.state);

            } catch (e) {
                console.warn('[Audio] Ошибка инициализации:', e);
                this.enabled = false;
            }
        },

        resume: function () {
            if (!this.ctx) return Promise.resolve();
            if (this.ctx.state === 'running') return Promise.resolve();
            return this.ctx.resume().then(function () {
                console.log('[Audio] Context resumed. State:', this.ctx.state);
            }.bind(this)).catch(function (e) {
                console.warn('[Audio] Resume failed:', e);
            });
        },

        _createReverbImpulse: function (duration, decay) {
            var sampleRate = this.ctx.sampleRate;
            var length = sampleRate * duration;
            var buffer = this.ctx.createBuffer(2, length, sampleRate);
            for (var channel = 0; channel < 2; channel++) {
                var data = buffer.getChannelData(channel);
                for (var i = 0; i < length; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
                }
            }
            return buffer;
        },

        _createNoiseBuffer: function () {
            var sampleRate = this.ctx.sampleRate;
            var duration = 2.0;
            var length = sampleRate * duration;
            var buffer = this.ctx.createBuffer(1, length, sampleRate);
            var data = buffer.getChannelData(0);
            for (var i = 0; i < length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            this.noiseBuffer = buffer;
        },

        // ============================================================
        // ХЕЛПЕРЫ
        // ============================================================

        playTone: function (freq, duration, type, volume, freqEnd, delay, pan) {
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

            var panner = null;
            if (pan !== undefined && pan !== null && ctx.createStereoPanner) {
                panner = ctx.createStereoPanner();
                panner.pan.value = Math.max(-1, Math.min(1, pan));
            }

            osc.connect(gain);
            if (panner) {
                gain.connect(panner);
                panner.connect(this.sfxGain);
            } else {
                gain.connect(this.sfxGain);
            }

            osc.start(t);
            osc.stop(t + duration + 0.02);
        },

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

        playChord: function (freqs, duration, type, volume, delay) {
            for (var i = 0; i < freqs.length; i++) {
                this.playTone(freqs[i], duration, type, volume, null, (delay || 0) + i * 0.02);
            }
        },

        // ============================================================
        // SFX
        // ============================================================

        playShoot: function (pan) {
            if (!this.enabled || !this.initialized) return;
            if (!this._canPlay('shoot', 60)) return;
            if (!this._checkVoices()) return;

            this._voiceStart();
            this.playTone(800, 0.05, 'sawtooth', 0.06, 200, 0, pan);
            this.playNoise(0.03, 0.04, 'highpass', 2000);
        },

        playExplosion: function () {
            if (!this.enabled || !this.initialized) return;
            if (!this._canPlay('explosion', 90)) return;
            if (!this._checkVoices()) return;

            this._voiceStart();
            this.playNoise(0.15, 0.12, 'lowpass', 2000, 300);
            this.playTone(80, 0.15, 'triangle', 0.08, 40);
        },

        playPickupStar: function () {
            if (!this.enabled || !this.initialized) return;
            if (!this._canPlay('star', 200)) return;
            if (!this._checkVoices()) return;

            this._voiceStart();
            var notes = [523, 659, 784, 1047];
            for (var i = 0; i < notes.length; i++) {
                this.playTone(notes[i], 0.12, 'sine', 0.12, null, i * 0.05);
            }
            this.playTone(1568, 0.25, 'triangle', 0.06, null, 0.15);
        },

        playPickupHeart: function () {
            if (!this.enabled || !this.initialized) return;
            if (!this._canPlay('heart', 200)) return;
            if (!this._checkVoices()) return;

            this._voiceStart();
            this.playTone(1047, 0.15, 'sine', 0.10);
            this.playTone(1319, 0.2, 'sine', 0.08, null, 0.08);
            this.playTone(2093, 0.3, 'sine', 0.05, null, 0.15);
        },

        playPickupBonus: function () {
            if (!this.enabled || !this.initialized) return;
            if (!this._canPlay('bonus', 100)) return;
            if (!this._checkVoices()) return;

            this._voiceStart();
            this.playTone(784, 0.08, 'sine', 0.08);
            this.playTone(1047, 0.12, 'sine', 0.08, null, 0.06);
        },

        playDamage: function () {
            if (!this.enabled || !this.initialized) return;
            if (!this._canPlay('damage', 150)) return;
            if (!this._checkVoices()) return;

            this._voiceStart();
            this.playTone(150, 0.18, 'sawtooth', 0.12, 80);
            this.playNoise(0.12, 0.10, 'lowpass', 800, 400);
        },

        playLevelUp: function () {
            if (!this.enabled || !this.initialized) return;
            if (!this._checkVoices()) return;

            this._voiceStart();
            var notes = [523, 659, 784, 1047];
            for (var i = 0; i < notes.length; i++) {
                this.playTone(notes[i], 0.15, 'triangle', 0.10, null, i * 0.08);
            }
            this.playChord([523, 659, 784], 0.4, 'sine', 0.06, 0.4);
        },

        playGameOver: function () {
            if (!this.enabled || !this.initialized) return;

            var notes = [523, 392, 330, 262];
            for (var i = 0; i < notes.length; i++) {
                this.playTone(notes[i], 0.25, 'sawtooth', 0.10, null, i * 0.15);
            }
            this.playTone(100, 0.8, 'triangle', 0.12, 60, 0.6);
        },

        playEnemyShoot: function () {
            if (!this.enabled || !this.initialized) return;
            if (!this._canPlay('enemyShoot', 120)) return;
            if (!this._checkVoices()) return;

            this._voiceStart();
            this.playTone(400, 0.05, 'square', 0.04, 200);
            this.playNoise(0.03, 0.03, 'lowpass', 1000);
        },

        playButtonClick: function () {
            if (!this.enabled || !this.initialized) return;
            this.playTone(1200, 0.03, 'sine', 0.06, 800);
        },

        // ============================================================
        // 🎼 МУЗЫКА
        // ============================================================

        startMusic: function () {
            if (!this.enabled) {
                console.log('[Audio] startMusic: disabled');
                return;
            }
            if (!this.initialized) {
                console.log('[Audio] startMusic: not initialized');
                return;
            }
            if (this.musicPlaying) {
                console.log('[Audio] startMusic: already playing');
                return;
            }

            if (this.ctx.state !== 'running') {
                console.log('[Audio] Context не running (' + this.ctx.state + '), ждём resume...');
                var self = this;
                this.ctx.resume().then(function () {
                    console.log('[Audio] Resume OK, запускаем музыку');
                    self.startMusic();
                }).catch(function (e) {
                    console.warn('[Audio] Resume failed:', e);
                });
                return;
            }

            console.log('[Audio] Музыка стартует! Context state:', this.ctx.state);
            this.musicPlaying = true;

            var ctx = this.ctx;
            var self = this;

            // ============================================================
            // СЛОЙ 1: BASS (5 голосов) — ✅ ИСПРАВЛЕНО gain.connect
            // ============================================================
            var bassFreq = 55;
            var bassVoices = [
                { type: 'sine',     detune: -4, gain: 0.08 },
                { type: 'sine',     detune: 0,  gain: 0.12 },
                { type: 'sine',     detune: 4,  gain: 0.08 },
                { type: 'triangle', detune: 0,  gain: 0.06 },
                { type: 'sine',     detune: 0,  gain: 0.04, freqMul: 2 }
            ];

            var bassGroup = [];
            bassVoices.forEach(function (v) {
                var freq = bassFreq * (v.freqMul || 1);
                var osc = ctx.createOscillator();
                osc.type = v.type;
                osc.frequency.value = freq;
                osc.detune.value = v.detune;

                var gain = ctx.createGain();
                gain.gain.setValueAtTime(0, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(v.gain, ctx.currentTime + 8);
                gain.connect(self.musicGain);   // ✅ ИСПРАВЛЕНО: было gain.gain.connect

                osc.connect(gain);
                osc.start();

                bassGroup.push({ osc: osc, gain: gain });
                self.musicNodes.push({ osc: osc, gain: gain });
            });

            var bassLFO = ctx.createOscillator();
            bassLFO.type = 'sine';
            bassLFO.frequency.value = 0.1;
            var bassLFOGain = ctx.createGain();
            bassLFOGain.gain.value = 0.04;
            bassLFO.connect(bassLFOGain);
            bassGroup.forEach(function (voice) {
                bassLFOGain.connect(voice.gain.gain);   // это правильно: AudioParam → AudioParam
            });
            bassLFO.start();
            self.musicNodes.push({ osc: bassLFO, gain: bassLFOGain });

            // ============================================================
            // СЛОЙ 2: ПЭДЫ (5 голосов на ноту)
            // ============================================================
            var chords = [
                [220, 261.63, 329.63],
                [174.61, 220, 261.63],
                [261.63, 329.63, 392],
                [196, 246.94, 293.66]
            ];
            var chordIndex = 0;

            function playPad() {
                if (!self.musicPlaying) return;

                var chord = chords[chordIndex % chords.length];
                chordIndex++;
                var padDuration = 16;

                chord.forEach(function (freq, noteIdx) {
                    var voices = [
                        { type: 'sine',     detune: -8, gain: 0.016 },
                        { type: 'sine',     detune: -3, gain: 0.020 },
                        { type: 'sine',     detune: 3,  gain: 0.020 },
                        { type: 'sine',     detune: 8,  gain: 0.016 },
                        { type: 'triangle', detune: 0,  gain: 0.014 }
                    ];

                    voices.forEach(function (v, voiceIdx) {
                        var osc = ctx.createOscillator();
                        osc.type = v.type;
                        osc.frequency.value = freq;
                        osc.detune.value = v.detune;

                        var gain = ctx.createGain();
                        gain.gain.setValueAtTime(0, ctx.currentTime);
                        gain.gain.linearRampToValueAtTime(v.gain, ctx.currentTime + 3);
                        gain.gain.linearRampToValueAtTime(v.gain, ctx.currentTime + padDuration - 3);
                        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + padDuration);

                        var filter = ctx.createBiquadFilter();
                        filter.type = 'lowpass';
                        filter.frequency.value = 700 + noteIdx * 100;
                        filter.Q.value = 0.7;

                        var panner = ctx.createStereoPanner();
                        panner.pan.value = ((voiceIdx / 4) - 0.5) * 1.2;

                        var panLFO = ctx.createOscillator();
                        panLFO.type = 'sine';
                        panLFO.frequency.value = 0.025 + noteIdx * 0.008 + voiceIdx * 0.005;
                        var panLFOGain = ctx.createGain();
                        panLFOGain.gain.value = 0.8;
                        panLFO.connect(panLFOGain);
                        panLFOGain.connect(panner.pan);
                        panLFO.start(ctx.currentTime + Math.random() * 15);

                        var drift = ctx.createOscillator();
                        drift.type = 'sine';
                        drift.frequency.value = 0.1 + Math.random() * 0.1;
                        var driftGain = ctx.createGain();
                        driftGain.gain.value = freq * 0.0008;
                        drift.connect(driftGain);
                        driftGain.connect(osc.frequency);

                        osc.connect(filter);
                        filter.connect(gain);
                        gain.connect(panner);
                        panner.connect(self.musicGain);

                        osc.start();
                        drift.start();
                        osc.stop(ctx.currentTime + padDuration + 0.1);
                        drift.stop(ctx.currentTime + padDuration + 0.1);
                        panLFO.stop(ctx.currentTime + padDuration + 0.1);
                    });
                });

                setTimeout(playPad, (padDuration - 2) * 1000);
            }

            setTimeout(playPad, 3000);

            // ============================================================
            // СЛОЙ 3: ЗВЁЗДОЧКИ
            // ============================================================
            function playSparkle() {
                if (!self.musicPlaying) return;

                var sparkleNotes = [1047, 1319, 1568, 2093, 2637];
                var freq = sparkleNotes[Math.floor(Math.random() * sparkleNotes.length)];
                var startPan = Math.random() < 0.5 ? -1 : 1;
                var endPan = -startPan;
                var duration = 2.5 + Math.random() * 1.5;

                [{ detune: -4 }, { detune: 4 }].forEach(function (d) {
                    var osc = ctx.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    osc.detune.value = d.detune;

                    var gain = ctx.createGain();
                    gain.gain.setValueAtTime(0, ctx.currentTime);
                    gain.gain.linearRampToValueAtTime(0.024, ctx.currentTime + 0.3);
                    gain.gain.linearRampToValueAtTime(0.024, ctx.currentTime + duration * 0.5);
                    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

                    var panner = ctx.createStereoPanner();
                    panner.pan.setValueAtTime(startPan, ctx.currentTime);
                    panner.pan.linearRampToValueAtTime(endPan, ctx.currentTime + duration);

                    osc.connect(gain);
                    gain.connect(panner);
                    panner.connect(self.musicGain);

                    osc.start();
                    osc.stop(ctx.currentTime + duration + 0.1);
                });

                setTimeout(playSparkle, 5000 + Math.random() * 7000);
            }

            setTimeout(playSparkle, 5000);

            // ============================================================
            // СЛОЙ 4: КОРАБЛЬ
            // ============================================================
            function playShip() {
                if (!self.musicPlaying) return;

                var startPan = Math.random() < 0.5 ? -1 : 1;
                var endPan = -startPan;
                var duration = 8.0 + Math.random() * 4.0;

                var baseFreq = [110, 130.81, 164.81][Math.floor(Math.random() * 3)];
                var quintFreq = baseFreq * 1.5;

                [baseFreq, quintFreq].forEach(function (freq, noteIdx) {
                    [-5, 5].forEach(function (detuneVal) {
                        var osc = ctx.createOscillator();
                        osc.type = 'triangle';
                        osc.frequency.value = freq;
                        osc.detune.value = detuneVal;

                        var gain = ctx.createGain();
                        gain.gain.setValueAtTime(0, ctx.currentTime);
                        gain.gain.linearRampToValueAtTime(0.036, ctx.currentTime + 2.5);
                        gain.gain.linearRampToValueAtTime(0.036, ctx.currentTime + duration - 2.5);
                        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

                        var filter = ctx.createBiquadFilter();
                        filter.type = 'lowpass';
                        filter.frequency.setValueAtTime(300, ctx.currentTime);
                        filter.frequency.linearRampToValueAtTime(500, ctx.currentTime + duration / 2);
                        filter.frequency.linearRampToValueAtTime(300, ctx.currentTime + duration);
                        filter.Q.value = 0.8;

                        var panner = ctx.createStereoPanner();
                        panner.pan.setValueAtTime(startPan, ctx.currentTime);
                        panner.pan.linearRampToValueAtTime(endPan, ctx.currentTime + duration);

                        osc.connect(filter);
                        filter.connect(gain);
                        gain.connect(panner);
                        panner.connect(self.musicGain);

                        osc.start();
                        osc.stop(ctx.currentTime + duration + 0.1);
                    });
                });

                console.log('[Audio] Корабль пролетает');
                setTimeout(playShip, 40000 + Math.random() * 30000);
            }

            setTimeout(playShip, 20000);
        },

        stopMusic: function () {
            if (!this.musicPlaying) return;
            this.musicPlaying = false;

            var ctx = this.ctx;
            var now = ctx.currentTime;

            if (this.musicGain) {
                this.musicGain.gain.cancelScheduledValues(now);
                this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
                this.musicGain.gain.linearRampToValueAtTime(0, now + 3);
            }

            for (var i = 0; i < this.musicNodes.length; i++) {
                try {
                    this.musicNodes[i].osc.stop(now + 3.1);
                } catch (e) {}
            }
            this.musicNodes = [];

            console.log('[Audio] Музыка остановлена');
        },

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
            if (this.sfxGain) this.sfxGain.gain.value = v * 0.5;
        },

        setMusicVolume: function (v) {
            v = Math.max(0, Math.min(1, v));
            if (this.musicGain) this.musicGain.gain.value = v * 0.75;
        }
    };

    console.log('[Audio] Модуль загружен (v0.16.3)');

})();