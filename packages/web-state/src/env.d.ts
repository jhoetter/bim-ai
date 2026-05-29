/**
 * Minimal ambient typing for `import.meta.env.DEV`.
 *
 * `web-state` is consumed by `@bim-ai/web` (a Vite app), so at runtime
 * `import.meta.env` is populated by Vite. We do NOT want to take a
 * dev-dep on `vite/client` types here because `web-state` is meant to
 * be bundler-agnostic; this minimal declaration covers the single field
 * `renderCountProbe.ts` reads.
 *
 * If a future consumer doesn't set `import.meta.env.DEV`, the optional
 * chain in `shouldRecord()` falls through cleanly to `false`.
 */
interface ImportMetaEnv {
  readonly DEV?: boolean;
}

interface ImportMeta {
  readonly env?: ImportMetaEnv;
}
