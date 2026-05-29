# Migration notes

External-facing breaking changes to bim-ai packages. Internal-only refactors
are tracked in `spec/trackers/code-quality-debt-tracker.md`.

## 2026-05 — `@bim-ai/hofos-ui` removed (ARCH-CQ-04)

The `@bim-ai/hofos-ui` package has been deleted. It was a thin re-export
shell over `@bim-ai/ui` + `@bim-ai/design-tokens` and the same surface is now
exposed directly from `@bim-ai/ui` via `"exports"` subpath maps.

Migration for external consumers:

```diff
- import { BIM_HOFOS_UI_EMBED_VERSION } from '@bim-ai/hofos-ui';
+ import { BIM_HOFOS_UI_EMBED_VERSION } from '@bim-ai/ui';
```

`@bim-ai/design-tokens` continues to be published as its own package; pull
tokens from there as before. There are no known external consumers at the
time of this change.
