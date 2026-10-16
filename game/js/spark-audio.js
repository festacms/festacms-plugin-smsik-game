/**
 * FestaCMS — Спарк: Космическая Доставка
 * Звук и музыка (Web Audio API, синтез)
 *
 * v0.6.0 (каркас):
 *   - Интерфейс для всех звуков игры
 *   - Инициализация AudioContext
 *   - Управление музыкой и громкостью
 *   - Методы-заглушки (наполним в v0.7)
 *
 * Всё синтезируется кодом — никаких звуковых файлов.
 */

(function () {
    'use strict';

    var SmsikGame = window.SmsikGame = window.SmsikGame || {};

    SmsikGame.Audio = {

        // ============================================================
        // СОСТОЯНИЕ
        // ============================================================

        ctx: null,              // AudioContext
        enabled: true,          // Звук включён?
        initialized: false,     // Инициализирован?
        musicPlaying: false,    // Играет ли музыка?
        masterGain: null,       // Общий регулятор громкости
        musicGain: null,        // Громкость музыки
        sfxGain: null,          // Громкость звуков

        // ============================================================
        // ИНИЦИАЛИЗАЦИЯ
        // ============================================================
        // Создаётся при первом клике пользователя (браузеры требуют
        // взаимодействия с пользователем перед запуском AudioContext).

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

                // Создаём цепочку громкости:
                // звуки → sfxGain → masterGain → speaker
                // музыка → musicGain → masterGain → speaker

                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 1.0;
                this.masterGain.connect(this.ctx.destination);

                this.sfxGain = this.ctx.createGain();
                this.sfxGain.gain.value = 0.7;
                this.sfxGain.connect(this.masterGain);

                this.musicGain = this.ctx.createGain();
                this.musicGain.gain.value = 0.4;
                this.musicGain.connect(this.masterGain);

                this.initialized = true;

                console.log('[Audio] Web Audio API инициализирован, частота:', this.ctx.sampleRate, 'Hz');

            } catch (e) {
                console.warn('[Audio] Ошибка инициализации:', e);
                this.enabled = false;
            }
        },

        // Возобновление контекста (некоторые браузеры приостанавливают)
        resume: function () {
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(function () {});
            }
        },

        // ============================================================
        // ЗВУКИ (заглушки — наполним в v0.7)
        // ============================================================

        playShoot: function () {
            // TODO: пила + шум, 80 мс
        },

        playExplosion: function () {
            // TODO: шумовой burst с фильтром
        },

        playPickupBonus: function () {
            // TODO: короткое восходящее арпеджио
        },

        playPickupStar: function () {
            // TODO: яркий «дзынь» + восходящая гамма
        },

        playPickupHeart: function () {
            // TODO: хрустальный звон
        },

        playDamage: function () {
            // TODO: низкий тон + дисторшн
        },

        playLevelUp: function () {
            // TODO: торжественное арпеджио вверх
        },

        playGameOver: function () {
            // TODO: нисходящий sweep + низкий гул
        },

        playEnemyShoot: function () {
            // TODO: глухой «хлопок»
        },

        playButtonClick: function () {
            // TODO: короткий щелчок
        },

        // ============================================================
        // МУЗЫКА (заглушка — наполним в v0.7)
        // ============================================================

        startMusic: function () {
            if (!this.enabled || !this.initialized) return;
            if (this.musicPlaying) return;
            this.musicPlaying = true;
            // TODO: запустить ambient pads + ритм
        },

        stopMusic: function () {
            this.musicPlaying = false;
            // TODO: остановить музыку
        },

        // ============================================================
        // УПРАВЛЕНИЕ
        // ============================================================

        setEnabled: function (on) {
            this.enabled = !!on;
            if (!this.enabled) {
                this.stopMusic();
            }
            try {
                localStorage.setItem('spark_audio_enabled', this.enabled ? '1' : '0');
            } catch (e) {}
        },

        isEnabled: function () {
            return this.enabled;
        },

        setMusicVolume: function (v) {
            v = Math.max(0, Math.min(1, v));
            if (this.musicGain) {
                this.musicGain.gain.value = v * 0.4;
            }
        },

        setSfxVolume: function (v) {
            v = Math.max(0, Math.min(1, v));
            if (this.sfxGain) {
                this.sfxGain.gain.value = v;
            }
        }
    };

    console.log('[Audio] Модуль загружен (каркас v0.6.0)');

})();