<?php
/**
 * FestaCMS — Спарк: Космическая Доставка
 * Точка входа игрового модуля (страница 404)
 *
 * Файл подключается ЯДРОМ FestaCMS когда:
 *   - Сработала 404
 *   - Плагин spark-game включён
 *   - Пользователь не бот (skip_for_bots)
 *
 * Поэтому здесь НЕТ:
 *   - проверки авторизации
 *   - подключения Database.php
 *   - SQL-запросов
 *   - заголовков <head> (они в ядре)
 *
 * Только: разметка стадии игры + подключение JS.
 *
 * @package    FestaCMS
 * @subpackage Plugin\SparkGame
 * @version    0.6.0
 * @license    MIT
 */

// Защита от прямого запуска
if (!defined('FESTACMS_404')) {
    http_response_code(403);
    exit('Прямой запуск запрещён.');
}

// Определяем базовый URL модуля (относительно корня сайта)
$moduleUrl = '/plugins/spark-game';
?>

<link rel="stylesheet" href="<?= $moduleUrl ?>/game/css/spark.css?v=0.6.0">

<!-- ============================================================ -->
<!-- === ИГРА «СПАРК: КОСМИЧЕСКАЯ ДОСТАВКА» ===================== -->
<!-- ============================================================ -->
<div class="starfall-stage" id="starfallStage">

    <!-- Canvas для Pixi.js -->
    <canvas></canvas>

    <!-- Fallback: если JS отключён или не загрузился -->
    <noscript>
        <div class="spark-noscript">
            <h1>🚀 Спарк: Космическая Доставка</h1>
            <p>Для запуска игры включите JavaScript в браузере.</p>
        </div>
    </noscript>

    <!-- Fallback: если браузер не поддерживает WebGL -->
    <div class="spark-no-webgl" id="sparkNoWebgl" style="display:none;">
        <h1>🚀 Спарк: Космическая Доставка</h1>
        <p>Ваш браузер не поддерживает WebGL. Обновите браузер для игры.</p>
    </div>

</div>

<!-- ============================================================ -->
<!-- === СКРИПТЫ ================================================ -->
<!-- ============================================================ -->

<!-- Pixi.js — рендер (CDN) -->
<script src="https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js"></script>

<!-- Спрайты (SVG → Image) -->
<script src="<?= $moduleUrl ?>/game/js/spark-sprites.js?v=0.6.0"></script>

<!-- Конфиг + утилиты -->
<script src="<?= $moduleUrl ?>/game/js/spark-config.js?v=0.6.0"></script>

<!-- Звук (Web Audio, синтез) -->
<script src="<?= $moduleUrl ?>/game/js/spark-audio.js?v=0.6.0"></script>

<!-- UI: overlays, меню, магазин -->
<script src="<?= $moduleUrl ?>/game/js/spark-ui.js?v=0.6.0"></script>

<!-- Космический фон -->
<script src="<?= $moduleUrl ?>/game/js/spark-background.js?v=0.17.0"></script>

<!-- Игровая логика (PixiGame) -->
<script src="<?= $moduleUrl ?>/game/js/spark-core.js?v=0.6.0"></script>

<!-- Точка входа JS (автозапуск) -->
<script src="<?= $moduleUrl ?>/game/js/spark-main.js?v=0.6.0"></script>

<!-- Проверка поддержки WebGL -->
<script>
(function () {
    var canvas = document.createElement('canvas');
    var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        var noWebgl = document.getElementById('sparkNoWebgl');
        if (noWebgl) noWebgl.style.display = 'block';
        var stage = document.getElementById('starfallStage');
        if (stage) stage.classList.add('is-no-webgl');
    }
})();
</script>