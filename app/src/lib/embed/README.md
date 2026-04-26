# `@pointmatic/quizazz` — embeddable SvelteKit quiz component

`<QuizBlock>` renders a full Quizazz quiz inline in a host SvelteKit app from
a manifest produced by the Python side of the pipeline. See the project
[README](https://github.com/pointmatic/quizazz) for the YAML → manifest →
browser data flow and the `compile_assessment` library API that produces
manifests at host build time.

## Install

```bash
pnpm add @pointmatic/quizazz
```

The package declares `svelte ^5` as a peer dependency; your app must have a
Svelte 5 runtime installed (SvelteKit apps already do).

## Usage

```svelte
<script lang="ts">
  import { QuizBlock } from '@pointmatic/quizazz';
  import '@pointmatic/quizazz/styles.css';
  import type { QuizCompleteEvent } from '@pointmatic/quizazz';
  import manifest from './content/module-4-pre.json';

  function onComplete(e: QuizCompleteEvent) {
    // record e.score / e.maxScore against e.quizRef in the host's LMS/DB
  }
</script>

<QuizBlock
  {manifest}
  quizRef="module-4-pre"
  class="my-theme"
  oncomplete={onComplete}
/>
```

Props:

- `manifest: QuizManifest` (required) — the compiled manifest dict returned
  by `quizazz.compile_assessment(...)` on the Python side.
- `quizRef: string` (required) — host-supplied identifier echoed back in the
  `complete` event so the host knows which quiz finished.
- `class?: string` — optional class on the root `<section>` for theming.
- `oncomplete?: (event: QuizCompleteEvent) => void` — optional callback
  fired when the user submits the last question.

## sql.js WASM setup

`<QuizBlock>` uses [sql.js](https://sql.js.org/) for per-quiz score
persistence in IndexedDB. sql.js loads its SQLite WebAssembly binary at
runtime from a URL relative to the host origin. Copy the `.wasm` file(s)
into your app's static root:

```bash
# run once, during your host app's postinstall
cp node_modules/sql.js/dist/*.wasm static/
```

The wildcard form is the bulletproof recommendation. **sql.js ≥ 1.14** ships
two browser builds and an `exports` map that Vite (and any other bundler
honoring the `browser` package-export condition) resolves to
`dist/sql-wasm-browser.js`, which requests `sql-wasm-browser.wasm` at
runtime. Older sql.js (≤ 1.13) only ships `sql-wasm.wasm`. Copying every
`*.wasm` covers both resolutions without you having to track the package's
exact filename — a host that follows a single-file `cp .../sql-wasm.wasm`
recipe against a 1.14+ install gets `[404] /sql-wasm-browser.wasm` and the
quiz fails to mount.

If your host uses pnpm's strict (non-hoisted) layout, transitive dep files
don't appear under top-level `node_modules/sql.js/` — sql.js lives under
`node_modules/.pnpm/sql.js@<version>/node_modules/sql.js/dist/`. The
following one-liner finds the WASM either way:

```bash
find node_modules -name 'sql-wasm*.wasm' -exec cp {} static/ \;
```

Hosts that need to serve the WASM from a non-root path can override the
loader's `locateFile` — *Future Vision*: `<QuizBlock>` will expose a prop to
pass this through directly. Until then, a host-level shim that patches
`initSqlJs`'s default loader works.

## SvelteKit host setup

`<QuizBlock>` cannot server-side render. sql.js requires WebAssembly and
IndexedDB, both of which exist only in the browser, so any SSR pass on a
route that mounts the component throws during initialization. Disable SSR
on the embedding route — a one-liner in `+page.ts` (or `+layout.ts` if
several routes embed):

```ts
// src/routes/.../+page.ts
export const ssr = false;
```

Without this, hitting the route returns a 500 on first request. Prerendering
remains fine alongside (`export const prerender = true;` and
`export const ssr = false;` coexist); the quiz hydrates and runs entirely
client-side.

## Styles

`@pointmatic/quizazz` ships a precompiled stylesheet alongside the component
so hosts get a polished default look without having to set up Tailwind (or
any other CSS framework) of their own. Import it once, anywhere — typically
in the same `<script>` block where you import `<QuizBlock>`, or in your
host's root `+layout.svelte` if the embed is reused across routes:

```ts
import { QuizBlock } from '@pointmatic/quizazz';
import '@pointmatic/quizazz/styles.css';
```

The bundle (~13 KB minified) contains:

- The Tailwind v4 theme layer (CSS custom properties — colors, spacing,
  radii, font sizes) used by the component's utilities.
- Only the utility classes the embed-reachable components actually use.
  No project-wide Tailwind footprint.

What the bundle does **not** contain:

- **No Tailwind preflight / base resets.** Host pages keep their own resets
  and global element styles. The bundle won't restyle `<button>`, `<h1>`,
  `<a>`, etc. on the rest of the page.
- No `<svelte:head>` auto-injection. The `import '@pointmatic/quizazz/styles.css'`
  is explicit so the host controls load order, deduplication, and bundling.

### Hosts that already use Tailwind

If your host is already a Tailwind-based app, importing the bundle is still
safe — the Tailwind utilities resolve via the cascade. The host's own
utilities co-exist with the bundle's; there's no preflight collision because
the bundle ships none. If the same utility class is defined in both your host
build and the bundle, the cascade resolves it in document-order — typical
behavior for stacked Tailwind builds. Theming overrides via the
`--quizazz-*` CSS custom properties (see below) layer additively on top.

## Keyboard scoping

`<QuizBlock>` confines all keyboard handling to elements inside the component
root — there are **no** `window`-level listeners anywhere in the reachable
component graph. Host pages keep their global shortcuts (`a`–`e`, `Enter`,
`Escape`, `←` / `→`) when focus is outside the embedded quiz.

- The component root `<section>` is tab-focusable (`tabindex="0"`).
- The active view (`QuizView`, `ReviewView`, `AnsweredQuestionsView`, etc.)
  auto-focuses its own root on mount, so users can start typing immediately
  after the quiz loads.
- If the user tabs away, keyboard shortcuts inside the quiz stop firing.
  Clicking anywhere inside the quiz restores focus.

## CSS custom properties (theming)

All theming is opt-in and cascades through the DOM — set any of the following
custom properties on `<QuizBlock>`'s root, any ancestor, or `:root` to override
the default.

| Variable                              | Default      | Where it's used                     |
| ------------------------------------- | ------------ | ----------------------------------- |
| `--quizazz-color-correct`             | `#34d399`    | Correct-answer indicator color      |
| `--quizazz-color-incorrect`           | `#f87171`    | Incorrect-answer indicator color    |
| `--quizazz-color-partially-correct`   | `#fbbf24`    | Partially-correct category accent   |
| `--quizazz-color-ridiculous`          | `#c084fc`    | Ridiculous category accent          |
| `--quizazz-radius`                    | `1rem`       | Card / button corner radius         |
| `--quizazz-font-family`               | `inherit`    | Root font family                    |

Example — theme via a wrapping class:

```html
<style>
  .my-theme {
    --quizazz-color-correct: oklch(0.72 0.17 145);
    --quizazz-color-incorrect: oklch(0.62 0.24 25);
    --quizazz-radius: 0.5rem;
  }
</style>

<QuizBlock class="my-theme" manifest={...} quizRef="module-3" />
```

## `complete` event

When the final question is submitted, `<QuizBlock>` emits a completion event
in two forms so hosts can pick whichever fits their idioms:

- **Callback prop** — `oncomplete={(e) => ...}` receives a plain object:
  `{ quizRef, score, maxScore, questionCount }`.
- **DOM event** — the root section dispatches a bubbling `CustomEvent('complete')`
  with the same payload in `event.detail`. Hosts can listen anywhere up the DOM
  tree.

Semantics:

- `score` is the number of correct answers in the just-completed session.
- `maxScore` equals `questionCount`, which equals `manifest.questions.length`.
- The event fires **exactly once** per completed session. On retake, it fires
  again only when the retake itself reaches the last question.

## Single-instance-per-page

Only one `<QuizBlock>` may be mounted at a time on the same page. A defensive
mount-counter guard in the component enforces this — a second concurrent
mount renders a visible error aside and logs to the console, naming both the
already-mounted `quizRef` and the blocked one.

The restriction exists because the quiz engine's Svelte stores
(`quizSession`, `viewMode`, `reviewIndex`, `activeManifest`) are module-level
singletons. Lifting the stores to per-instance context is deferred — when it
lands, the guard goes with it in the same change.

## Schema-version compatibility

`<QuizBlock>` soft-checks the manifest's `schemaVersion` field against the
major version it was built for (`MANIFEST_SCHEMA_VERSION_MAJOR`, currently
`1`). A mismatched major renders a warning aside inside the component root,
then proceeds to render the quiz normally — a manifest produced by a future
major version may work, partially work, or behave unexpectedly, and the
warning makes that visible to the user.

Manifests missing `schemaVersion` are treated as `"1.0"` (pre-Phase-K
manifests predate the field).
