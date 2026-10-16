<?php
/**
 * FestaCMS — Страница 404 с игрой «Смсик: Космическая доставка»
 * 
 * Игра на весь экран + блок с поиском и категориями + магазин покупок.
 * Мобильное управление: свайп или наклон + кнопка стрельбы.
 * Версия 1.5: спрайты SVG для персонажей и элементов (без эмодзи).
 */
http_response_code(404);
require_once __DIR__ . '/api/Database.php';

$pageTitle = 'Страница не найдена — FestaCMS';
$pageDescription = 'К сожалению, запрашиваемая страница не существует или была удалена.';
$pageKeywords = '404, страница не найдена, играть';
$pageMicrodata = '';

// Популярные категории
$popularCategories = [];
try {
    $popularCategories = Database::select("
        SELECT c.id, c.name, c.slug, COUNT(g.id) AS cnt
        FROM categories c
        LEFT JOIN greetings g ON g.category_id = c.id AND g.is_published = 1
        WHERE c.is_visible = 1 
          AND c.parent_id IS NULL
        GROUP BY c.id
        ORDER BY cnt DESC, c.sort_order ASC
        LIMIT 8
    ");
} catch (Throwable $e) {
    $popularCategories = [];
}

$formats = [
    ['slug' => 'verse', 'name' => 'В стихах',       'icon' => '📝'],
    ['slug' => 'prose', 'name' => 'В прозе',        'icon' => '💬'],
    ['slug' => 'sms',   'name' => 'Короткие SMS',   'icon' => '📱'],
    ['slug' => 'funny', 'name' => 'Смешные',        'icon' => '😄'],
];

include __DIR__ . '/header.php';
include __DIR__ . '/breadcrumbs.php';
renderBreadcrumbs($breadcrumbItems);
?>

<link rel="stylesheet" href="/css/404-game.css?v=1.5">

<!-- ============================================================ -->
<!-- === ИГРА «Смсик: Космическая доставка» (на весь экран) ===== -->
<!-- ============================================================ -->
<div class="starfall-stage" id="starfallStage">
    <canvas></canvas>
    <div class="starfall-flash"></div>

    <!-- HUD -->
    <div class="starfall-hud">
        <div class="starfall-hud-left">
            <div class="starfall-lives" id="starfallLives">❤️❤️❤️❤️❤️</div>
            <div class="starfall-combo" id="starfallCombo">🔥 Комбо ×2</div>
        </div>
        <div class="starfall-hud-right">
            <div class="starfall-weapon" id="starfallWeapon">
                <span>🔫</span>
                <span id="starfallWeaponTimer">8.0</span>s
            </div>
            <div class="starfall-level" id="starfallLevel">Ур. 1</div>
            <div class="starfall-score">Очки: <b id="starfallScore">0</b></div>
            <button type="button" class="starfall-hud-icon-btn" id="starfallSettingsBtn" title="Настройки управления">⚙️</button>
            <button type="button" class="starfall-hud-icon-btn" id="starfallCloseBtn" title="Закрыть игру">✕</button>
        </div>
    </div>

    <!-- Кнопка стрельбы (мобильные) -->
    <button type="button" class="starfall-fire-btn" id="starfallFireBtn" aria-label="Стрелять">🔫</button>

    <!-- === OVERLAY СТАРТА === -->
    <div class="starfall-overlay" id="starfallStartOverlay">
        <div class="starfall-overlay-content">
            <span class="starfall-overlay-emoji">📨</span>
            <h2>Смсик: Космическая доставка</h2>
            <p>
                Помоги Смсику доставить радость сквозь галактику!<br>
                Собирай <b>⭐</b> и <b>💖</b>, уклоняйся от врагов.<br>
                <b>Esc</b> — пауза. Управление: свайп, наклон или стрелки ←→ / WASD.
            </p>

            <div class="starfall-name-field">
                <label class="starfall-name-label" for="starfallNameInput">Как тебя зовут?</label>
                <input type="text"
                       class="starfall-name-input"
                       id="starfallNameInput"
                       placeholder="Имя (2-30 символов)"
                       maxlength="30"
                       autocomplete="off">
                <div class="starfall-name-error" id="starfallNameError"></div>
            </div>

            <button type="button" class="starfall-btn" id="starfallStartBtn">🚀 Начать игру</button>

            <div class="starfall-lb">
                <div class="starfall-lb-title">🏆 Лучшие игроки</div>
                <div class="starfall-lb-tabs" id="starfallLbTabs">
                    <button type="button" class="starfall-lb-tab active" data-period="week">🔥 Неделя</button>
                    <button type="button" class="starfall-lb-tab" data-period="month">📅 Месяц</button>
                    <button type="button" class="starfall-lb-tab" data-period="all">🏆 Всё время</button>
                </div>
                <ul class="starfall-lb-list" id="starfallLbList">
                    <li class="starfall-lb-empty">Загружаем…</li>
                </ul>
            </div>
        </div>
    </div>

    <!-- === OVERLAY ВЫБОРА РЕЖИМА УПРАВЛЕНИЯ === -->
    <div class="starfall-overlay is-hidden" id="starfallControlsOverlay">
        <div class="starfall-overlay-content">
            <span class="starfall-overlay-emoji">🎮</span>
            <h3>Как удобнее управлять?</h3>
            <p>Выбери режим — потом сможешь поменять в ⚙️</p>

            <div class="starfall-controls-choice">
                <button type="button" class="starfall-choice-card" data-mode="swipe">
                    <span class="starfall-choice-icon">🖐</span>
                    <b>Свайпом</b>
                    <span>Води пальцем по экрану — Смсик слушается</span>
                </button>

                <button type="button" class="starfall-choice-card" data-mode="tilt">
                    <span class="starfall-choice-icon">📱</span>
                    <b>Наклоном</b>
                    <span>Наклоняй телефон — Смсик едет</span>
                </button>
            </div>

            <button type="button" class="starfall-btn starfall-btn-secondary" id="starfallControlsBackBtn">
                ← Назад
            </button>
        </div>
    </div>

    <!-- === OVERLAY НАСТРОЕК === -->
    <div class="starfall-overlay is-hidden" id="starfallSettingsOverlay">
        <div class="starfall-overlay-content">
            <span class="starfall-overlay-emoji">⚙️</span>
            <h3>Настройки</h3>

            <div class="starfall-settings-row">
                <span>Режим управления:</span>
                <div class="starfall-controls-choice-mini">
                    <button type="button" class="starfall-choice-mini" data-mode="swipe">
                        🖐 Свайп
                    </button>
                    <button type="button" class="starfall-choice-mini" data-mode="tilt">
                        📱 Наклон
                    </button>
                </div>
            </div>

            <div class="starfall-settings-row starfall-settings-row-vibro">
                <span>Вибрация при ударе:</span>
                <label class="starfall-switch">
                    <input type="checkbox" id="starfallVibroToggle" checked>
                    <span class="starfall-switch-slider"></span>
                </label>
            </div>

            <button type="button" class="starfall-btn" id="starfallSettingsCloseBtn">
                ✓ Готово
            </button>
        </div>
    </div>

    <!-- === OVERLAY ПАУЗЫ === -->
    <div class="starfall-overlay is-hidden" id="starfallPauseOverlay">
        <div class="starfall-pause-content">
            <span class="starfall-pause-icon">⏸</span>
            <h3 class="starfall-pause-title">Пауза</h3>
            <div class="starfall-pause-timer">
                ⏱ Пауза: <span id="starfallPauseTimer">0 сек</span>
            </div>
            <div class="starfall-pause-buttons">
                <button type="button" class="starfall-pause-btn starfall-pause-btn-primary" id="starfallResumeBtn">
                    ▶ Продолжить
                </button>
                <button type="button" class="starfall-pause-btn starfall-pause-btn-secondary" id="starfallRestartBtn">
                    🔄 Начать заново
                </button>
                <button type="button" class="starfall-pause-btn starfall-pause-btn-secondary" id="starfallHomeBtn">
                    🏠 Выйти на главную
                </button>
            </div>
            <p class="starfall-pause-hint">
                Нажми <kbd>Esc</kbd> чтобы продолжить
            </p>
        </div>
    </div>

    <!-- === OVERLAY КОНЦА (со магазином) === -->
    <div class="starfall-overlay is-hidden" id="starfallEndOverlay">
        <div class="starfall-overlay-content">
            <span class="starfall-overlay-emoji" id="starfallEndEmoji">💫</span>
            <h3 id="starfallEndTitle">Игра окончена</h3>

            <div class="starfall-final-score">
                <span class="starfall-final-score-num" id="starfallEndScore">0</span>
                <span class="starfall-final-score-label">очков</span>
            </div>

            <p id="starfallEndMessage">Попробуй ещё раз — побей свой рекорд!</p>

            <!-- 🛒 МАГАЗИН -->
            <div class="starfall-shop" id="starfallShop">
                <div class="starfall-shop-title">🛒 Магазин</div>
                <div class="starfall-shop-balance">
                    💰 В наличии: <b id="starfallShopBalance">0</b> очков
                </div>
                <div class="starfall-shop-items">
                    <button type="button" class="starfall-shop-item" data-buy="life" id="starfallBuyLife">
                        <div class="starfall-shop-item-icon">❤️</div>
                        <div class="starfall-shop-item-info">
                            <b>+1 жизнь</b>
                            <span>Бонусная жизнь в следующей партии</span>
                        </div>
                        <div class="starfall-shop-item-price">200</div>
                    </button>
                    <button type="button" class="starfall-shop-item" data-buy="weapon" id="starfallBuyWeapon">
                        <div class="starfall-shop-item-icon">🔫</div>
                        <div class="starfall-shop-item-info">
                            <b>Оружие</b>
                            <span>Пушка активна 8 сек с самого старта</span>
                        </div>
                        <div class="starfall-shop-item-price">100</div>
                    </button>
                </div>
                <div class="starfall-shop-total">
                    В лидерборд пойдёт: <b id="starfallShopTotal">0</b> очков
                </div>
            </div>

            <div class="starfall-end-actions">
                <button type="button" class="starfall-btn" id="starfallPlayAgainBtn">🔁 Играть ещё</button>
                <button type="button" class="starfall-pause-btn starfall-pause-btn-secondary" id="starfallEndHomeBtn">🏠 На главную</button>
            </div>

            <div class="starfall-lb" id="starfallEndLb" style="display:none;">
                <div class="starfall-lb-title">🏆 Лучшие игроки</div>
                <div class="starfall-lb-tabs" id="starfallEndLbTabs">
                    <button type="button" class="starfall-lb-tab active" data-period="week">🔥 Неделя</button>
                    <button type="button" class="starfall-lb-tab" data-period="month">📅 Месяц</button>
                    <button type="button" class="starfall-lb-tab" data-period="all">🏆 Всё время</button>
                </div>
                <ul class="starfall-lb-list" id="starfallEndLbList">
                    <li class="starfall-lb-empty">—</li>
                </ul>
            </div>
        </div>
    </div>
</div>

<!-- ============================================================ -->
<!-- === ПОЛЕЗНЫЙ БЛОК (виден, если закрыть игру) =============== -->
<!-- ============================================================ -->
<div class="not-found">
    <div class="not-found-code">404</div>
    <h1>Страница не найдена</h1>
    <p class="not-found-text">
        К сожалению, такой страницы нет на нашем сайте.
        Возможно, она была удалена, переименована или вы ошиблись при вводе адреса.
    </p>
    <div class="not-found-actions">
        <a href="/" class="btn btn-copy">🏠 На главную</a>
        <button type="button" class="btn btn-share" onclick="history.back()">← Вернуться назад</button>
    </div>
    <div class="not-found-search">
        <p class="not-found-search-label">Или найдите нужное поздравление:</p>
        <form action="/" method="get" class="search-form-inline">
            <input type="text" name="search" placeholder="Поиск поздравления..." class="search-input" required>
            <button type="submit" class="btn btn-copy">Найти</button>
        </form>
    </div>
    <?php if (!empty($popularCategories)): ?>
        <div class="not-found-section">
            <h2 class="not-found-section-title">Популярные разделы</h2>
            <div class="not-found-grid">
                <?php foreach ($popularCategories as $cat): ?>
                    <a href="/category/<?= htmlspecialchars($cat['slug']) ?>/" class="not-found-chip">
                        <span><?= htmlspecialchars($cat['name']) ?></span>
                        <?php if ((int)$cat['cnt'] > 0): ?>
                            <span class="not-found-chip-count"><?= (int)$cat['cnt'] ?></span>
                        <?php endif; ?>
                    </a>
                <?php endforeach; ?>
            </div>
        </div>
    <?php endif; ?>
    <div class="not-found-section">
        <h2 class="not-found-section-title">Поздравления по формату</h2>
        <div class="not-found-grid">
            <?php foreach ($formats as $f): ?>
                <a href="/format/<?= $f['slug'] ?>/" class="not-found-chip">
                    <span><?= $f['icon'] ?> <?= htmlspecialchars($f['name']) ?></span>
                </a>
            <?php endforeach; ?>
        </div>
    </div>
</div>

<!-- Спрайты — загружаем ПЕРВЫМИ, без defer -->
<script src="/js/game-sprites.js?v=1.0"></script>

<!-- Логика игры — с defer, чтобы DOM был готов -->
<script src="/js/404-game.js?v=1.5" defer></script>

<?php include __DIR__ . '/footer.php'; ?>