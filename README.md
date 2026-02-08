# City Driver — GTA2 vibe (HTML/CSS/JS)

Теперь проект — это **top-down 2D/2.5D prototype в стиле GTA2**, и его можно публиковать на GitHub Pages.

## Что изменено под «как GTA2»
- Вид сверху (не изометрия) с кварталами и перекрёстками.
- Аркадная машина игрока, розыск (wanted), полицейские машины.
- NPC-пешеходы на дорогах.
- Миссии pickup/dropoff + награда деньгами.
- HUD в стиле старых экшен-игр.

## Локальный запуск

```bash
python -m http.server 8080
```

Откройте `http://localhost:8080`.

## Управление
- `WASD` / `↑↓←→` — движение
- `Space` — тормоз
- `R` — рестарт

## GitHub Pages (автодеплой)

В репозитории добавлен workflow: `.github/workflows/pages.yml`.

### Шаги включения Pages
1. Зайди в GitHub → **Settings** → **Pages**.
2. В секции **Build and deployment** выбери **Source: GitHub Actions**.
3. Запушь изменения в ветку (`main`/`master`/`work`) — workflow сам задеплоит сайт.
4. Ссылка появится в разделе Pages после успешного run.

## Файлы
- `index.html`
- `styles.css`
- `game.js`
- `.github/workflows/pages.yml`
