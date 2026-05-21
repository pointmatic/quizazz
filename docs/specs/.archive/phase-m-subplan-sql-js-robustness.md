# Phase M Subplan — sql.js / WASM / IndexedDB Robustness

This subplan extends [Phase M: Hardening, Standalone Build, and Release Automation](stories.md#phase-m-hardening-standalone-build-and-release-automation) with six additional stories (**M.g – M.l**) addressing sql.js robustness gaps surfaced by the [`sql-js-wasm-robustness.md`](sql-js-wasm-robustness.md) post-mortem from the learningfoundry project. Phase M's title is broad enough to absorb this work; no new phase boundary is needed.

**Intended release version:** `v1.3.0`. Phase M's prior stories shipped at `v1.2.0`; this subplan is a Y-bump bundle (a "bundle of stories once production is stable" per the project-essentials versioning rule). Individual stories within the subplan land unversioned; the version bump lives in the last story (M.l).

**Manifest schema impact:** none. `MANIFEST_SCHEMA_VERSION` stays at `"1.0"`. This is purely internal robustness — no producer/consumer contract changes.

**Trigger:** [`docs/specs/sql-js-wasm-robustness.md`](sql-js-wasm-robustness.md) — a cross-project reference distilled from learningfoundry's progress-recording incidents (Stories I.v–I.bb, v0.55.0–v0.63.0). That document defines four gotchas (cache-hidden 404s, two-sources WASM provisioning, silent rejection cascade, locked-in IDB partitioning) and five patterns (HEAD-precheck + typed error, init memoization, single-source provisioning, repo-boundary swallow, layout-level surface).

---

## Gap Analysis

Audit of the current sql.js wiring against the source doc:

| Concern | Source doc | Current state in quizazz | Gap |
|---|---|---|---|
| Cache-hidden WASM 404s | Gotcha 1 | [`initDatabase`](../../app/src/lib/db/database.ts) calls `initSqlJs({ locateFile: f => '/' + f })` bare. No precheck, no typed error. | Gotcha applies. A 404 surfaces as an unhandled promise rejection in `onMount`; `<QuizBlock>` renders a half-initialised shell with no signal. |
| Two sources of truth for WASM | Gotcha 2 | In-tree app: `app/static/sql-wasm.wasm` is checked into git. Embed: README tells hosts to `cp` the WASM into their own `static/`. | Gotcha applies on the embed side. Documentation is exactly the failure mode the source doc warns about. |
| Silent rejection cascade | Gotcha 3 | Zero `try/catch` around [`initDatabase()`](../../app/src/lib/embed/QuizBlock.svelte#L101) in `<QuizBlock>` or [`+page.svelte`](../../app/src/routes/+page.svelte#L75). Zero around [`persistDatabase()`](../../app/src/lib/engine/lifecycle.ts#L164). No `<QuizBlock>` `onerror` callback. No layout banner. | Gotcha applies. UC-1/UC-2 → frozen blank page on init failure. UC-3 → unhandled rejection; host has no programmatic detection path. |
| Locked-in IDB partitioning | Gotcha 4 | Per-quiz `quizazz-<quizName>` from day one. | **Mitigated.** No action needed. |
| HEAD-precheck + typed error | Pattern A | Absent. | Add `WasmAssetMissingError`; precheck before `initSqlJs`. |
| Init memoization | Pattern B | Absent — relies on sql.js's own module-level cache. | Add per-instance memoization for both `initSqlJs` and the per-quiz DB open. |
| Single-source asset provisioning | Pattern C | In-tree: single source (`app/static/`). Embed: host owns the static dir; copy step is the only safety. | Move both UC-1/UC-2 and UC-3 to **Vite asset-import bundling** (`import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'`). Eliminates the checked-in `app/static/sql-wasm.wasm` and the host copy step. |
| Repo-boundary swallow | Pattern D | Absent. UI calls into `scores.ts` and `lifecycle.persistDatabase` propagate any error. | Swallow `WasmAssetMissingError` (and the broader DB-init failure types) at the [`scores.ts`](../../app/src/lib/db/scores.ts) and `persistDatabase` boundaries; reads return empty sentinels. |
| Failure surface | Pattern E | Neither shape. | UC-1/UC-2: layout-level banner in `+page.svelte` with status-aware actions. UC-3: `onerror` callback prop + `CustomEvent('error')` on the `<QuizBlock>` root + an internal fallback banner inside the component bounds. |

---

## Feature Requirements

These extend the existing FRs in [`features.md`](features.md) without breaking any of them. Numbering is suggestive — final placement is when the subplan lands.

- **FR-20 (UC-1 / UC-2 / UC-3): Loud, typed WASM failures.** When the sql.js WASM asset cannot be fetched or initialised, the app must produce a deterministic, typed error (`WasmAssetMissingError`) that callers can detect programmatically. Cache-hidden 404s and silent half-initialised states are eliminated by an explicit HEAD precheck before `initSqlJs`.
- **FR-21 (UC-3): `<QuizBlock>` host-observable failure channel.** When `<QuizBlock>` cannot initialise the database, the component must (a) call an optional `onerror` callback prop with a typed payload, (b) dispatch a `CustomEvent('error', { detail })` on the root element, and (c) render an in-bounds fallback aside explaining recording is unavailable — so the host can surface the failure even if it never wires `onerror`.
- **FR-22 (UC-1 / UC-2): Layout-level recording-paused banner.** When the in-tree app cannot initialise the database, `+page.svelte` must render a single layout-level banner whose action depends on the failure mode: `wasm-missing` → "Reload" (after infra fix); other init failures → "Reset Database" (drops and recreates the per-quiz IndexedDB). Quiz UI does not render until init resolves.
- **FR-23 (UC-3): Self-contained WASM bundling.** Hosts must not need to copy `sql-wasm.wasm` into their own `static/` directory. The published `@pointmatic/quizazz` package resolves the WASM URL via Vite's asset-import (`?url`) at the host's build time, emitting the asset into the host's build output automatically. The README's "sql.js WASM setup" section becomes a single-line note that no setup is required.
- **FR-24 (UC-1 / UC-2 / UC-3): Repo-boundary error swallow.** Score read/write functions ([`scores.ts`](../../app/src/lib/db/scores.ts)) and `persistDatabase` ([`lifecycle.ts`](../../app/src/lib/engine/lifecycle.ts)) must swallow typed init errors (which are surfaced once at the layout / `onerror` boundary) and return safe sentinels (empty arrays for reads, no-op for writes). UI components must not need per-call `try/catch`.

---

## Technical Changes

### New modules / files

- `app/src/lib/db/errors.ts` — defines `WasmAssetMissingError` (and any sibling typed init errors). Exported from `$lib/db`.
- `app/src/lib/stores/db-init.ts` — writable store of `'pending' | 'ready' | 'wasm-missing' | 'failed'`, driven by the result of `initDatabase` from the layout. UC-1/UC-2 only; `<QuizBlock>` does not install a layout-level singleton (per the source doc's guidance).
- `app/src/lib/components/RecordingPausedBanner.svelte` — UC-1/UC-2 layout banner. Reads `dbInit` store; renders status-aware action.
- `app/src/lib/embed/error-fallback.svelte` (or inline in `QuizBlock.svelte`) — internal fallback aside for `<QuizBlock>` when init fails.

### Modified modules

- [`app/src/lib/db/database.ts`](../../app/src/lib/db/database.ts):
  - Replace `locateFile: f => '/' + f` with a Vite asset-import: `import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'; locateFile: () => wasmUrl;`.
  - Add `#assertWasmAssetAvailable()` HEAD-fetch precheck with `cache: 'no-store'`.
  - Add init memoization: a single in-flight `initSqlJs` promise per module load, and a single in-flight DB-open promise per quiz name (instance-scoped if we refactor to a class; module-scoped if we keep functions).
  - Throw `WasmAssetMissingError` from `initDatabase` when the precheck fails.
- [`app/src/lib/db/scores.ts`](../../app/src/lib/db/scores.ts) and [`app/src/lib/db/index.ts`](../../app/src/lib/db/index.ts):
  - Wrap each function in a `try/catch` that swallows `WasmAssetMissingError` and returns the safe sentinel (empty array for `getScores`; no-op for `seedScores` / `updateScore` / `recordAnswer`). Add a module-comment block stating the swallow rule and *why*, so future maintainers don't refactor it away.
- [`app/src/lib/engine/lifecycle.ts`](../../app/src/lib/engine/lifecycle.ts) `persistDatabase` call site at [line 164](../../app/src/lib/engine/lifecycle.ts#L164): swallow `WasmAssetMissingError`.
- [`app/src/lib/embed/QuizBlock.svelte`](../../app/src/lib/embed/QuizBlock.svelte):
  - `try/catch` around the `initDatabase(manifest.quizName)` call in `onMount`.
  - On typed failure: set local error state, call `onerror?.(payload)`, dispatch `CustomEvent('error', { detail: payload, bubbles: true })` on the root, render the internal fallback aside.
  - Add `onerror?: (event: QuizErrorEvent) => void` prop and define `QuizErrorEvent` in [`$lib/types`](../../app/src/lib/types/index.ts).
- [`app/src/routes/+page.svelte`](../../app/src/routes/+page.svelte):
  - Wrap `initDatabase` in `try/catch`; update the `dbInit` store with the resolved status.
  - Render `<RecordingPausedBanner>` at the top of the layout when status is non-`ready`.
  - Don't render quiz UI until status is `ready`.

### Removed assets / scripts

- **Delete `app/static/sql-wasm.wasm` from the git tree.** Vite asset-import resolves it from `node_modules/sql.js/dist/` at build time and emits it into `app/build/` automatically. Source of truth becomes `node_modules` — single, owned by `pnpm install`.
- **Delete any `postinstall` step in [`app/package.json`](../../app/package.json)** that copies the WASM into `static/` (if present today).

### Published-package shape changes

- `@pointmatic/quizazz` no longer requires hosts to copy WASM. The `sql.js` peer/runtime dep continues to work via the host's own `pnpm install`; Vite resolves the `?url` import at the host's build.
- The package README's "sql.js WASM setup" section shrinks to a single sentence: *"No setup required. The WASM asset is bundled into your build output automatically by Vite."*
- This is the **breaking host-side change** referenced in Q4: existing hosts must remove their `cp node_modules/sql.js/...` step. Acceptable risk per the user's note that few existing implementations exist.

### Dependencies

- **No new dependencies.** Vite asset-import (`?url`) is built into Vite/SvelteKit. The HEAD-fetch precheck uses the platform `fetch`. Memoization is a few lines of TS.

### Tests

- New `app/tests/db/database.test.ts` (or extend an existing one): typed-error path when the WASM HEAD returns 404; precheck cache-busting; init memoization (concurrent callers share one promise).
- New `app/tests/embed/QuizBlock-error.test.ts`: `onerror` callback invoked with typed payload; `CustomEvent('error')` dispatched on root; fallback aside rendered; quiz UI not rendered.
- New `app/tests/components/RecordingPausedBanner.test.ts`: status-aware action rendering; "Reset Database" path drops + recreates the IDB entry.
- Existing tests must continue to pass without modification.
- **Caveat:** JSDOM cannot actually fetch / instantiate the WASM. Tests mock `fetch` for the HEAD precheck and mock `sql.js` for init paths. End-to-end browser verification continues to live in the post-publish host harness.

---

## Story Breakdown (M.g – M.l)

One-line summaries; full story format with task checklists is added to [`stories.md`](stories.md) in the next step (after this plan is approved).

- **M.g — `WasmAssetMissingError` + HEAD precheck.** Pattern A. New `errors.ts`; precheck in `initDatabase`; typed error replaces opaque rejection. Tests mock `fetch` for the HEAD failure path.
- **M.h — Init memoization.** Pattern B. One in-flight `initSqlJs` promise per module; one in-flight DB open per quiz name. Concurrent-callers-share-one-promise test.
- **M.i — Vite asset-import WASM bundling; eliminate `app/static/sql-wasm.wasm`.** Pattern C. Switches both UC-1/UC-2 and UC-3 to bundled WASM. Deletes the checked-in WASM and any postinstall hook. README + tech-spec updates for the new host-setup contract (one sentence: no setup needed).
- **M.j — `<QuizBlock>` `onerror` + `CustomEvent('error')` + internal fallback; `+page.svelte` layout banner.** Pattern E for both shapes. New `dbInit` store, new `RecordingPausedBanner` component. Status-aware actions: `wasm-missing` → Reload; `failed` → Reset Database.
- **M.k — Repo-boundary swallow rule.** Pattern D. `try/catch` in [`scores.ts`](../../app/src/lib/db/scores.ts) + the `persistDatabase` site in [`lifecycle.ts:164`](../../app/src/lib/engine/lifecycle.ts#L164); module-comment documenting the swallow rule. Reads return safe sentinels.
- **M.l — v1.3.0 release.** Lockstep bump: [`python/pyproject.toml`](../../python/pyproject.toml), [`python/src/quizazz/__init__.py`](../../python/src/quizazz/__init__.py) `__version__`, [`app/package.json`](../../app/package.json) `version`. Tag `v1.3.0` (PyPI) + `npm-v1.3.0` (npm). Re-run post-publish host harness against the CI-published artifacts.

Story order is the proposed implementation order; each is independently shippable on its own branch even though the bundle releases together.

---

## Out of Scope (Future Vision)

Mirrors the source doc's "What this doc doesn't cover" section. Documenting the deferral here so future work in adjacent areas doesn't accidentally re-implement what we decided to skip.

- **Cross-tab Web Locks.** Web Locks bootstrap solves the *userId* race in learningfoundry; not relevant here. Concurrent writes from two tabs of the same quiz still last-writer-wins on the IDB blob. Defer until evidence of multi-tab learner workflows.
- **Schema migration runner.** [`database.ts`](../../app/src/lib/db/database.ts) already handles additive changes via `CREATE TABLE IF NOT EXISTS` + a manual 0→1 migration for `elapsed_ms`. Column drops, type changes, and back-fills are not addressed.
- **Quota / `QuotaExceededError`.** Long sessions hitting IDB quota limits. Not surfaced today; quizazz's data volume is small (one row per question, < 1 KB per session record). Add when there's a real complaint.
- **Service worker interactions.** None of quizazz uses service workers; the wasm-cache-poisoning failure mode they enable is not currently reachable.
- **Server-side persistence sync.** The deferred `api/` FastAPI workspace; out of scope at the engine layer regardless.
- **Multi-DB lifecycle management.** quizazz opens a separate DB per quiz; cross-DB queries, open/close coordination, and quota sweeping are out of scope.

---

## Project-Essentials Impact

After M.l ships, the following may need to be added to [`docs/specs/project-essentials.md`](project-essentials.md) per the `plan_phase` final-step convention. These are candidates — the actual append happens once the stories are done, not now:

- **WASM is bundled, not copied.** New invariant: the WASM is resolved via Vite asset-import; do not reintroduce `app/static/sql-wasm.wasm`, do not add a postinstall copy step, do not tell hosts to copy.
- **Typed init errors are swallowed at the repo boundary.** The pattern in [`scores.ts`](../../app/src/lib/db/scores.ts) and `persistDatabase` is intentional; do not refactor the catches away. The single user-visible surface is the layout banner (UC-1/UC-2) or the `onerror` callback (`<QuizBlock>` UC-3).
- **`<QuizBlock>` exposes two error channels.** `onerror` callback prop and `CustomEvent('error')` on the root. They fire together, both with the same typed payload. Future event additions follow the same dual-channel convention used by `complete`.

---

## Approval

Per [`go.md`](../project-guide/go.md) `plan_phase` step 4: presenting this plan for review. On approval, step 5 adds the M.g – M.l story sections (with full task checklists, story format) to [`stories.md`](stories.md), inserted after M.f and before `## Future`.
