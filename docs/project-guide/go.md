# Project-Guide — Calm the chaos of LLM-assisted coding

This document provides step-by-step instructions for an LLM to assist a human developer in a project. 

## How to Use Project-Guide

### For Developers
After installing project-guide (`pip install project-guide`) and running `project-guide init`, instruct your LLM as follows in the chat interface: 

```
Read `docs/project-guide/go.md`
```

After reading, the LLM will respond:
1. (optional) "I need more information..." followed by a list of questions or details needed. 
  - LLM will continue asking until all needed information is clear.
2. "The next step is ___."
3. "Say 'go' when you're ready." 

For efficiency, when you change modes, start a new LLM conversation. 

### For LLMs

**Modes**
This Project-Guide offers a human-in-the-loop workflow for you to follow that can be dynamically reconfigured based on the project `mode`. Each `mode` defines a focused cycle of steps to guide you (the LLM) to help generate artifacts for some facet in the project lifecycle. This document is customized for code_test_first.

**Approval Gate**
When you have completed the steps, pause for the developer to review, correct, redirect, or ask questions about your work.  

**Rules**
- Work through each step methodically, presenting your work for approval before continuing a cycle. 
- When the developer says "go" (or equivalent like "continue", "next", "proceed"), continue with the next action. 
- If the next action is unclear, tell the developer you don't have a clear direction on what to do next, then suggest something. 
- Never auto-advance past an approval gate—always wait for explicit confirmation. 
- At approval gates, present the completed work and wait. Do **not** propose follow-up actions outside the current mode step — in particular, do not prompt for git operations (commits, pushes, PRs, branch creation), CI runs, or deploys unless the current step explicitly calls for them. The developer initiates these on their own schedule.
- After compacting memory, re-read this guide to refresh your context.
- Before recording a new memory, reflect: is this fact project-specific (belongs in `docs/specs/project-essentials.md`) or cross-project (belongs in LLM memory)? Could it belong in both? If project-specific, add it to `project-essentials.md` instead of or in addition to memory.
- When creating any new source file, add a copyright notice and license header using the comment syntax for that file type (`#` for Python/YAML/shell, `//` for JS/TS, `<!-- -->` for HTML/Svelte). Check this project's `project-essentials.md` for the specific copyright holder, license, and SPDX identifier to use.

---

## Project Essentials

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
`python/pyproject.toml` `[project].version`, mirrored in
`python/src/quizazz/__init__.py.__version__`. Both published packages
(`quizazz` on PyPI, `@pointmatic/quizazz` on npm from Phase L) bump to
match in lockstep. `app/package.json` is a private workspace root and
carries no `version` field.

Loose semver `vX.Y.Z`:

- **X** — breaking changes or a big amazing new thing (e.g., first public
  release, manifest-schema break).
- **Y** — features (typically one story) or a bundle of stories once
  production is stable.
- **Z** — bug fixes and trivial changes.

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



---

# code_test_first mode (cycle)

> Generate code with a test-first approach


Implement stories using test-driven development (TDD). Write a failing test before writing any implementation code.

**Next Action**
Restart the cycle of steps. 

---


## Cycle Steps

For each story:

1. **Read** the story's checklist from `docs/specs/stories.md`
2. For each task in the checklist:
   a. **Write a failing test** that describes the expected behavior
   b. **Run the test** -- confirm it fails (red)
   c. **Write the minimal implementation** to make the test pass
   d. **Run the test** -- confirm it passes (green)
   e. **Refactor** if needed -- clean up while tests still pass
   f. **Run full test suite** -- `pyve run pytest` -- no regressions
3. **Add copyright/license headers** to every new source file
4. **Run linting** -- fix any issues immediately
5. **Mark tasks** as `[x]` in `stories.md` and change story suffix to `[Done]`
6. **Bump version** in package manifest and source (if the story has a version)
7. **Update CHANGELOG.md** with the version entry
8. **Present** the completed story concisely: what changed (files + line refs), verification results (test counts, lint status, red-green-refactor summary), and the suggested next story. Do not propose commits, pushes, or bundling options. Do not offer "want me to also…?" follow-ups.
9. **Wait** for the developer to say "go" before starting the next story

## Red-Green-Refactor

The TDD cycle:

1. **Red** -- Write a test that fails. The test defines the desired behavior.
2. **Green** -- Write the simplest code that makes the test pass. No more.
3. **Refactor** -- Clean up the code while keeping tests green. Remove duplication, improve naming, simplify logic.

## Test Writing Guidelines

- **Test behavior, not implementation** -- assert on outputs and side effects, not internal state
- **One assertion per concept** -- each test should verify one thing
- **Use descriptive names** -- `test_override_with_nonexistent_guide_errors` not `test_override_3`
- **Prefer unit tests** -- test individual functions in isolation
- **Use integration tests sparingly** -- for verifying component interactions
- **Test edge cases** -- empty inputs, boundary values, error conditions

## Test Hierarchy

| Level | Speed | Scope | Use for |
|-------|-------|-------|---------|
| Unit | Fast | Single function | Core logic, edge cases, error paths |
| Integration | Medium | Multiple components | Verifying wiring, config loading |
| End-to-end | Slow | Full system | Final validation, smoke tests |

## When to Switch Modes

Switch to **code_direct** when:
- The story is straightforward and TDD overhead isn't justified
- The developer requests faster iteration

Switch to **debug** when:
- A bug is discovered during implementation
- Tests are failing unexpectedly and need root cause analysis

