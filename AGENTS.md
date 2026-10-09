<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Единый формат env

- Канонический шаблон каждого приложения или инфраструктурного каталога — `.env.example`.
  Если рядом есть `env.example`, он должен полностью совпадать с каноническим шаблоном.
- Рабочие `.env`, `.env.local` и остальные `.env.*` повторяют свой шаблон:
  те же заголовки, пустые строки, порядок и набор переменных. Отличаться могут только значения.
- Блок начинается тремя строками: `# ==================================`, название
  прописными буквами с `# `, такой же разделитель. Сразу после заголовка идут переменные;
  между блоками — одна пустая строка, в конце файла — перевод строки.
- Переменные записываются как однострочные `KEY=value` без пробелов вокруг `=`.
  В примерах все значения заполнены простыми dev-значениями. Подгрупп, пояснений,
  закомментированных переменных и inline-комментариев нет; пояснения принадлежат README.
- При изменении шаблона синхронизируй структуру существующих рабочих файлов, сохраняя
  их действующие значения. Новые параметры заполняй defaults; устаревшие удаляй после проверки потребителей.
  Рабочие env-файлы не коммитятся, значения секретов не выводятся в отчёты.
- После любого изменения env запускай `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run env:check`.
  Эта проверка также входит в корневой `lint`.
