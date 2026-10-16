/**
 * FestaCMS — Спарк: Космическая Доставка
 * Точка входа JS (автозапуск игры)
 *
 * v0.6.0:
 *   - Инициализация Audio и UI
 *   - Запуск игры через SmsikGame.Main
 *   - Обратная совместимость через window.FestaPixiGame
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

            // Ждём загрузки спрайтов
            var waitSprites = window.FestaSprites
                ? window.FestaSprites.load()
                : Promise.resolve();

            return waitSprites.then(function () {
                // Скрываем старый canvas (если остался от legacy)
                var oldCanvas = stage.querySelector('canvas');
                if (oldCanvas) oldCanvas.style.display = 'none';

                // Создаём игру
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

        // ============================================================
        // ОСТАНОВКА (если нужно)
        // ============================================================

        stop: function () {
            if (SmsikGame.Main.game) {
                SmsikGame.Main.game.running = false;
            }
        },

        // ============================================================
        // ПЕРЕЗАПУСК
        // ============================================================

        restart: function () {
            if (SmsikGame.Main.game && SmsikGame.Main.game.restart) {
                SmsikGame.Main.game.restart();
            }
        }
    };

    // ============================================================
    // === ОБРАТНАЯ СОВМЕСТИМОСТЬ =================================
    // ============================================================
    // Старые вызовы window.FestaPixiGame.start() продолжают работать

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

            // Вешаем первый клик для "оживления" AudioContext
            // (браузеры требуют взаимодействия пользователя)
            var resumeOnce = function () {
                if (SmsikGame.Audio && SmsikGame.Audio.resume) {
                    SmsikGame.Audio.resume();
                }
                document.removeEventListener('click', resumeOnce);
                document.removeEventListener('touchstart', resumeOnce);
            };
            document.addEventListener('click', resumeOnce);
            document.addEventListener('touchstart', resumeOnce);
        }

        // 2. Инициализируем UI
        if (SmsikGame.UI && SmsikGame.UI.init) {
            SmsikGame.UI.init();
        }

        // 3. Запускаем игру через 1 секунду
        // (даём время старому коду "уйти" и DOM стабилизироваться)
        setTimeout(function () {
            SmsikGame.Main.start();
        }, 1000);
    });

    console.log('[Main] Модуль загружен (v0.6.0)');

})();