# Neo City 2.5D (HTML/CSS/JavaScript)

Полная переработка проекта в веб-игру в духе GTA2 (2.5D/isometric prototype).

## Технологии
- HTML Living Standard (современная семантика, module scripts)
- CSS (modern layout + color-mix + responsive UI)
- JavaScript ES Modules
- Спец-библиотеки:
  - **GSAP** для анимационных эффектов UI
  - **Howler.js** для аудио

## Быстрый старт

```bash
python -m http.server 8080
```

Откройте: `http://localhost:8080`

## Что есть в игре
- Изометрический 2.5D-рендер города на Canvas
- Машина игрока с физикой ускорения/трения
- NPC-пешеходы
- Миссии «забрать/доставить груз»
- Система розыска
- Деньги и HUD
- Рестарт по `R`

## Управление
- `WASD` / `↑ ↓ ← →` — движение
- `Space` — тормоз/дрифт
- `R` — перезапуск

## Файлы
- `index.html`
- `styles.css`
- `game.js`
