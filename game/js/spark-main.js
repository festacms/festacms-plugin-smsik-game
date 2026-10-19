/**
 * FestaCMS — Спарк: Космическая Доставка
 * Точка входа JS (автозапуск игры)
 *
 * v0.10.1:
 *   - Автозапуск музыки после первого клика
 *   - Принудительный resume() AudioContext
 */

(function () {
    'use strict';

    var SmsikGame = window.SmsikGame = window.SmsikGame || {};

    SmsikGame.Main = {

        game: null,

        // ============================================================
        // ЗАПУСК ИГРЫ
        // ============================================================

        start: function () {
            if (typeof PIXI === 'undefined') {
                console.warn('[Main] Pixi.js не загружен.');
                return null;
            }

            var stage = document.querySelector('.starfall-stage');
            if (!stage) {
                console.warn('[Main] Не найден .starfall-stage');
                return null;
            }

            var waitSprites = window.FestaSprites
                ? window.FestaSprites.load()
                : Promise.resolve();

            return waitSprites.then(function () {
                var oldCanvas = stage.querySelector('canvas');
                if (oldCanvas) oldCanvas.style.display = 'none';

                if (!SmsikGame.PixiGame) {
                    console.error('[Main] Класс PixiGame не найден. Проверь подключение spark-core.js');
                    return null;
                }

                var game = new SmsikGame.PixiGame(stage);
                SmsikGame.instance = game;
                SmsikGame.Main.game = game;

                console.log('[Main] Игра запущена');
                return game;
            });
        },

        stop: function () {
            if (SmsikGame.Main.game) {
                SmsikGame.Main.game.running = false;
            }
        },

        restart: function () {
            if (SmsikGame.Main.game && SmsikGame.Main.game.restart) {
                SmsikGame.Main.game.restart();
            }
        }
    };

    // ============================================================
    // === ОБРАТНАЯ СОВМЕСТИМОСТЬ =================================
    // ============================================================

    window.FestaPixiGame = {
        start: function () {
            return SmsikGame.Main.start();
        },
        stop: function () {
            return SmsikGame.Main.stop();
        },
        get instance() {
            return SmsikGame.instance;
        }
    };

    // ============================================================
    // === АВТОЗАПУСК =============================================
    // ============================================================

    document.addEventListener('DOMContentLoaded', function () {

        // 1. Инициализируем аудио (контекст создастся при первом клике)
        if (SmsikGame.Audio && SmsikGame.Audio.init) {
            SmsikGame.Audio.init();

            // Вешаем первый клик: resume + startMusic
            var startAudioOnce = function () {
                if (SmsikGame.Audio) {
                    SmsikGame.Audio.resume();
                    setTimeout(function () {
                        SmsikGame.Audio.startMusic();
                    }, 50);
                }
                document.removeEventListener('click', startAudioOnce);
                document.removeEventListener('touchstart', startAudioOnce);
                console.log('[Main] Первое взаимодействие — звук активирован');
            };
            document.addEventListener('click', startAudioOnce);
            document.addEventListener('touchstart', startAudioOnce);
        }

        // 2. Инициализируем UI
        if (SmsikGame.UI && SmsikGame.UI.init) {
            SmsikGame.UI.init();
        }

        // 3. Запускаем игру через 1 секунду
        setTimeout(function () {
            SmsikGame.Main.start();
        }, 1000);
    });

    console.log('[Main] Модуль загружен (v0.10.1)');

})();