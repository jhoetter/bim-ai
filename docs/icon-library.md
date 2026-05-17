# Icon library — bim-icons

All SVG icons used in bim-ai live in a separate, standalone repository:
**[github.com/jhoetter/bim-icons](https://github.com/jhoetter/bim-icons)**

This lets the same icon set be consumed by the bim-ai app, websites, ebooks, and any other project without duplicating source files.

## How it is wired into bim-ai

`packages/icons` is a thin workspace package (`@bim-ai/icons`) whose entire `src/index.ts` is:

```ts
export * from 'bim-icons';
```

It depends on bim-icons via a GitHub reference:

```json
// packages/icons/package.json
"dependencies": {
  "bim-icons": "github:jhoetter/bim-icons"
}
```

pnpm fetches bim-icons from GitHub at `pnpm install` time and caches it in the virtual store. No local clone of the bim-icons repo is required to build or run bim-ai.

All existing imports in the app are unchanged:

```ts
import { WallIcon, DoorHifi } from '@bim-ai/icons';
```

## Consuming bim-icons in other projects

Add the dependency to the target project's `package.json`:

```json
"dependencies": {
  "bim-icons": "github:jhoetter/bim-icons"
}
```

Then import directly:

```ts
import { WallIcon, WallHifi } from 'bim-icons';
```

All icons are 24×24 viewBox, stroke-based, `currentColor`. Props: `size`, `strokeWidth`, `absoluteStrokeWidth`, plus any SVG attribute. Hifi icons use a 48×48 viewBox.

## Updating icons

1. Edit or add source files in `~/repos/bim-icons/src/`.
2. Export new symbols from `bim-icons/src/index.ts`.
3. Commit and push to `github.com/jhoetter/bim-icons`.
4. In bim-ai (and any other consumer), run `pnpm install` to pull the updated version.

## Local development workflow

When iterating on icons while simultaneously testing them in bim-ai, switch the dependency to a local file path so changes are reflected immediately without pushing:

```sh
# inside bim-ai root
pnpm --filter @bim-ai/icons add bim-icons@file:../../../bim-icons
```

Revert to the GitHub reference before committing bim-ai:

```sh
pnpm --filter @bim-ai/icons add bim-icons@github:jhoetter/bim-icons
```
