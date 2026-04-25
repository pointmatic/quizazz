<!--
This file captures must-know facts future LLMs need to avoid blunders when
working on Quizazz. Pyve-specific conventions live in the bundled
pyve-essentials.md and are NOT duplicated here.
-->

### File header conventions

Every **new** source file begins with an SPDX-only header. Use the comment
syntax for the file type:

| File type | Comment syntax |
|-----------|----------------|
| Python, YAML, shell, Makefile | `#` |
| JavaScript, TypeScript | `//` |
| HTML, Svelte | `<!-- -->` |
| CSS, SCSS | `/* */` |

**This project's header:**

- **Copyright holder**: `Pointmatic`
- **SPDX identifier**: `Apache-2.0`

Python / YAML / shell:
```python
# Copyright (c) 2026 Pointmatic
# SPDX-License-Identifier: Apache-2.0
```

TypeScript:
```typescript
// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0
```

Svelte / HTML:
```html
<!-- Copyright (c) 2026 Pointmatic -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
```

**Existing files still carry the full Apache-2.0 boilerplate** (copyright +
10-line "Licensed under..." block). Do **not** touch the boilerplate as a
side quest when editing these files — the retrofit to SPDX-only is tracked
as a dedicated story and will happen in one sweep. New files created in the
interim use SPDX-only from the start.

---

### Generated artifacts that look hand-authored

Several files in the tree look like source but are produced by tooling.
**Never hand-edit them** — the next run of the tool overwrites the change.

- **`app/src/lib/data/*.json`** — compiled quiz manifests. Produced by
  `quizazz generate` from YAML under `data/<quiz>/`. Source of truth is the
  YAML. These JSON files are glob-imported at build time
  (`import.meta.glob('./*.json', { eager: true })`), so adding a manifest =
  dropping a JSON here; removing one = deleting the JSON. The `index.ts` in
  the same directory is the only hand-maintained file.

- **`app/static/sql-wasm.wasm`** — copied from
  `node_modules/sql.js/dist/sql-wasm.wasm` by a postinstall step. If it
  seems stale or wrong, don't edit it — reinstall sql.js.

If a future feature needs a data/JSON fixture that *is* hand-authored, put
it anywhere **except** `app/src/lib/data/` to avoid colliding with the
glob.

---

### Question IDs are content hashes

Each question's stable ID is a SHA-256 hash of the question text. This is
what the per-quiz IndexedDB uses as the primary key for `question_scores`.

**Consequence:** if you edit a question's wording in YAML and rebuild, the
ID changes and that question's cumulative score history is orphaned — the
rebuilt quiz sees a new question at score 0 while the old score row sits
unreferenced in IndexedDB.

- **Safe**: editing answer text, explanations, tags, subtopic, or
  `menu_name` / descriptions — none of these are in the ID.
- **Not safe (silently loses scores)**: editing the `question:` field.

If a question's wording genuinely needs to change, surface it — a migration
plan (or a decision that score loss is acceptable for that edit) is the
right path, not a quiet text change.

---

### CLI: only `quizazz`

There is one CLI entry point: the `quizazz` console script
(`quizazz generate` / `quizazz build` / `quizazz run`).
`python -m quizazz` also works and delegates to the same dispatch.

No other console scripts exist. If you see references to `quizazz-builder`
or `quizazz_builder` as bin scripts in old docs or examples, those were
removed — do not reintroduce them.

---

### pnpm, not npm

`app/` is a pnpm workspace with a `pnpm-lock.yaml`. Always:

```bash
pnpm --dir app <cmd>
```

`npm install` inside `app/` will produce a divergent dependency tree and
break the workspace. If pnpm is missing: `npm install -g pnpm` once, then
stop using npm for this project.

---

### Standalone build env var: both prefixed and unprefixed

`quizazz build --standalone <quiz-name>` sets **two** environment variables
before invoking the pnpm build:

- `QUIZAZZ_STANDALONE=<name>` — for the CLI and any non-Vite consumers.
- `VITE_QUIZAZZ_STANDALONE=<name>` — Vite only exposes env vars prefixed
  with `VITE_` to `import.meta.env`, so the browser-side
  `+page.svelte` reads the prefixed form.

If standalone mode isn't taking effect in the browser, the likely cause is
the `VITE_` prefix missing — check both are being set.

---

### Manifest schema is a cross-package versioning boundary

The compiled JSON manifest shape is the public contract between two
independently released packages:

- `quizazz` on PyPI (emits the manifest)
- `@pointmatic/quizazz` on npm (consumes the manifest via `<QuizBlock>`)

Breaking changes to the manifest structure (renaming a field, changing a
type, dropping a key) **must** bump the major version of both packages in
lockstep. Additive changes (new optional field) are minor bumps in the
producer and should remain a no-op in the consumer until it actually uses
them.

When editing:
- `python/src/quizazz/compiler.py` / `manifest.py` — producer side
- `app/src/lib/types/index.ts` (`QuizManifest`, `Question`, `NavNode`) — consumer side
- `app/src/lib/utils/validate-manifest.ts` — runtime upload shape check

all three must stay in sync. `validate-manifest.ts` is a **shape check only**
— full schema enforcement lives in the Python builder. Don't try to
re-enforce the full Pydantic schema in TypeScript.

---

### Archived specs

Deprecated or historical spec docs are moved to `docs/specs/.archive/`
rather than deleted. Treat archived docs as non-authoritative — they may
contradict current `features.md` / `tech-spec.md`. If an archived spec is
needed for context, read it with that framing; never copy its rules into
current work without checking against the live specs first.

---

### Bumping the manifest schema version

The cross-package versioning-boundary rule above has a concrete enforcement
point after Phase K: the `MANIFEST_SCHEMA_VERSION` constant in
`python/src/quizazz/__init__.py`.

Any change to the compiled manifest shape — renaming a field, changing a
type, adding or dropping a key — requires updating **all** of the
following in the same change:

1. Bump `MANIFEST_SCHEMA_VERSION` in `quizazz/__init__.py` (major
   if breaking, minor if additive).
2. Bump `python/pyproject.toml` `[project].version` to the matching
   major/minor.
3. Update the TypeScript `QuizManifest` interface in
   `app/src/lib/types/index.ts` to match the new shape.
4. (Post-Phase L) Bump `@pointmatic/quizazz` npm package version in
   lockstep.
5. Regenerate any checked-in sample manifest JSON files under
   `app/src/lib/data/` so they carry the new `schemaVersion` value.

Forgetting any of the above silently ships a mismatched producer /
consumer. If you're editing anything in `python/compiler.py`,
`python/manifest.py`, or `app/src/lib/types/index.ts` that touches the
emitted structure, treat this as a checklist item — not an afterthought.

---

### One project version

The project has a single version. Canonical source:
[`python/pyproject.toml`](../../python/pyproject.toml) `[project].version`,
mirrored in `python/src/quizazz/__init__.py.__version__`. Both published
packages (`quizazz` on PyPI, `@pointmatic/quizazz` on npm from Phase L)
bump to match in lockstep.

Since Phase L, [`app/package.json`](../../app/package.json) is **also a
publishable npm manifest** — it carries `name = "@pointmatic/quizazz"`, a
`version` field matched to `pyproject.toml`, `exports` / `files` / `svelte`
fields, and `publishConfig.access = "public"`. The package is still a
SvelteKit app at dev time (`pnpm dev` / `pnpm build` use the same
`package.json`); `pnpm package` produces the library artifact under
`dist/` via `@sveltejs/package`. Before Phase L it was a private workspace
root with no `version` — lockstep bumps now include it.

Loose semver `vX.Y.Z`:

- **X** — breaking changes or a big amazing new thing (e.g., first public
  release, manifest-schema break).
- **Y** — features (typically one story) or a bundle of stories once
  production is stable.
- **Z** — bug fixes and trivial changes.

**Post-1.0.0 phase-based versioning (convention).** Once `1.0.0` shipped,
stories that are planned as part of a multi-story phase release land
**unversioned**. The phase's intended release version is declared in the
phase intro, and the actual version bump (both `pyproject.toml` and
`__init__.py`) happens in the **last story of the phase**. Rationale:
phases ship together, and bumping the version mid-phase would publish
partial implementations under a stable version number. One-off stories
outside a phase still carry a version in their header and bump at
completion. Examples:

- Phase L (Embeddable Component) → `v1.1.0`; bump lands in Story L.d.
- Phase M (Standalone SPA + housekeeping) → `v1.2.0`; bump lands in
  Story M.c.

`MANIFEST_SCHEMA_VERSION` (in `quizazz/__init__.py`) is a **separate
protocol marker** embedded in every compiled manifest so consumers can
detect breakage. It aligns with the project's major.minor by convention
but only bumps on actual manifest-shape changes — not every project bump
touches it.

---

### `<QuizBlock>` single-instance guard is coupled to the singleton stores

After Phase L, `<QuizBlock>` enforces a single-instance-per-page
restriction via a module-level mount counter in
`app/src/lib/embed/QuizBlock.svelte`. The guard exists because the quiz
engine's stores (`quizSession`, `viewMode`, `reviewIndex`,
`activeManifest`) are module-level singletons — two simultaneous
`<QuizBlock>` instances would read/write the same stores and clobber each
other.

**Invariant:** the guard and the singletons go together. They must change
atomically.

- Removing the guard **without** first refactoring the stores to
  per-instance Svelte context (`setContext` / `getContext`) silently
  reintroduces the clobbering bug. Tests won't catch it — you need two
  instances on the same page to trigger it.
- Refactoring the stores to per-instance context **without** removing the
  guard produces spurious "already mounted" errors for legitimate
  multi-instance usage.

If a future phase needs multi-instance embedding, treat the store refactor
and the guard removal as one change, in one PR, with a test that renders
two `<QuizBlock>`s on the same page.

---

### Keyboard handlers in `<QuizBlock>`-reachable code must not touch `window`

`<QuizBlock>` (Phase L) scopes all keyboard handlers to its component root
via `tabindex="0"` + `on:keydown`. This is what prevents host keybindings
on the same keys (`a`–`e`, `Enter`, `Escape`, `←` / `→`) from being
hijacked when focus is outside the embedded quiz.

**Invariant:** no module reachable from `<QuizBlock>` may attach listeners
to `window` for keyboard events. The reachable set includes (at time of
writing) `QuizView`, `AnsweredQuestionsView`, `ReviewView`, `SummaryView`,
`ProgressBar`, and everything in `lib/engine/`, `lib/db/`, `lib/stores/`,
`lib/utils/format.ts`, and `lib/utils/random.ts`.

Any `window.addEventListener('keydown', ...)` in those files silently
breaks UC-3's keyboard isolation — the host loses global shortcuts for `a`
– `e` / `Enter` / `Escape` even when nothing is focused inside the
embedded quiz. Use component-root-bound listeners instead.

If a feature genuinely needs window-level key handling, it must not live
in the reachable set. Put it in `+page.svelte` or a UC-1 / UC-2-only
component (e.g., `QuizChooser`, `NavigationTree`, `ConfigView`), and make
sure nothing in the reachable set imports it transitively.
