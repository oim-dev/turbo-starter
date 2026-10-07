# Admin scaffolds

- `component` creates a visual React component with props, CSS Module and local export.
- `screen` creates a composition screen with props, CSS Module and public export.
- `route` creates a React Router composition that connects a same-named screen.

Run from `apps/admin`:

```bash
pnpm dlx @gromlab/create component example src/domains/example/components
pnpm dlx @gromlab/create screen example src/compositions/screens
pnpm dlx @gromlab/create route example src/compositions/routes
```
