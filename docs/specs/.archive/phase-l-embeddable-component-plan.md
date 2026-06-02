# Phase L Plan — LearningFoundry Integration: Embeddable Component

Combined mini-concept / features / tech-spec for Phase L.

For full specifications see [`concept.md`](concept.md), [`features.md`](features.md), [`tech-spec.md`](tech-spec.md), and the integration contract in [`learningfoundry-dependency-spec.md`](learningfoundry-dependency-spec.md). Phase L is the SvelteKit half of the UC-3 effort that began with Phase K.

| Phase | Scope |
|-------|-------|
| K (done in planning) | Python library API: `compile_assessment`, `validate_assessment`, `ValidationError`, `schemaVersion`, PyPI release |
| **L (this plan)** | SvelteKit `<QuizBlock>` component; npm release of `@pointmatic/quizazz` 1.0.0 |
| M (future) | UC-1 `quizazz build --standalone <name>`; legacy CLI removal; SPDX-header retrofit |

---

## Gap Analysis

### What exists

- Full quiz engine in TypeScript: `lib/engine/{selection, presentation, scoring, mastery, lifecycle}.ts`, `lib/db/{database, scores}.ts`, `lib/stores/{quiz, manifest}.ts`.
- Per-quiz IndexedDB, weighted selection, deferred scoring, mid-quiz review, post-quiz summary + drill-down — all wired end-to-end in `app/src/routes/+page.svelte` driven by the `viewMode` store.
- Components: `NavigationTree`, `ConfigView`, `QuizView`, `AnsweredQuestionsView`, `ReviewView`, `SummaryView`, `ProgressBar`, `QuizChooser`, `ManifestUpload`.
- Post-Phase K: `QuizManifest.schemaVersion` is an optional TypeScript field; manifests carry `schemaVersion: "1.0"` in their JSON payload.
- No embed path. The quiz engine is only reachable via `+page.svelte` and its state machine (nav → config → quiz → summary → review).
- No npm-published package. The `app/` workspace builds a full SPA, not a library.
- Keyboard handling: TBD per-implementation — but the existing SPA is a single full-page experience, so current handlers assume they own the page. Any `window.addEventListener('keydown', ...)` in current code would leak into a host if naively reused inside `<QuizBlock>`.

### What's needed for learningfoundry

From [`learningfoundry-dependency-spec.md`](learningfoundry-dependency-spec.md) §RR-1 / RR-2 / RR-3:

1. **`<QuizBlock>` component** with `manifest` and `quizRef` props; emits a `complete` event carrying `{quizRef, score, maxScore, questionCount}`.
2. **Self-contained** — no nav, no chooser, no upload; runs the whole manifest as the assessment unit.
3. **Per-quiz IndexedDB isolation** keyed by `manifest.quizName`, separate from any host database.
4. **Keyboard interaction** works without leaking events to the host (letter keys, Enter, Escape, ←/→).
5. **Themeable** via Tailwind utility classes or CSS custom properties.
6. **Distributed as `@pointmatic/quizazz` on npm**, consumable from a host SvelteKit app with `pnpm add @pointmatic/quizazz`.

### Delta

| Need | Current | Phase L change |
|------|---------|----------------|
| Embeddable component | None | New `app/src/lib/embed/QuizBlock.svelte` |
| Public package entry | None | New `app/src/lib/embed/index.ts` barrel |
| Keyboard scoping | Page-level | Component-root `tabindex=0` + `on:keydown` on the root; no `window` listeners |
| Completion event | Summary UI only | `complete` event dispatched + `oncomplete` callback prop supported |
| `schemaVersion` handling | Present in manifest, unused | Component reads it on mount; soft-warn (console) on unknown major |
| Theming | App-level Tailwind only | Component accepts Tailwind class pass-through + exposes CSS custom properties for key colors/spacing |
| npm packaging | None | `@sveltejs/package` config; `package.json` `exports`, `peerDependencies`; publish `@pointmatic/quizazz 1.0.0` |

---

## Feature Requirements (mini-features)

### FL-1: `<QuizBlock>` component API

```svelte
<script>
  import { QuizBlock } from '@pointmatic/quizazz';
  import type { QuizManifest, QuizCompleteEvent } from '@pointmatic/quizazz';

  let manifest: QuizManifest = /* host-supplied */;

  function handleComplete(e: QuizCompleteEvent) {
    // host writes to its own progress DB
  }
</script>

<QuizBlock {manifest} quizRef="foo.module-4.pre" oncomplete={handleComplete} />
```

**Props:**
- `manifest: QuizManifest` (required) — compiled manifest produced by `compile_assessment` (Phase K).
- `quizRef: string` (required) — host-supplied unique identifier for this quiz instance; echoed back in the completion event.

**Events / callbacks:**
- `oncomplete?: (e: QuizCompleteEvent) => void` — called on quiz completion with `{quizRef, score, maxScore, questionCount}`.
- Also dispatches `CustomEvent('complete', { detail })` on the component root for hosts using the classic event-dispatcher pattern.

**Behavior:**
- On mount, initializes the per-quiz IndexedDB (`quizazz-<manifest.quizName>`) and starts a quiz over the manifest's **full question set** (no host-side scoping, count, or tag filter in v1).
- Default `answerCount = 4` (fixed; overriding is Future Vision per features.md).
- Runs the core flow: answer selection → submit → (optional mid-quiz review) → last-question completion → results summary → drill-down. Retake is offered; Start/Quit are not (they don't make sense without a nav tree).
- Fires `complete` exactly once per end-of-quiz. Retake does not re-fire.
- Does not mutate the `manifest` prop; treats it as read-only.

### FL-2: Keyboard event scoping

- The component root is a focusable element (`tabindex="0"`, styled unobtrusively so the focus ring is visible when the user tabs into it).
- All keyboard handlers are attached to the root via `on:keydown`, not to `window`.
- Supported keys match features.md FR-9 and FR-13: `a`–`e`, `Enter`, `Escape`, `←`, `→`.
- When the host's focus is outside the component, no Quizazz keybinding fires. When focus is inside, the host's keybindings for the same keys may still fire — the component does not call `stopPropagation` or `preventDefault` by default. Host authors who need to shield global shortcuts can opt in via the `trap-keys` prop.

### FL-3: `schemaVersion` compatibility check

- On mount, the component reads `manifest.schemaVersion`.
- If **absent**: treat as `"1.0"` (pre-Phase-K manifests).
- If **present and major matches** `MANIFEST_SCHEMA_VERSION_MAJOR` compiled into the component: proceed normally.
- If **present and major differs**: render a non-fatal `<aside>` inside the component warning that the manifest was produced by a newer/older major version; continue rendering on a best-effort basis.
- This is intentionally soft for v1 — strict mismatch refusal is deferred until 2.x is introduced.

### FL-4: Theming hooks

- Accepts an optional `class` pass-through prop that is applied to the component root, so hosts can add their own Tailwind utility classes (`<QuizBlock class="max-w-2xl mx-auto" ... />`).
- Exposes CSS custom properties for the main color/spacing tokens (e.g., `--quizazz-color-correct`, `--quizazz-color-incorrect`, `--quizazz-radius`, `--quizazz-font-family`). A minimal set documented in the package README.
- No opinionated dark/light mode toggle — host controls the color scheme via CSS.

### FL-5: npm packaging — `@pointmatic/quizazz` 1.0.0

- Published via `@sveltejs/package`, driven by `svelte.config.js` `package` config.
- `app/package.json` gains `exports`, `peerDependencies`, and appropriate `publishConfig`:
  - `exports["."]` points at `./dist/embed/index.js` with `types` and `svelte` condition entries
  - `peerDependencies`: `svelte ^5`
  - `dependencies`: `sql.js ^1` (bundled transitively or required of host? See FL-6.)
- Package emits to `app/dist/` and is published from there.
- Excluded from the package: `routes/`, `QuizChooser`, `ManifestUpload`, standalone-build machinery, sample data, `+page.svelte`, app-level CSS.
- First release: matches the then-current project version (both published packages bump in lockstep with the single project-version stream — see `project-essentials.md § One project version`).
- CI automation is out of scope; manual release is sufficient for v1.

### FL-7: Single-instance defensive guard

Because `<QuizBlock>` v1 shares module-level singleton stores (`quizSession`, `viewMode`, `reviewIndex`, `activeManifest`), only one instance may be mounted per page at a time. This is an **enforced restriction**, not a silent limitation.

**Behavior:**

- A module-level mount counter in `QuizBlock.svelte` increments in `onMount` and decrements in `onDestroy`.
- On mount, if the counter is already > 0, the component **does not initialize** a per-quiz DB, start a quiz, or wire keyboard handlers. Instead it renders a prominent error `<aside>` inside its own root explaining:
  - That only one `<QuizBlock>` may be mounted at a time in v1.
  - The `quizRef` that failed to mount (so a host developer can identify which instance collided).
  - A pointer to the package README's "Single-instance-per-page" section.
- The component also logs a `console.error` with the same information, so the error is visible even if the host suppresses the inline rendering.
- No `complete` event is dispatched from a blocked instance.
- Unmounting the first instance decrements the counter; a subsequent mount works normally.

**Scope note:** This guard catches the documented v1 restriction. If a future phase introduces per-instance context scoping (setContext/getContext), the guard is removed in the same change.

### FL-6: sql.js WASM distribution

- `@pointmatic/quizazz` declares `sql.js` as a regular `dependency` so the host installs it automatically.
- The WASM binary (`sql-wasm.wasm`) is **not** bundled inside `@pointmatic/quizazz`. Instead the package README instructs hosts to:
  - Copy `node_modules/sql.js/dist/sql-wasm.wasm` to their app's static root, OR
  - Configure their bundler to serve the WASM from `node_modules/sql.js/dist/` directly.
- The component initializes sql.js with `locateFile: (f) => '/' + f` (same as the app today). Hosts with non-root public paths can override via a `wasmPath` prop (stretch; consider after the core flow works).

---

## Technical Changes (mini-tech-spec)

### New modules

| File | Purpose |
|------|---------|
| `app/src/lib/embed/QuizBlock.svelte` | The embeddable component itself |
| `app/src/lib/embed/index.ts` | Public barrel — exports `QuizBlock` and types |
| `app/src/lib/embed/schema-version.ts` | `MANIFEST_SCHEMA_VERSION_MAJOR` constant + compatibility check helper |
| `app/tests/embed/QuizBlock.test.ts` | Component tests using `@testing-library/svelte` |

### Modified modules

| File | Change |
|------|--------|
| `app/svelte.config.js` | Add `package` config (output dir `dist/`, entry `src/lib/embed/index.ts`) |
| `app/package.json` | Add `name` (`@pointmatic/quizazz`), `exports`, `peerDependencies`, `publishConfig.access = "public"`, `files`, `keywords`, `description`; bump to `1.0.0` for the embed package version stream |
| `app/src/lib/stores/quiz.ts` | (Possibly) extract the singleton stores into a factory to support one-instance-per-component. See Design Decision below. |
| `app/src/lib/engine/lifecycle.ts` | Accept an optional context to avoid reading from module-singleton state, if the singleton decision warrants it. |

### Design decision — singleton stores vs. per-instance contexts

The current app uses module-level singletons for `quizSession`, `viewMode`, `reviewIndex`, `activeManifest`. If a host page mounts **two** `<QuizBlock>` components simultaneously, they'd both read/write the same singletons and clobber each other.

**Decision for v1:** `<QuizBlock>` is single-instance-per-page, **defensively enforced** via the mount-counter guard in FL-7. The learningfoundry contract does not require multi-instance rendering, so this is sufficient. A silent singleton-collision is a class of bug that's hard to diagnose, so the guard catches it at the moment of violation.

**If multi-instance is needed later:** refactor the stores into a Svelte context (`setContext`/`getContext`) factory so each component instance gets isolated state, and remove the mount-counter guard in the same change. That's a Phase-M+ concern.

### New dependencies

None beyond what the app already uses. `@sveltejs/package` is provided by `@sveltejs/kit`.

### Data model changes

None. Phase K already added the `schemaVersion` field; Phase L consumes it.

### Public package contents

`@sveltejs/package` emits to `app/dist/`:

- `embed/QuizBlock.svelte` + `.svelte.d.ts`
- `embed/index.js` + `.d.ts`
- `embed/schema-version.js` + `.d.ts`
- Compiled internal modules the component imports: `engine/`, `db/`, `stores/`, `types/`, `utils/format.ts`, `utils/random.ts`
- Package metadata + README

Explicitly **not** published:
- `routes/`, `QuizChooser.svelte`, `ManifestUpload.svelte`, `NavigationTree.svelte`, `ConfigView.svelte` (the nav/chooser UI isn't part of the embed surface)
- `utils/validate-manifest.ts` (runtime upload is UC-2-only)
- `lib/data/*.json`, sample manifests
- `static/sql-wasm.wasm` (host serves this)

### Test coverage additions (`app/tests/embed/QuizBlock.test.ts`)

- Renders with a valid manifest: root element exists, `QuizView` visible.
- Per-quiz IndexedDB is initialized on mount under `quizazz-<quizName>`; isolated from any `quizazz-*` used by UC-1/UC-2 fixtures.
- Manifest prop is never mutated (deep-clone compare after a full quiz run).
- All-correct run → emits `complete({quizRef, score: N, maxScore: N, questionCount: N})` exactly once.
- All-incorrect run → emits `complete({score: -5N, ...})` (with scoring sign correct).
- Retake reshuffles answers, does not re-fire `complete` until the retake finishes, and accumulates cumulative scores in the DB.
- Keyboard scoping: with focus **outside** the component root, pressing `a` does nothing; with focus **inside**, pressing `a` selects answer A.
- Schema mismatch: major-version-bumped manifest renders a non-fatal warning `<aside>` and still runs the quiz.
- `oncomplete` callback prop is called; `CustomEvent('complete', { detail })` also dispatches (both paths work).
- **Single-instance guard**: mounting a second `<QuizBlock>` while a first is mounted renders the error aside, does not initialize a DB for the second instance, does not dispatch `complete` from the second instance, and emits a `console.error` with both `quizRef` values. Unmounting the first and then mounting a new one works normally.

### Release polish

- `app/package.json` fields for publication: `name`, `version` (1.0.0), `description`, `keywords`, `license` (Apache-2.0), `author`, `repository.url`, `homepage`, `peerDependencies`, `dependencies` (`sql.js`), `exports`, `files` (whitelist of what ships), `publishConfig.access` (`public`).
- A package-level README (`app/README.md` or a dedicated `app/src/lib/embed/README.md` consumed by `@sveltejs/package`) covering: install, usage example, sql.js WASM setup, theming tokens, schema-version compatibility, single-instance-per-page note.

---

## Out of Scope (deferred to later phases)

- **UC-1 `quizazz build --standalone <name>`** — Phase M.
- **Legacy CLI script removal** (`quizazz`, `quizazz` console entries) — Phase M.
- **SPDX header retrofit** — Phase M.
- **CI-based npm publication** — manual is sufficient for 1.0.0.
- **Multi-instance `<QuizBlock>` on the same page** — document as a single-instance limitation in v1; refactor deferred.
- **Host-supplied scope / question-count / tag-filter props** — Future Vision per features.md.
- **Per-question outcome streaming in `complete`** — Future Vision per features.md.
- **Strict schema-version rejection on mismatch** — soft-warn is sufficient while only 1.x exists.
- **Dark/light mode built-in** — host controls via CSS custom properties.

---

## Constraints

- **Phase K must be landed first.** Phase L depends on `schemaVersion` being present in the manifest and `quizazz 1.0.0` being published (so the versioning lockstep is real).
- **No UC-1 / UC-2 regression.** All existing app behaviors (chooser, upload, nav, config, quiz flow, review) must continue to work unchanged. The refactor to extract `<QuizBlock>` must not alter `+page.svelte`'s user-visible behavior.
- **`<QuizBlock>` must be pure-static-renderable.** No SSR dependencies, no network requests, no dynamic imports of anything a host can't ship.
- **Tailwind 4 classes in the published bundle must compose cleanly with host Tailwind.** Use a documented layer order; avoid `@layer base` overrides that would stomp host styles.
- **Svelte 5 runes only.** The component is authored in runes syntax (`$state`, `$derived`, `$props`); do not fall back to legacy reactive syntax.
- **Single `<QuizBlock>` per page in v1**, **defensively enforced** (FL-7). A second mount renders an error aside and logs to the console rather than silently corrupting shared-store state. The stores-refactor for multi-instance remains out of scope.
- **Test suite stays green.** All existing builder + app tests pass; new component tests add to the count.
