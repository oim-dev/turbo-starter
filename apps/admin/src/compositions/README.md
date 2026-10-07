# Compositions

`compositions` размещает и связывает готовые route modules, layouts, screens, widgets и публичные API доменов панели администрирования.

## Границы

```text
app-router
-> domain gate или route module
-> layout или screen
```

- `routes` подключаются в `app-router` и монтируют готовый layout или screen.
- `layouts` формируют переиспользуемый каркас route branch.
- `screens` содержат уникальный контент leaf route.
- `widgets` используются для крупных composition-блоков, общих для нескольких маршрутов.
- Локальное UI-state композиции размещается в минимальном scope своего владельца.
- Доменный provider, guard, state, mapping данных и сценарный UI остаются внутри соответствующего модуля `domains`.
- Модули импортируются только через публичный `index.ts`.

## Именование routes

- Корень поддерева: `{scope}-root` -> `{Scope}RootRoute`.
- Index route: `{scope}` -> `{Scope}Route`.
- Именованный дочерний route включает родительский scope и статические URL-сегменты.
- Динамические параметры URL в имя route module не включаются.

Авторизация принадлежит `domains/auth`. `app-router` подключает его client-фасет, а `main-root` только связывает защищённую route branch с `MainLayout`.
