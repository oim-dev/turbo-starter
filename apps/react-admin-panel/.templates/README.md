# React Admin Panel Templates

Шаблоны фиксируют повторяемую структуру React SPA после определения владельца и архитектурной роли.

| Шаблон | Назначение |
| --- | --- |
| `ui-unit` | Самостоятельный React-компонент-юнит с публичным фасетом `index.ts` |
| `ui-component` | Внутренний React-компонент ближайшего владельца без публичного фасета |

Прочитайте [template-generation](../../../.agents/skills/template-generation/SKILL.md)
и [правила TSX](../../../.claude/skills/react-reference/reference/application/components/tsx-generation.md).
Команда `create` закрепляет `@gromlab/template-file-generator@0.3.1`.
Запускайте генератор из `apps/react-admin-panel`:

```bash
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run create ui-unit example src/compositions/screens
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run create ui-component example src/compositions/screens/home/ui
```

Шаблоны создают минимальную рабочую границу без пустых каталогов и `null`-заглушек. После генерации адаптируйте её к
подтверждённому сценарию владельца в том же изменении. `ui-unit` используйте только после подтверждения отдельной
ответственности, потребителей и публичного контракта. Для локальной декомпозиции используйте `ui-component`: отсутствие
`index.ts` сохраняет компонент внутренней реализацией ближайшего владельца.

Команды выше — примеры для ещё не существующих компонентов. До запуска прочитайте все файлы
выбранного шаблона и проверьте отсутствие целевого каталога. Не создавайте TSX вручную и не используйте
`--overwrite`. Шаблонов тестов и установленного тестового стека здесь нет.
