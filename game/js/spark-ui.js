/**
 * FestaCMS — Спарк: Космическая Доставка
 * UI: overlays, меню, магазин
 *
 * v0.6.0 (каркас):
 *   - Управление overlays через DOM
 *   - Интерфейс для будущих экранов
 *   - Методы показа/скрытия
 *   - Методы-заглушки (наполним в v0.8)
 */

(function () {
    'use strict';

    var SmsikGame = window.SmsikGame = window.SmsikGame || {};

    SmsikGame.UI = {

        // ============================================================
        // СОСТОЯНИЕ
        // ============================================================

        initialized: false,
        activeOverlay: null,        // какой overlay сейчас открыт

        // Кэш DOM-элементов (заполняется в init)
        els: {},

        // ============================================================
        // ИНИЦИАЛИЗАЦИЯ
        // ============================================================

        init: function () {
            if (this.initialized) return;

            this.els.stage = document.getElementById('starfallStage');
            this.els.noWebgl = document.getElementById('sparkNoWebgl');

            this.initialized = true;
            console.log('[UI] Модуль инициализирован (каркас v0.6.0)');
        },

        // ============================================================
        // УПРАВЛЕНИЕ OVERLAYS
        // ============================================================

        // Показать overlay по id
        showOverlay: function (id) {
            var el = document.getElementById(id);
            if (!el) {
                console.warn('[UI] Overlay не найден:', id);
                return;
            }
            el.classList.add('is-open');
            this.activeOverlay = id;
        },

        // Скрыть overlay по id
        hideOverlay: function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.classList.remove('is-open');
            if (this.activeOverlay === id) {
                this.activeOverlay = null;
            }
        },

        // Скрыть все overlays
        hideAllOverlays: function () {
            var overlays = document.querySelectorAll('.spark-overlay');
            for (var i = 0; i < overlays.length; i++) {
                overlays[i].classList.remove('is-open');
            }
            this.activeOverlay = null;
        },

        // Проверить, открыт ли какой-то overlay
        hasActiveOverlay: function () {
            return this.activeOverlay !== null;
        },

        // ============================================================
        // ЭКРАНЫ (заглушки — наполним в v0.8)
        // ============================================================

        // Стартовый экран (ввод имени, кнопка «Начать», настройки)
        showStartScreen: function () {
            // TODO v0.8: overlay с:
            //   - Заголовок игры
            //   - Поле ввода имени
            //   - Кнопка «Начать игру»
            //   - Кнопка «Настройки»
            //   - Мини-лидерборд
        },

        // Экран Game Over (счёт, топ-10, магазин, «Играть ещё»)
        showGameOver: function (score, level, duration) {
            // TODO v0.8: overlay с:
            //   - Итоговый счёт
            //   - Уровень, длительность
            //   - Магазин (жизни, оружие)
            //   - Топ-10 лидерборд
            //   - Кнопки: «Играть ещё», «На главную»
        },

        // Магазин (щит, оружие, тюнинг)
        showShop: function (balance) {
            // TODO v0.9: overlay с:
            //   - Баланс кристаллов
            //   - Список товаров (жизнь, оружие, щит, тюнинг)
            //   - Кнопка «Продолжить»
        },

        // Экран паузы
        showPause: function () {
            // TODO v0.8: overlay с:
            //   - Кнопка «Продолжить»
            //   - Кнопка «Начать заново»
            //   - Кнопка «На главную»
            //   - Таймер паузы
        },

        // Экран настроек (управление, звук, вибрация)
        showSettings: function () {
            // TODO v0.8: overlay с:
            //   - Режим управления (свайп/наклон/мышь)
            //   - Громкость музыки и звуков
            //   - Вибрация (вкл/выкл)
            //   - Кнопка «Готово»
        },

        // Экран выбора планеты (карта галактики)
        showPlanetMap: function () {
            // TODO v0.9: карта с 4 планетами Бирюзовой галактики
        },

        // Экран победы над боссом
        showBossVictory: function () {
            // TODO v0.9: финальная награда, разблокировка следующей галактики
        },

        // ============================================================
        // ВСПОМОГАТЕЛЬНЫЕ
        // ============================================================

        // Блокировка/разблокировка скролла страницы
        lockScroll: function (lock) {
            if (lock) {
                document.body.classList.add('starfall-page');
            } else {
                document.body.classList.remove('starfall-page');
            }
        },

        // Показать всплывающее уведомление
        toast: function (text, duration) {
            // TODO v0.8: маленькое сообщение сверху экрана
            console.log('[UI Toast]', text);
        }
    };

    // === Обратная совместимость ===
    window.FestaUI = SmsikGame.UI;

    console.log('[UI] Модуль загружен (каркас v0.6.0)');

})();