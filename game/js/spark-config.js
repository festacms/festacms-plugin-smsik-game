/**
 * FestaCMS — Спарк: Космическая Доставка
 * Конфиг и утилиты
 *
 * v0.6.0:
 *   - Стрелки чаще (Глитч с 3 уровня, Похититель с 5)
 *   - Интервал выстрелов 1–3 сек
 *   - Пространство имён SmsikGame
 */

(function () {
    'use strict';

    var SmsikGame = window.SmsikGame = window.SmsikGame || {};

    // ============================================================
    // === ДЕТЕКТ МОБИЛЬНОГО ======================================
    // ============================================================

    SmsikGame.IS_MOBILE = (function () {
        var ua = navigator.userAgent || '';
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
        if (typeof window.orientation !== 'undefined') return true;
        if ('ontouchstart' in window && window.innerWidth < 1024) return true;
        return false;
    })();

    // ============================================================
    // === КОНФИГ =================================================
    // ============================================================

    SmsikGame.CFG = {
        // Игрок
        PLAYER_SIZE:      44,
        PLAYER_ACC:       1.15,
        PLAYER_MAX_V:     14,
        PLAYER_FRICTION:  0.90,
        MOUSE_LERP:       0.22,

        MAX_LIVES:        5,

        // Спавн
        SPAWN_RATE_BASE:  50,
        ITEM_FALL_MIN:    1.6,
        ITEM_FALL_MAX:    2.8,

        BONUS_CHANCE:     0.45,

        // Уровни
        LEVEL_STEP:       200,
        LEVEL_SPEED_UP:   1.15,

        // Оружие
        WEAPON_DURATION:  15 * 60,
        WEAPON_COOLDOWN:  9,
        BULLET_SPEED:     14,
        BULLET_SIZE:      4,

        // Очки
        POINTS_ENEMY:     5,
        POINTS_NLO:       15,
        POINTS_DEMON:     50,
        POINTS_BONUS:     10,

        // Управление
        SWIPE_SENSITIVITY: 1.8,

        // Частицы
        MAX_PARTICLES:    200,
        PARTICLE_GRAVITY: 0.15,

        // Сердечки-жизни
        HEART_INTERVAL_MIN: 20 * 60,
        HEART_INTERVAL_MAX: 40 * 60,
        HEART_FALL_SPEED_MIN: 1.2,
        HEART_FALL_SPEED_MAX: 1.6,
        HEART_RADIUS: 26,
        HEART_SIZE: 46,

        // Вражеские пули
        ENEMY_BULLET_SPEED: 6,
        ENEMY_BULLET_SIZE: 6,
        ENEMY_BULLET_DAMAGE: 1,
        ENEMY_BULLET_LIFE: 400,
        ENEMY_SHOOT_MIN_INTERVAL: 1 * 60,
        ENEMY_SHOOT_MAX_INTERVAL: 3 * 60,
        ENEMY_SHOOT_MIN_Y: 100,

        // Уровни появления врагов
        LEVEL_GLITCH:   3,
        LEVEL_DEMON:    5,
        LEVEL_ASTEROID: 4,
        LEVEL_FIREBALL: 6
    };

    // ============================================================
    // === УТИЛИТЫ ================================================
    // ============================================================

    SmsikGame.utils = {
        rand: function (min, max) {
            return min + Math.random() * (max - min);
        },

        randInt: function (min, max) {
            return Math.floor(min + Math.random() * (max - min + 1));
        },

        clamp: function (v, min, max) {
            return Math.max(min, Math.min(max, v));
        },

        pick: function (arr) {
            return arr[Math.floor(Math.random() * arr.length)];
        }
    };

    // ============================================================
    // === ГЛОБАЛЬНЫЕ СОКРАЩЕНИЯ ==================================
    // ============================================================
    // Чтобы код в других модулях был короче — выносим функции
    // в глобальную область. Это безопасно: имена уникальные.

    var U = SmsikGame.utils;
    window.rand    = U.rand;
    window.randInt = U.randInt;
    window.clamp   = U.clamp;
    window.pick    = U.pick;

    console.log('[Config] SmsikGame.CFG загружен');

})();