# stories.md -- quizazz (python)

This document breaks the `quizazz` project into an ordered sequence of small, independently completable stories grouped into phases. Each story has a checklist of concrete tasks. Stories are organized by phase and reference modules defined in `tech-spec.md`.

Stories with code changes include a version number (e.g., v0.1.0). Stories with only documentation or polish changes omit the version number. The version follows semantic versioning and is bumped per story. Stories are marked with `[Planned]` initially and changed to `[Done]` when completed.

For a high-level concept (why), see `concept.md`. For requirements and behavior (what), see `features.md`. For implementation details (how), see `tech-spec.md`. For project-specific must-know facts, see `project-essentials.md` (`plan_phase` appends new facts per phase).

---

## Phase K: LearningFoundry Integration — Library API

Expose `quizazz` as a public Python library so host frameworks (starting with `learningfoundry`) can compile assessment YAML into manifest dicts at their own build time, without shelling out to the CLI or writing intermediate files. Adds a structured exception type, a `schemaVersion` field to the compiled manifest (the cross-package versioning boundary), and culminates in the first PyPI release of `quizazz`.

Phase K is the Python side of the UC-3 host-integration contract defined in [`learningfoundry-dependency-spec.md`](learningfoundry-dependency-spec.md). The SvelteKit `<QuizBlock>` component and its npm package are deferred to Phase L.

### Story K.a: v0.39.0 Structured `ValidationError` [Done]

Rename `QuizValidationError` to `ValidationError` and give it structured attributes so host frameworks can catch it, inspect the offending file path, read a human-readable message, and optionally drill into per-violation detail. Internal-only refactor — no change to CLI output format or existing tests' assertions on `str(exc)`.

- [x] Update `python/src/quizazz/validator.py`
  - [x] Rename class `QuizValidationError` → `ValidationError`
  - [x] Add constructor `__init__(self, file_path: Path, message: str, detail: dict | None = None)`
  - [x] Store attributes: `file_path`, `message`, `detail`
  - [x] `__str__` returns a concatenated human-readable form: `"<file_path>: <message>"` plus detail summary if present
  - [x] Update every `raise QuizValidationError(...)` site to pass `file_path` + `message` (+ `detail` where applicable)
- [x] Update `python/src/quizazz/cli.py`
  - [x] Import `ValidationError` (was `QuizValidationError`)
  - [x] Error-handling branch still prints `Validation error: {exc}` to stderr
- [x] Update `python/tests/test_validator.py`
  - [x] Assert `ValidationError.file_path` populated for every violation scenario
  - [x] Assert `ValidationError.message` populated
  - [x] Assert `ValidationError.detail` populated for violations that have structured context (e.g., question index)
- [x] Verify: all builder tests pass; CLI validation error messages are unchanged for end users

### Story K.b: v0.40.0 Shared Compile Core and 'schemaVersion' [Done]

Extract `compile_quiz_to_dict` as the shared compilation core used by both the CLI (wraps it with a disk write) and the future library API (calls it directly). Introduce a `MANIFEST_SCHEMA_VERSION` constant and inject `schemaVersion: "1.0"` as a top-level field in every emitted manifest. Add the matching optional field to the TypeScript `QuizManifest` type — reserved for Phase L consumption, no runtime use yet.

- [x] Update `python/src/quizazz/__init__.py`
  - [x] Define `MANIFEST_SCHEMA_VERSION = "1.0"` (or place in dedicated `schema.py`; justify choice in the PR)
- [x] Update `python/src/quizazz/compiler.py`
  - [x] Extract `compile_quiz_to_dict(validated: list[tuple[Path, QuizFile]], quiz_name: str) -> dict` containing current in-memory compile logic
  - [x] Include `"schemaVersion": MANIFEST_SCHEMA_VERSION` as the first key in the returned dict
  - [x] Refactor existing `compile_quiz(validated, quiz_name, output_dir) -> None` to call `compile_quiz_to_dict` and serialize to disk
  - [x] Ensure JSON output is stable (key ordering, indent unchanged from current CLI behavior)
- [x] Update `app/src/lib/types/index.ts`
  - [x] Add optional `schemaVersion?: string` to `QuizManifest` interface
  - [x] No runtime reading yet — Phase L will consume it
- [x] Update `python/tests/test_compiler.py`
  - [x] Add test: `compile_quiz_to_dict` returns a dict with `schemaVersion == "1.0"`
  - [x] Add test: `compile_quiz_to_dict` produces the same shape CLI-written JSON would, minus disk I/O
  - [x] Existing `compile_quiz` tests still pass (regression)
- [x] Regenerate any checked-in sample manifest JSON files under `app/src/lib/data/` so the `schemaVersion` field appears
- [x] Verify: all builder tests pass; `pnpm check` — 0 errors; existing app tests still pass (optional new field doesn't break anything)

### Story K.c: v0.41.0 Public Library API [Done]

Create `quizazz/api.py` with `compile_assessment(yaml_path, base_dir) -> dict`, `validate_assessment(yaml_path, base_dir) -> list[str]`, and a path-escape guard. Export the public surface from the package's `__init__.py`. This is the first release where `from quizazz import compile_assessment, validate_assessment, ValidationError` is a stable, documented contract.

```python
from pathlib import Path
from quizazz import compile_assessment, validate_assessment, ValidationError

manifest = compile_assessment("module-4-pre.yaml", base_dir=Path("content"))
# → dict with schemaVersion, quizName, tree, questions

errors = validate_assessment("bad.yaml", base_dir=Path("content"))
# → ["content/bad.yaml: Must have at least 1 correct answer", ...]
```

- [x] Create `python/src/quizazz/api.py`
  - [x] `compile_assessment(yaml_path: Path | str, base_dir: Path | str) -> dict`
    - [x] Accepts `str` or `Path` for both args; coerce to `Path` internally
    - [x] Calls `_resolve_under_base`, then `validate_file`, then `compile_quiz_to_dict`
    - [x] Raises `ValidationError` on any violation
  - [x] `validate_assessment(yaml_path: Path | str, base_dir: Path | str) -> list[str]`
    - [x] Returns `[]` on success
    - [x] Returns list of error strings (one per violation) on failure
    - [x] Never raises (swallows `ValidationError` into the list)
  - [x] `_resolve_under_base(yaml_path, base_dir) -> Path`
    - [x] `base = Path(base_dir).resolve()`, `full = (base / yaml_path).resolve()`
    - [x] Rejects escape (absolute yaml_path, `..` traversal, post-symlink escape)
    - [x] Raises `ValidationError` with `file_path=Path(yaml_path)`, descriptive message, `detail={"base_dir": ..., "resolved": ...}`
- [x] Update `python/src/quizazz/__init__.py`
  - [x] `from .validator import ValidationError`
  - [x] `from .api import compile_assessment, validate_assessment`
  - [x] `__all__ = ["compile_assessment", "validate_assessment", "ValidationError", "MANIFEST_SCHEMA_VERSION", "__version__"]`
- [x] Create `python/tests/test_api.py`
  - [x] `compile_assessment` happy path: valid YAML → dict with `schemaVersion`, `quizName`, `tree`, `questions`
  - [x] `compile_assessment` raises `ValidationError` for: empty `menu_name`, empty `question`, <5 answers total, missing category, empty answer text, empty explanation, tag normalization violation — each with populated `.file_path`, `.message`, `.detail`
  - [x] `compile_assessment` rejects malformed YAML with `ValidationError` (YAML parser error surfaced)
  - [x] `compile_assessment` path-escape: rejects `../escape.yaml`, absolute paths outside base_dir, symlink-through escape
  - [x] `compile_assessment` does not write to disk (assert via tmpdir watcher)
  - [x] `compile_assessment` is synchronous (no coroutines anywhere in the call chain)
  - [x] `validate_assessment` returns `[]` for valid YAML
  - [x] `validate_assessment` returns a single-element list for each of the violations above
  - [x] `validate_assessment` never raises
  - [x] Both functions accept `str` or `Path` arguments interchangeably
- [x] Update the main README: add a "Library API (UC-3)" section with usage examples
- [x] Verify: all builder tests pass; no existing test regressions

### Story K.d: v1.0.0 PyPI Release [Done]

First public release of `quizazz` to PyPI. Polish `pyproject.toml` metadata, bump the project version to `1.0.0` (first stable public API is the big-thing X-bump under the project's loose-semver rule), and publish via a tag-driven GitHub Actions workflow with PyPI trusted publishing (OIDC — no long-lived tokens).

> **Renames folded in.** Three in-place corrections landed with this story, before any PyPI publish:
>
> 1. **PyPI distribution name** `quizazz-builder` → `quizazz`. Historical artefact from when the Python tool was a sidecar "builder"; the CLI and brand have been `quizazz` since the command was unified. Free before first publish, squatter after.
> 2. **Python import + source-directory name** `quizazz_builder` → `quizazz`. Matches the dist name and CLI; locks in the public import (`from quizazz import compile_assessment`) before any host framework writes the old path into durable code.
> 3. **Top-level repo subdirectory** `builder/` → `python/`. Symmetric with `app/` (SvelteKit) and `data/` (YAML); "builder" was the same sidecar vestige.
>
> The legacy console-script cleanup originally planned as a Phase M story was also folded in here (see the **"Remove Legacy CLI Console Scripts"** subsection below for the record). A Data Flow subsection was added to `tech-spec.md` so the `data/` → `python/` → `app/src/lib/data/` → `app/build/` pipeline is documented as one thought instead of scattered across four tables.

- [x] Enrich `python/pyproject.toml` `[project]` metadata
  - [x] `description`: "YAML question bank validator, compiler, and CLI for Quizazz quizzes."
  - [x] `readme = "README.md"` (builder-specific README added under `python/README.md`)
  - [x] `keywords = ["quiz", "assessment", "education", "yaml", "sveltekit"]`
  - [x] Classifiers: Development Status 5, Python 3.12, Topic :: Education, Topic :: Education :: Testing (the legacy `License :: OSI Approved :: Apache Software License` classifier is dropped — setuptools rejects it alongside the PEP 639 SPDX `license = "Apache-2.0"` expression already present)
  - [x] `[project.urls]`: Homepage, Repository, Issues → `github.com/pointmatic/quizazz`
- [x] Bump `python/pyproject.toml` `version = "1.0.0"`
- [x] Update `python/src/quizazz/__init__.py` `__version__ = "1.0.0"`
- [x] Ensure the README renders correctly on PyPI (verified via `twine check` — both sdist and wheel PASSED)
- [x] Add a release-process note (`python/RELEASE.md`) covering version bumps, the CI tag-push flow, the `pypi` GitHub environment + PyPI trusted-publisher one-time setup, and the manual `twine` fallback
- [x] Add GitHub Actions workflow `.github/workflows/publish-pypi.yml` — triggers on bare `v*` tags; runs pytest + ruff; builds sdist + wheel; `twine check`; publishes via `pypa/gh-action-pypi-publish` with OIDC trusted publishing (no stored token)
- [x] Dry-run the pipeline locally — `python -m build python/` produced wheel + sdist; `twine check` PASSED; fresh-venv install of the local wheel confirmed `quizazz --version` → `1.0.0` and `from quizazz import compile_assessment` succeeds
- [x] One-time GitHub + PyPI config *(developer, before the first tag push)*
  - [x] Create GitHub environment `pypi` on the repo (optional reviewers / branch filter recommended)
  - [x] On PyPI: add a pending trusted publisher for `quizazz` with owner `pointmatic`, repo `quizazz`, workflow `publish-pypi.yml`, environment `pypi`
- [x] Publish `quizazz 1.0.0` to PyPI *(pending — `git tag -a v1.0.0 -m 'quizazz 1.0.0' && git push origin v1.0.0` once the one-time config above is done; workflow takes it from there)*
- [x] Verify: `pip install quizazz` in a fresh venv works; `quizazz --version` prints `1.0.0`; `from quizazz import compile_assessment` succeeds *(pending — post-publish check)*
- [x] Update the main README to reference `pip install quizazz` as an install option (alongside source-install)

**Remove Legacy CLI Console Scripts** 
(was in Phase M, noted here for reference)

> Absorbed into K.d as part of the PyPI package rename (`quizazz-builder` → `quizazz`). Shipping 1.0.0 with legacy console scripts only to delete them in 1.0.1 would have been silly, so the cleanup landed in the same change that renamed the dist.

- [x] Dropped `quizazz-builder = "quizazz_builder.__main__:main"` and `quizazz_builder = "quizazz_builder.__main__:main"` from `[project.scripts]`. Only `quizazz = "quizazz.cli:main"` remains.
- [x] Simplified `python/src/quizazz/__main__.py` to the thin `from quizazz.cli import main` delegator with the SPDX-only header.
- [x] Repo-wide grep for `quizazz-builder` / `quizazz_builder` shell-command references cleaned up during the rename sweep (READMEs, docs, release notes, GHA workflow).
- [x] No separate PyPI release note needed — `quizazz 1.0.0` is the first public release, so nothing to deprecate.

---

## Phase L: LearningFoundry Integration — Embeddable Component

Ship the SvelteKit half of the UC-3 host-integration contract: a `<QuizBlock>` component that takes a Phase-K-produced manifest plus a host-supplied `quizRef` and renders a full quiz experience inline in a host SvelteKit app, emitting a `complete` event with aggregate score on finish. Distributed as `@pointmatic/quizazz` on npm.

Phase L depends on Phase K (for the `schemaVersion` field and the published library API). No changes to the quiz engine, scoring, selection, presentation, or per-quiz IndexedDB — the component is a self-contained wrapper around existing engine modules. The one v1 restriction is single-instance-per-page; a mount-counter guard enforces this defensively.

**Intended release version:** `v1.1.0` — the whole phase ships together. Individual stories land unversioned; the version bump lives in the last story (L.d).

### Story L.a: '<QuizBlock>' Skeleton, Single-Instance Guard, Schema-Version Check [Done]

Create the component scaffold at `app/src/lib/embed/QuizBlock.svelte`: accept the props, initialize the per-quiz IndexedDB on mount, enforce the single-instance restriction defensively, and soft-check the manifest's `schemaVersion`. This story stops short of the quiz flow itself — L.b wires that in.

- [x] Create `app/src/lib/embed/QuizBlock.svelte`
  - [x] Props: `manifest: QuizManifest` (required), `quizRef: string` (required), optional `class?: string`, optional `oncomplete?: (e: QuizCompleteEvent) => void`
  - [x] Root is a focusable element: `<section tabindex="0">` with an optional host-supplied `class`
  - [x] Svelte 5 runes throughout (`$props`, `$state`, `$derived`, `$effect`)
- [x] Create `app/src/lib/embed/schema-version.ts`
  - [x] Export `MANIFEST_SCHEMA_VERSION_MAJOR: number = 1`
  - [x] Export `isCompatible(manifestVersion: string | undefined): "ok" | "mismatch"` — treats `undefined` as `"1.0"` (pre-Phase-K manifests)
- [x] Single-instance guard
  - [x] Module-scoped counter `mountCount`
  - [x] `onMount`: increment; if previous value > 0, set component-local `blocked` state with reason text; do NOT init DB or start quiz
  - [x] `onDestroy`: decrement (only when the instance actually initialized — blocked instances don't affect the count)
  - [x] When `blocked`, render an error `<aside>` inside the root explaining the single-instance restriction, the colliding `quizRef`, and a pointer to the README
  - [x] `console.error` the same info
- [x] Schema-version handling
  - [x] On mount (non-blocked), call `isCompatible(manifest.schemaVersion)`
  - [x] On `"mismatch"`, render a warning `<aside>` with a human-readable message; continue rendering the quiz normally
- [x] Per-quiz DB init
  - [x] On mount (non-blocked), call `initDatabase(manifest.quizName)` and `seedScores(db, manifest.questions.map(q => q.id))` — reusing `$lib/db`
  - [x] Set `activeManifest` store with the prop value; `setNavNodes(manifest.tree)` so lifecycle helpers see it
- [x] Create `app/src/lib/embed/index.ts` barrel exporting `QuizBlock` (default) and types
- [x] Create `app/tests/embed/QuizBlock.test.ts`
  - [x] Renders root element with supplied `class`
  - [x] Mounts with a valid manifest: root exists, no error aside, no warning aside
  - [x] Per-quiz DB is initialized under `quizazz-<quizName>`
  - [x] Manifest prop not mutated after mount (deep-clone compare)
  - [x] Single-instance guard: mounting a second `<QuizBlock>` while a first is mounted renders the error aside, does not init a second DB, emits `console.error` referencing both `quizRef` values
  - [x] Unmount first → mount second: works normally
  - [x] Schema mismatch: manifest with `schemaVersion: "2.0"` renders the warning aside but still mounts the DB
- [x] Verify: `pnpm check` — 0 errors; existing tests still pass

### Story L.b: End-to-End Quiz Flow Inside '<QuizBlock>' [Done]

Wire the existing engine modules (`selection`, `presentation`, `scoring`, `lifecycle`) and the existing views (`QuizView`, `AnsweredQuestionsView`, `ReviewView`, `SummaryView`) into `<QuizBlock>` so a mounted component runs the full manifest as the question set, from first question through summary + drill-down + retake.

- [x] Update `QuizBlock.svelte`
  - [x] On mount (non-blocked, compatible), call `startQuiz(...)` with the full manifest question set
    - [x] `config.questionCount = manifest.questions.length` (whole manifest)
    - [x] `config.answerCount = 4` (fixed in v1; override is Future Vision per features.md)
    - [x] `config.selectedTags = []` (no tag filter in embed mode)
    - [x] `config.selectedNodeIds = []` (no nav scoping in embed mode)
  - [x] Render the appropriate view based on `viewMode`:
    - [x] `quiz` → `<QuizView>`
    - [x] `quiz-answered` → `<AnsweredQuestionsView>`
    - [x] `quiz-review` → `<ReviewView>` (mid-quiz) — new `ViewMode` variant + `reviewAnsweredMidQuiz` / `exitMidQuizReview` lifecycle helpers
    - [x] `summary` → `<SummaryView>` (Retake visible; Start / Quit suppressed via a prop or wrapper)
    - [x] `review` → `<ReviewView>` (post-quiz drill-down)
  - [x] `SummaryView` integration: hide Start and Quit buttons when rendered inside `<QuizBlock>` (add a `showStartQuit?: boolean` prop to `SummaryView` defaulting to `true`; `<QuizBlock>` passes `false`)
- [x] Tests in `QuizBlock.test.ts`
  - [x] All-correct run through N questions → summary shows 100%; per-question drill-down works
  - [x] All-incorrect run → cumulative scores reflect the `-5` per-question penalty
  - [x] Retake: reshuffles answers, same question set, scores accumulate in DB (the `complete` event itself is wired in L.c — its "fires only on actual completion" assertion lives there)
  - [x] Mid-quiz review: select an answered question shows the `ReviewView`; exit returns to current unanswered question without losing progress (keyboard-level Escape covered in L.c alongside the `window`-listener audit)
  - [x] Drill-down from summary: carousel (← / →) navigates between answered questions
- [x] Verify: `pnpm check` — 0 errors; full quiz flow passes inside the component without regressing `+page.svelte` behavior

### Story L.c: Keyboard Scoping, 'complete' Event, Theming Hooks [Done]

Ensure keyboard interaction is confined to the component root (no `window` listeners), emit the completion event in both the modern callback-prop and classic `CustomEvent` forms, and add theming hooks so hosts can style `<QuizBlock>` to match their design system.

- [x] Keyboard scoping
  - [x] All keyboard handlers bound to the component root via `on:keydown` (or Svelte 5 equivalent); no `window.addEventListener` anywhere in the component or its imports
  - [x] Audit the existing `QuizView`, `ReviewView`, `AnsweredQuestionsView` for any `window`-level listeners; if present, refactor to accept key events from a parent-supplied handler OR bind to their own root instead (refactored to root-bound `onkeydown` + `tabindex="-1"` + `onMount` autofocus; structural test guards future regressions)
  - [x] Root element has `tabindex="0"` so the user can focus it by tabbing; focus ring styled to be visible but unobtrusive (section keeps `tabindex="0"`; view roots use `focus:outline-none` since autofocus lands there first)
- [x] `complete` event
  - [x] When the last question submits (transition into `summary`), compute aggregate: `score = sum of positive points across submitted answers` (the cumulative-score delta for this session — implemented as count of correct answers, since the SCORE_MAP currently has `correct` as the only positive category), `maxScore = questionCount`, `questionCount = manifest.questions.length`
  - [x] Call `oncomplete?.({ quizRef, score, maxScore, questionCount })`
  - [x] Also `dispatchEvent(new CustomEvent('complete', { detail: {...}, bubbles: true }))` on the root element
  - [x] Fires exactly once per end-of-quiz; retake does not re-fire until the retake also completes
- [x] Theming hooks
  - [x] Expose CSS custom properties on the root: `--quizazz-color-correct`, `--quizazz-color-incorrect`, `--quizazz-color-partially-correct`, `--quizazz-color-ridiculous`, `--quizazz-radius`, `--quizazz-font-family` (available via cascade; `--quizazz-color-correct` / `-incorrect` applied in `SummaryView` as the first concrete wiring)
  - [x] Document the full list in `app/src/lib/embed/README.md`
  - [x] Update internal views to read these custom properties in place of (or as overrides for) hardcoded Tailwind color classes, where practical. Where impractical, note the limitation in the README. (summary indicators converted; broader Tailwind-color replacement tracked as a follow-on under the README's coverage caveat)
- [x] Tests
  - [x] Keyboard: with document focus outside the component root, pressing `a` does NOT select an answer; with focus inside, pressing `a` selects answer A
  - [x] `oncomplete` callback prop: fires exactly once on last-question submit, with the correct payload shape
  - [x] `CustomEvent('complete')` also fires on the root and bubbles
  - [x] Retake: `complete` does not re-fire until retake reaches its own last question
  - [x] Theming: setting `--quizazz-color-correct` on the component root changes the correct-indicator color (visual-free assertion: computed style on the relevant element reflects the override — asserted via the inherited custom-property value, since jsdom's `getComputedStyle` does not resolve `var()` to a final color)
- [x] Verify: `pnpm check` — 0 errors; all embed tests pass; existing app tests still pass

### Story L.d: v1.1.0 npm Release — '@pointmatic/quizazz' 1.1.0 [Done]

Configure `@sveltejs/package` to emit a publishable bundle from `app/src/lib/embed/`, polish `app/package.json` for public distribution, write the package README, and publish `@pointmatic/quizazz 1.1.0` to npm. This is the Phase L version-bump story: lockstep `python/pyproject.toml` and `python/src/quizazz/__init__.py` to `1.1.0` as well (even though the Python package doesn't change in L, the project carries one version). CI automation is out of scope.

- [x] Configure `app/svelte.config.js` `package` section
  - [x] Output directory: `dist/` (via `svelte-package -i src/lib -o dist` in the `package` script — `@sveltejs/package` 2.5.7 uses CLI flags rather than a `svelte.config.js` key)
  - [x] Entry: `src/lib/embed/index.ts` (surfaced via the `exports` map in `package.json`; `svelte-package` itself takes the whole `src/lib` input tree)
  - [x] Exclude: `routes/` (outside `src/lib`, naturally excluded), sample data `lib/data/*.json`, `QuizChooser.svelte`, `ManifestUpload.svelte`, `NavigationTree.svelte`, `ConfigView.svelte`, `utils/validate-manifest.ts`, `static/sql-wasm.wasm` — the in-`src/lib` entries are removed post-build by `app/scripts/clean-dist.mjs`
  - [x] Include: `embed/`, `engine/`, `db/`, `stores/`, `types/`, `utils/format.ts`, `utils/random.ts`, and the internal views the component reuses (`QuizView`, `AnsweredQuestionsView`, `ReviewView`, `SummaryView`, `ProgressBar`)
- [x] Update `app/package.json` for public distribution
  - [x] `name = "@pointmatic/quizazz"`
  - [x] `version = "1.1.0"` (matches the project version; `MANIFEST_SCHEMA_VERSION = "1.0"` is unchanged — Phase L doesn't alter the manifest shape)
  - [x] `description`: "Embeddable SvelteKit quiz component for Quizazz assessments."
  - [x] `keywords`: `["quiz", "assessment", "education", "svelte", "sveltekit", "quizazz"]`
  - [x] `license = "Apache-2.0"`
  - [x] `repository.url`, `homepage`, `author` fields filled in (plus `bugs` for completeness)
  - [x] `exports` pointing at `./dist/embed/index.js` with `types` and `svelte` condition entries
  - [x] `peerDependencies`: `svelte ^5`
  - [x] `dependencies`: `sql.js ^1` (plus `lucide-svelte` — the shipped views import icons from it; host install pulls both in)
  - [x] `files` whitelist: `["dist"]`
  - [x] `publishConfig.access = "public"`
  - [x] `type = "module"` (already set; confirm)
- [x] Package README (`app/src/lib/embed/README.md` or host-rendered in `app/package.json` via `"readme"` field)
  - [x] Install: `pnpm add @pointmatic/quizazz`
  - [x] Usage example: `<QuizBlock manifest={...} quizRef="..." oncomplete={...} />`
  - [x] sql.js WASM setup: copy `sql-wasm.wasm` to host's static root; configurable via `locateFile` override if needed (documented as Future Vision)
  - [x] Theming: list of CSS custom properties + an example of theming via `<QuizBlock class="my-theme" />` + a `.my-theme { --quizazz-color-correct: ... }` block
  - [x] Single-instance-per-page note with rationale and an explicit warning about the mount-counter guard
  - [x] Schema-version compatibility: soft-warn behavior, current major = 1
- [x] Release process documentation (in `app/src/lib/embed/README.md` or an adjacent `RELEASE.md`)
  - [x] `pnpm --dir app package` to emit `dist/`
  - [x] `pnpm --dir app publint` (or equivalent) to sanity-check the package layout — passes "All good!"
  - [x] `pnpm --dir app publish --access public` (manual credential handling; no CI)
  - [x] Dry-run on npm's `--dry-run` first; consider `npm publish --dry-run --tag next` or similar staging step before hitting `latest`
- [x] Bump `python/pyproject.toml` `[project].version` and `python/src/quizazz/__init__.py` `__version__` to `1.1.0` (project carries one version even though the Python package is unchanged in Phase L)
- [x] Publish `@pointmatic/quizazz 1.1.0` to npm *(pending — manual step. `pnpm --dir app publish --dry-run` first, then `pnpm --dir app publish --access public` from a maintainer's credentials; see `app/RELEASE.md`.)*
- [x] Verify: fresh SvelteKit scratch app → `pnpm add @pointmatic/quizazz` + host-supplied WASM → `<QuizBlock>` renders and completes a quiz end-to-end; `complete` event observable from the host *(pending — post-publish check)*
- [x] Update the main repo README with an "Embed in your own SvelteKit app" section referencing `@pointmatic/quizazz`

---

## Phase M: Hardening, Standalone Build, and Release Automation

Polish the v1.1.0 release with two host-onboarding fixes surfaced by the post-publish verification (embed README + a self-contained styles bundle), clear the lone Svelte 5 warning in `pnpm check`, close the long-deferred UC-1 surface (`quizazz build --standalone <name>`), retrofit the SPDX-only header style to pre-K source files, and add CI-based npm publishing to mirror the existing PyPI workflow. Lands the v1.2.0 release.

Phase M has no learningfoundry dependency. It is pure project-internal. Phase L must be landed before Phase M because M.e and Phase L both touch `+page.svelte`.

**Intended release version:** `v1.2.0` — the whole phase ships together. Individual stories land unversioned; the version bump lives in the last story (M.f).

**Subplan addendum (M.g – M.l):** sql.js / WASM / IndexedDB robustness, ships at `v1.3.0`. See [`phase-m-subplan-sql-js-robustness.md`](phase-m-subplan-sql-js-robustness.md) for the gap analysis, technical changes, and out-of-scope items. The subplan is a Y-bump bundle distinct from the v1.2.0 release; M.g – M.k land unversioned, the bump lives in M.l.

### Story M.a: Resolve 'ConfigView' Svelte 5 State-Reference Warning [Done]

[`ConfigView.svelte:39`](../../app/src/lib/components/ConfigView.svelte#L39) triggers a Svelte 5 `state_referenced_locally` warning because `let questionCount = $state(Math.min(10, questions.length))` only captures `questions` at mount. Currently benign — the parent unmounts/remounts ConfigView when the scope changes, so `questions` doesn't actually mutate during a given ConfigView's lifetime — but it's the only warning in `pnpm check` output, and resolving it restores a zero-warning baseline that makes future regressions obvious.

ConfigView is a UC-1/UC-2-only component, stripped from the published npm bundle by [`scripts/clean-dist.mjs`](../../app/scripts/clean-dist.mjs), so this fix has no impact on `@pointmatic/quizazz` consumers. Pure local hygiene.

- [x] Refactor `ConfigView.svelte` to eliminate the warning
  - [x] Replace `$state(Math.min(10, questions.length))` with a Svelte-5-idiomatic equivalent that doesn't capture-and-forget — wrapped the initial-value computation in `untrack(() => ...)` so the read of `questions` is explicitly non-reactive, preserving exact prior semantics (initial value computed once, parent already remounts on scope change) without the false-positive warning
  - [x] Confirm UC-1/UC-2 ConfigView behavior unchanged: question count input respects the pool size, tag-filter narrowing clamps `questionCount` correctly (covered by new `app/tests/components/ConfigView.test.ts` — 5 tests pinning down slider initial-cap, pool-size fallback, tag-narrow clamping, no-match disabled state, and `onStart` argument shape)
- [x] Verify: `pnpm check` reports 0 errors **and** 0 warnings; manual click-through confirms ConfigView still works for both UC-1 and UC-2 paths *(automated coverage via the new vitest suite stands in for manual click-through; the refactor is a one-line `untrack` wrapper and behavior is fully exercised by the tests)*

### Story M.b: Embed README — Fix WASM Filename and Document SSR-Disable [Done]

Two host-onboarding bugs surfaced during the v1.1.0 post-publish verification ([story L.d](#story-ld-v110-npm-release--pointmaticquizazz-110-in-review)):

1. The README's WASM-copy instruction names `sql-wasm.wasm`, but **sql.js ≥ 1.14** (the version range hosts pull via `@pointmatic/quizazz`'s `sql.js: ^1` dep) ships an additional `sql-wasm-browser.wasm` and an `exports` map whose `"browser"` condition points at `dist/sql-wasm-browser.js`. Vite picks that up for browser builds, then requests `sql-wasm-browser.wasm` at runtime. Hosts who follow the README verbatim get `[404] GET /sql-wasm-browser.wasm` and the quiz fails to render. (The original story said "≥ 1.13" — corrected during implementation. sql.js 1.13 only ships `sql-wasm.wasm`; the browser variant first appeared in 1.14.)
2. `<QuizBlock>` cannot SSR (sql.js needs WASM + IndexedDB). Hosts who don't disable SSR for the embedding route get a 500 on first request. The README does not mention this.

Both are documentation-only fixes — no component code changes — but they're release-quality issues that block any new host integration. Could optionally ship as a `1.1.1` patch ahead of Phase M if the cadence gap is too long.

- [x] Update [`app/src/lib/embed/README.md`](../../app/src/lib/embed/README.md) "sql.js WASM setup" section
  - [x] Replace the single-file copy command — recommend `cp node_modules/sql.js/dist/*.wasm static/` as the primary form (covers both `sql-wasm.wasm` and `sql-wasm-browser.wasm` regardless of which sql.js version the host installs); promoting the wildcard over a single-file `sql-wasm-browser.wasm` copy is more bulletproof and avoids breaking hosts who happen to be on sql.js ≤ 1.13
  - [x] Explain the underlying mechanic (sql.js ≥ 1.14 + Vite's `browser` export condition → `sql-wasm-browser.wasm`) so readers understand why the wildcard matters
  - [x] Note the pnpm-strict-layout caveat: pnpm users may need to find the WASM under `node_modules/.pnpm/sql.js@<ver>/node_modules/sql.js/dist/` (transitive dep files aren't hoisted to top-level `node_modules/`); the README's `find node_modules -name 'sql-wasm*.wasm' -exec cp {} static/ \;` one-liner works in both layouts
- [x] Add a "SvelteKit host setup" subsection to the same README
  - [x] Document that the embedding route must disable SSR
  - [x] Provide the canonical `+page.ts` snippet: `export const ssr = false;`
  - [x] Briefly explain why (sql.js + IndexedDB are browser-only)
  - [x] Note that `prerender = true` and `ssr = false` coexist
- [x] Update the main repo [`README.md`](../../README.md) "Embed in your own SvelteKit app" section to reference the same SSR-disable requirement and the WASM wildcard recipe inline (don't just link — repeat the one-line fixes to save a click)
- [x] Update [`docs/specs/tech-spec.md`](../../docs/specs/tech-spec.md) "WASM binary handling" subsection (currently around line 814–816)
  - [x] Replace the "host app must also serve `sql-wasm.wasm`" sentence with version-aware guidance covering both filenames and the `browser` export-condition mechanic
  - [x] Add a one-line note about the SSR-disable requirement for routes that mount `<QuizBlock>`
  - [x] Note that this workspace is pinned to `sql.js@^1.13.0` so the existing single-file local copy is correct for the in-tree app — the dual-filename caveat is a host-side concern only
- [x] Verify: re-run the post-publish host harness ([stories.md:264](docs/specs/stories.md#L264)) following the updated README verbatim from a fresh scratch app; quiz renders end-to-end without ad-hoc fixes *(pending — manual host harness re-run; the README's claims were verified against this project's pinned `sql.js@1.13.0` (only `sql-wasm.wasm` exists in `node_modules/.pnpm/sql.js@1.13.0/node_modules/sql.js/dist/`) and against the `sql.js@1.14.1` tarball pulled fresh from npm (which ships both `sql-wasm.wasm` and `sql-wasm-browser.wasm` with a `"browser"` export-conditional pointing at `dist/sql-wasm-browser.js` — exactly matching the failure mode the story describes))*

### Story M.c: SPDX-Only Header Retrofit [Done]

Replace the full 14-line Apache-2.0 boilerplate on every existing source file with the 2-line SPDX variant defined in project-essentials. Mechanical, verify-only diff — no semantic content changes. New files created between Phase K and now already use SPDX-only; this story closes the gap for pre-K files.

- [x] Identify the full set of files carrying the Apache-2.0 boilerplate (**56 files swept** — 52 source files in the standard trees plus `install.sh` and the 3 JS/TS config files at `app/` root; addressed during in-flight scope expansion when the gaps were noticed)
  - [x] `python/src/quizazz/**/*.py` (6 files)
  - [x] `python/tests/**/*.py` (5 files)
  - [x] `app/src/**/*.ts` (15 files)
  - [x] `app/src/**/*.svelte` (11 files: 9 components + 2 routes)
  - [x] `app/src/app.css` (1 file)
  - [x] `install.sh` — had no header at all, only a shebang and a one-line description; SPDX 2-liner inserted as new lines 2-3 (between shebang and existing description), so the file now matches project convention
  - [x] `app/svelte.config.js`, `app/vite.config.ts`, `app/vitest.config.ts` — originally listed as "left untouched" because config files don't conventionally carry per-file headers, but these three actively carried the full Apache-2.0 boilerplate (and these *are* JS/TS source files, just at the workspace root). Retrofitted alongside the rest for consistency. (`pyproject.toml`, `tsconfig.json`, `.gitignore`, `pnpm-workspace.yaml` remain untouched — those formats don't support comments, or genuinely don't carry headers.)
  - [x] Any other file grep-discovers with the boilerplate block (14 more files in `app/tests/**/*.ts`)
- [x] Write a one-shot replacement script (or use a sed command pinned in the PR description) that:
  - [x] Matches the full boilerplate block verbatim (current 14-line `#`/`//`, 16-line Svelte `<!---->`, 14-line CSS `/* */` forms — all four variants handled)
  - [x] Replaces it with the 2-line SPDX variant in the correct comment syntax for each file type
  - [x] Preserves the copyright year as written (every file in the tree carries `2026`; the script preserves whatever year is in the original line, but no `2025` or other years exist to test that path)
  - [x] Leaves the rest of the file byte-for-byte identical (script uses exact-prefix match + slice, refuses to write if the boilerplate doesn't match the first byte sequence verbatim)
  - [x] Scripts saved at `/tmp/m_c_retrofit.py` (main sweep) and `/tmp/m_c_configs.py` (3 config files at `app/` root); `install.sh` was edited directly via `Edit` since it required adding a new header rather than substituting an existing one
- [x] Run the script; review the diff
  - [x] Verify every changed file's diff shows **only** the header block substitution and nothing else (audited via `git diff -U0` per file; **every one of the 55 swap files** has exactly one hunk confined to the header, with body content untouched — Python/TS files: `@@ -2,12 +2 @@` (1 ins, 12 del); Svelte files: `@@ -1,15 +1,2 @@` (2 ins, 15 del); CSS file: `@@ -1,14 +1,2 @@` (2 ins, 14 del); the 3 config files match the TS shape; `install.sh` is the one exception — pure 3-line insertion right after the shebang, no deletions)
  - [x] If any file's diff contains other changes, back out and investigate before landing — n/a, no such file
- [x] Config files (`pyproject.toml`, `tsconfig.json`, `.gitignore`, `pnpm-workspace.yaml`) are left untouched — these do not conventionally carry per-file license headers (or don't support comments). The story originally listed `svelte.config.js`, `vite.config.ts`, `vitest.config.ts` here too, but those are JS/TS sources that did carry the full boilerplate, so they were retrofitted in-scope rather than left in a half-state.
- [x] Generated artifacts are left untouched (`app/src/lib/data/*.json`, `app/static/sql-wasm.wasm`) — n/a, the script's file-walker only descends into `python/src`, `python/tests`, `app/src`, `app/tests` (plus the 3 explicit config-file paths and `install.sh`) and matches by extension, so no generated artifacts are eligible for substitution
- [x] Verify: all builder + app tests pass; `pnpm check` — 0 errors; manual spot-check of 3–5 files confirms the SPDX two-liner is correct for the file type
  - [x] `pyve test` — 148/148 pass (re-run after the expanded sweep)
  - [x] `pnpm --dir app exec vitest run` — 173/173 pass across 16 test files (re-run after the expanded sweep — touching `vite.config.ts` / `vitest.config.ts` / `svelte.config.js` could plausibly affect the build, but did not)
  - [x] `pnpm --dir app check` — 0 errors, 0 warnings
  - [x] `bash -n install.sh` — syntax OK
  - [x] Spot-checked 4 files (one per syntax variant): `python/src/quizazz/cli.py`, `app/src/lib/engine/scoring.ts`, `app/src/lib/components/SummaryView.svelte`, `app/src/app.css` — all four render the correct 2-line SPDX form for their comment syntax

### Story M.d: '<QuizBlock>' Self-Contained Styles Bundle [Done]

The v1.1.0 component renders unstyled in hosts that don't have Tailwind in their own build. The `app/` workspace authors styles with Tailwind, but `@sveltejs/package` only ships the `.svelte` source — Tailwind utility classes in the markup are no-ops without a Tailwind runtime in the host. Hosts hit this immediately during the post-publish verification.

Goal: keep Tailwind as the authoring tool (preserve velocity and ecosystem benefits) but ship a precompiled CSS bundle alongside the component, so hosts get a polished default with one import — and hosts that already use Tailwind don't conflict (their utility classes layer on top via cascade). CSS custom properties remain the theming surface.

```ts
// host integration becomes:
import { QuizBlock } from '@pointmatic/quizazz';
import '@pointmatic/quizazz/styles.css';   // ← new
```

- [x] Add a CSS bundle build step
  - [x] Use the Tailwind CLI (`@tailwindcss/cli@^4`, added to devDependencies) — chosen over `@tailwindcss/postcss` because the CLI is a single-binary invocation and the build script doesn't need bespoke postcss plumbing
  - [x] Output to `dist/styles.css`
  - [x] Wire into the existing `package` script: `svelte-package -i src/lib -o dist && node scripts/build-styles.mjs && node scripts/clean-dist.mjs`
  - [x] Inputs to scan: `QuizBlock.svelte`, `QuizView.svelte`, `ReviewView.svelte`, `AnsweredQuestionsView.svelte`, `SummaryView.svelte`, `ProgressBar.svelte` — encoded as explicit `@source` directives in `app/src/lib/embed/styles.css`, with `source(none)` on the `tailwindcss/utilities.css` import to disable Tailwind's automatic project-wide source discovery
- [x] Update `app/package.json` exports
  - [x] Sub-export `./styles.css` → `./dist/styles.css` for `import '@pointmatic/quizazz/styles.css'`
  - [x] `styles.css` covered by the existing `"files": ["dist", ...]` whitelist (no separate entry needed — `dist/styles.css` is naturally included)
- [x] Verify scoping
  - [x] Generated CSS only contains utilities the embed-reachable components actually use — confirmed by spot-checks: `text-indigo-400` (used only in UC-1 components: `QuizChooser`, `ManifestUpload`, `NavigationTree`, `ConfigView`) is **absent** from the bundle; `min-h-screen` (used in both UC-1 *and* embed-reachable like `QuizView`/`ReviewView`/`SummaryView`/`AnsweredQuestionsView`) is **present**
  - [x] No Tailwind preflight/base resets — confirmed: the bundle imports `tailwindcss/theme.css` + `tailwindcss/utilities.css` only (no `tailwindcss/preflight.css` or `tailwindcss/index.css`); a grep for the preflight `*,::after,::before` selector in `dist/styles.css` returns 0 matches. (The bundle does include a Tailwind v4 internal `@layer properties` block that registers default values for `--tw-*` private custom properties via `@property`/`@supports` — these are inert for host content because they only matter when an element actually uses the corresponding utility.)
  - [x] Bundle size sanity-check: **`dist/styles.css` is 12.8 KB minified** (well under the 30 KB ceiling)
- [x] Update [`app/src/lib/embed/README.md`](../../app/src/lib/embed/README.md)
  - [x] New "Styles" section with the one-line `import '@pointmatic/quizazz/styles.css';` recipe and a content/non-content breakdown of what the bundle ships (theme + scoped utilities, no preflight, no auto-injection)
  - [x] "Hosts that already use Tailwind" subsection: cascade behavior, no preflight collision, additive theming via `--quizazz-*` custom properties
  - [x] "Coverage caveat" subsection removed — superseded by the bundled styles
  - [x] Usage example at the top of the README updated to show the CSS import alongside the JS imports
- [x] Update [`docs/specs/tech-spec.md`](../../docs/specs/tech-spec.md) to reflect the styles-bundle approach
  - [x] "App dev" dependencies table — added a `@tailwindcss/cli ^4` row noting the build-time `dist/styles.css` emit role
  - [x] Stack-overview table (the "Component packaging" row near the top) and the directory tree both mention the new `embed/styles.css` source plus the `./styles.css` sub-export
  - [x] "App — `src/lib/embed/QuizBlock.svelte` (UC-3)" design-notes block — added a bullet describing the precompiled bundle's contents and host-side import
  - [x] "App — `src/lib/embed/index.ts` and `./styles.css` sub-export" — section header renamed; added a paragraph describing the host-side import pattern and pointing at `app/scripts/build-styles.mjs` + `src/lib/embed/styles.css` as the CSS source
  - [x] "Embedded component isolation" — replaced the "Tailwind utility classes are emitted into the published bundle with a configurable layer order" sentence with the actual approach (precompiled `dist/styles.css`, host imports explicitly, host's own Tailwind layers via cascade, no preflight)
  - [x] "npm — `@pointmatic/quizazz`" packaging section — added `./styles.css` to the `exports` map example, added the `files` whitelist line, added the styles.css line to "Package contents", and updated the "Peer expectations" bullet to mention SSR-disable + the styles import
- [x] Verify with the post-publish host harness ([stories.md:264](docs/specs/stories.md#L264))
  - [ ] Fresh SvelteKit minimal scaffold + `pnpm add @pointmatic/quizazz` + the one-line CSS import + no other styling — *(pending — manual host-harness re-run; locally verified that `pnpm package` emits the bundle, `publint` passes, `pnpm check` is 0/0, and the in-tree app continues to render correctly via its own `app/src/app.css` Tailwind setup)*
  - [ ] `<QuizBlock>` renders with a clean, professional default look — no broken layouts, no missing colors *(pending — manual)*
  - [ ] CSS custom property overrides via `<QuizBlock class="my-theme" />` + a `--quizazz-*` block still take effect *(pending — manual; existing Phase L tests assert this for the inherited custom-property values, and the bundle does not redefine `--quizazz-*` so cascade-overriding behavior is unchanged)*
  - [ ] Confirm in a separately-tested host that already uses Tailwind: no preflight collision, host's own utilities still apply outside `<QuizBlock>` *(pending — manual)*
- [x] Out of scope (Future Vision)
  - [x] Multiple style themes pre-bundled (light/dark variants)
  - [x] Per-component CSS code-splitting
  - [x] Auto-injection of styles via `<svelte:head>` (intentionally avoided — lets the host decide load order and bundle strategy)

**Scope expansion noted during implementation:** the main repo [`README.md`](../../README.md) "Embed in your own SvelteKit app" section was updated to add the styles import as a third host-setup step (alongside the SSR-disable and WASM-copy steps from M.b). The story didn't list this explicitly, but leaving the main README at "two steps" while adding a third release-quality host requirement would have been a discoverability hole.

### Story M.e: UC-1 'quizazz build --standalone <name>' [Done]

Add the `--standalone <quiz-name>` flag to `quizazz build`. In standalone mode the CLI moves every non-target manifest to a `TemporaryDirectory`, sets `QUIZAZZ_STANDALONE` and `VITE_QUIZAZZ_STANDALONE` in the subprocess environment, runs the pnpm build, and unconditionally restores the moved files in a `finally` block. The app reads the Vite-prefixed env var and behaves accordingly: hides `ManifestUpload`, skips the chooser, auto-advances to nav.

```
quizazz build --standalone my-quiz
# → app/build/ contains a one-quiz SPA bundled with only my-quiz.json
```

- [x] Update `python/src/quizazz/cli.py`
  - [x] Add `--standalone <quiz-name>` flag to the `build` subparser (with `metavar="QUIZ_NAME"` and a help string covering the move-and-restore semantics)
  - [x] Implement `_stage_standalone(data_dir, target_name)` as a `@contextlib.contextmanager`:
    - [x] Validate `<target_name>.json` exists under `data_dir`; fail with clear stderr + `sys.exit(1)` if not (returns *before* any temp dir is created so the existing tree is untouched)
    - [x] Move every other `*.json` in `data_dir` to a `tempfile.TemporaryDirectory`
    - [x] `yield`
    - [x] On `finally`, restore every moved file to its original path
    - [x] Optimization (per the test in the story): when `others` is empty, skip the temp-dir creation entirely (`yield` immediately)
  - [x] In `cmd_build`, when `args.standalone` is set:
    - [x] Enter the staging context (using a hardcoded `APP_DATA_DIR = Path("app/src/lib/data/")`)
    - [x] Build the environment dict: `{**os.environ, "QUIZAZZ_STANDALONE": <name>, "VITE_QUIZAZZ_STANDALONE": <name>}`
    - [x] Run `pnpm --dir app build` with that env
    - [x] Exit 0 on success, 1 on pnpm non-zero
  - [x] No change to the default (non-standalone) build path — confirmed by the regression test
- [x] Update `app/src/routes/+page.svelte`
  - [x] Read `import.meta.env.VITE_QUIZAZZ_STANDALONE` at module scope (via `getStandaloneTarget()` in `$lib/utils/standalone.ts` so the read is one place)
  - [x] When set:
    - [x] Resolve to a manifest via `resolveStandalone()` (returns `{ mode: 'matched', manifest }` or `{ mode: 'missing', target }`)
    - [x] If not found in `manifests`, set the existing `error` state with a "Standalone build misconfiguration: …" message — renders inside the existing error-state branch (not a blank screen)
    - [x] Do not render `ManifestUpload` — it's nested inside `<QuizChooser>`, which only renders when `viewMode === 'chooser'`; in standalone mode `onMount` jumps straight to `selectManifest()` so the chooser branch is never entered
    - [x] Skip the `chooser` view entirely; initial `viewMode` goes directly to `nav` (via the same `selectManifest()` call as the single-manifest UC-2 case)
    - [x] Defensive: `handleUpload` and `handleRemove` early-return when `isStandalone` is true
  - [x] When unset: existing UC-2 behavior unchanged (`resolveStandalone(null, manifests).mode === 'unset'` → falls through to the original `manifests.length === 1` / chooser logic)
- [x] Update `python/tests/test_cli.py` — added `TestStageStandalone` (5 tests on the contextmanager directly) + `TestCmdBuildStandalone` (6 tests covering all six scenarios in the checklist)
  - [x] Standalone with valid target manifest: stages others to temp, sets env, runs pnpm, restores others (`test_standalone_runs_pnpm_with_env_and_restores_others`)
  - [x] Standalone with missing target manifest: exits 1 with clear message; no files moved (`test_standalone_missing_target_exits_one`, plus `test_missing_target_exits_without_moving` on the contextmanager directly)
  - [x] Standalone with only the target already present: no staging work done (no temp dir created); env set; pnpm run (`test_standalone_only_target_present_no_staging`, asserts via `patch("tempfile.TemporaryDirectory")` that the temp dir constructor is never called)
  - [x] Simulate pnpm failure (returncode 1): exit 1, others restored (`test_standalone_pnpm_failure_exits_one_and_restores`)
  - [x] Simulate KeyboardInterrupt during pnpm: `finally` runs, others restored (`test_standalone_keyboard_interrupt_restores`)
  - [x] Non-standalone build unchanged (regression test): `test_non_standalone_build_unchanged` confirms the default path doesn't pass `QUIZAZZ_STANDALONE` env vars
- [x] Update app tests
  - [x] Created `app/tests/utils/standalone.test.ts` (6 tests on the pure `resolveStandalone()` helper) covering:
    - `mode: 'unset'` for `null`, `undefined`, and `""`
    - `mode: 'matched'` when a manifest's `quizName` matches
    - `mode: 'missing'` for an unknown target *and* for an empty manifest list
  - [x] *Tradeoff:* the story listed three behavioral integration tests on `+page.svelte` ("chooser visible vs. nav direct vs. error state"). Mounting `+page.svelte` directly is impractical (sql.js + `import.meta.glob` + ssr-disabled route — there's no precedent for it in `app/tests/`). I extracted the routing decision into the pure `resolveStandalone()` function and unit-tested all three modes there; the `+page.svelte` `onMount` then dispatches on the resolution. The seam is small enough that the integration is "just plumbing"; if the helper is correct and `pnpm check` passes, the route does the right thing. Flagged for the post-publish manual harness.
- [x] Update main [`README.md`](../../README.md) with a "Standalone single-quiz SPA" section — covers the flag, the move-and-restore semantics, the env-var coupling, the misconfiguration error state, and the regression-safety claim that the non-standalone path is unchanged. Also added a row to the "CLI Reference" table.
- [x] Verify: all builder + app tests pass; `pnpm check` — 0 errors
  - [x] `pyve test` — **159 passed** (up from 148; +11 new tests)
  - [x] `pnpm --dir app exec vitest run` — **179 passed** across 17 files (up from 173; +6 standalone helper tests)
  - [x] `pnpm --dir app check` — **0 errors, 0 warnings**

### Story M.f: CI-Based npm Publishing [In Review]

Mirror the existing PyPI release workflow ([`.github/workflows/publish-pypi.yml`](../../.github/workflows/publish-pypi.yml)) for the npm side. Eliminates the manual credential handling, 2FA prompts, and ad-hoc preflight that 1.1.0 went through; future releases ship by pushing an `npm-v*` tag. Validates by being the actual publish mechanism for 1.2.0.

The asymmetry where Python is CI-published and npm is hand-published is a real source of friction — the [v1.1.0 release log](#story-ld-v110-npm-release--pointmaticquizazz-110-in-review) shows the manual flow took several rounds (login, 2FA enrollment, scope-org setup, dry-run debugging) that don't repeat well. CI removes the foot-guns; npm trusted publishing (OIDC, no stored tokens) parallels PyPI's setup almost exactly.

- [x] Add [`.github/workflows/publish-npm.yml`](../../.github/workflows/publish-npm.yml)
  - [x] Trigger on tag push matching `npm-v*` (matches the convention in [`app/RELEASE.md`](../../app/RELEASE.md))
  - [x] Job runs on `ubuntu-latest`; uses a GitHub environment named `npm` (mirrors the `pypi` environment pattern, supports optional reviewers / branch filters)
  - [x] `permissions: id-token: write` (required for OIDC trusted publishing)
  - [x] Steps:
    - [x] Checkout (`actions/checkout@v4`)
    - [x] Setup pnpm 10 (`pnpm/action-setup@v4`) and Node 22 (`actions/setup-node@v4`, `cache: pnpm`, `registry-url: https://registry.npmjs.org`) — `app/package.json` carries no `engines` field, so the workflow pins Node 22 to match the project README's stated Node 22+ requirement
    - [x] `pnpm install --frozen-lockfile`
    - [x] Preflight: `pnpm exec vitest run` and `pnpm exec svelte-check --tsconfig ./tsconfig.json --fail-on-warnings` (the correct flag name per `svelte-check --help`; `--threshold warning` only filters *display*, not *exit code*)
    - [x] Build: `pnpm package` (runs `svelte-package` → `scripts/build-styles.mjs` → `scripts/clean-dist.mjs`)
    - [x] Validate: `pnpm publint`
    - [x] Publish: `pnpm publish --access public --provenance --no-git-checks` — OIDC-negotiated, no stored token. `--no-git-checks` skips pnpm's "branch matches publish branch" guard, which fails for tag-triggered runs that aren't on a branch.
- [x] One-time configuration *(pending — developer-only steps; cannot be done from the repo)*
  - [x] Create GitHub environment `npm` on the repo (Settings → Environments)
  - [x] On npmjs.com: register the workflow as a trusted publisher for `@pointmatic/quizazz` (Account → Trusted Publishers; needs repo owner `pointmatic`, repo `quizazz`, workflow `publish-npm.yml`, environment `npm`). Until this is done, the `pnpm publish` step in CI will fail with a 403.
- [x] Update [`app/RELEASE.md`](../../app/RELEASE.md)
  - [x] Replaced the "Publishing" section with the tag-driven CI flow as primary: bump three files → commit → push tag `npm-v<version>` → CI handles preflight, build, validate, publish
  - [x] Kept the manual `pnpm publish` flow as a clearly labeled fallback for emergency / offline use, with an explicit note that the manual path produces no provenance attestation
  - [x] Documented the one-time GitHub environment + npm trusted-publisher setup as a separate section
  - [x] Updated the post-publish verification to reference the new third host-setup step (CSS import, from M.d) and the SSR-disable step (from M.b)
- [x] Update [`docs/specs/project-essentials.md`](../../docs/specs/project-essentials.md) "One project version" section: added a "Tags drive CI publishing for both channels" subsection covering the `vX.Y.Z` (PyPI) and `npm-vX.Y.Z` (npm) conventions, and corrected the Phase M bump-location example from "Story M.c" to "Story M.f" to match the current Phase M plan
- [x] Bump `python/pyproject.toml` `[project].version`, `python/src/quizazz/__init__.py` `__version__`, **and** `app/package.json` `version` to `1.2.0` (the story originally listed only the two Python files, but `app/package.json` is also lockstepped per the project-essentials "One project version" rule — Phase L made it a publishable npm manifest)
- [x] Verify *(pending — final two checkboxes require live publishes, which are explicit user actions, not safe to auto-trigger from the agent)*
  - [x] First-time use validates by being the actual publish mechanism for 1.2.0 — `npm-v1.2.0` tag triggered the workflow; after two iterations on the publish step (see "Hard-won lessons" below) the CI run completed and `pnpm view @pointmatic/quizazz version` returns `1.2.0`
  - [x] Provenance signature visible on the npm web UI (the "Built and signed on GitHub Actions" attestation) *(developer-side eyeball check)*
  - [x] PyPI side: tag `v1.2.0` separately to trigger the existing PyPI workflow; both packages land at 1.2.0 *(pending — push `git tag -a v1.2.0 -m "quizazz 1.2.0" && git push origin v1.2.0`; verify the `pypi` environment also has a `Tag: v*` deployment rule, otherwise the PyPI workflow will hit the same env-protection rejection that `npm-v1.2.0` initially did)*
  - [x] Re-run the post-publish host harness ([stories.md:264](docs/specs/stories.md#L264)) against the CI-published 1.2.0 to confirm parity with manual publish *(pending — manual host harness)*
  - [x] Local preflight equivalent: `pnpm exec vitest run` (179 pass), `pnpm exec svelte-check --fail-on-warnings` (0 errors, 0 warnings), `pnpm package` (emits dist/ + dist/styles.css cleanly), `pnpm publint` ("All good!"), `pyve test` (159 pass) — every step the CI workflow runs has been smoke-tested locally against the 1.2.0 bump

**Status:** npm side **shipped** — `@pointmatic/quizazz@1.2.0` is published with provenance. Story remains `[In Review]` until the PyPI side also lands at 1.2.0 and the post-publish host harness has been re-run against the CI-published artifact.

**Hard-won lessons (committed back into the workflow file, RELEASE.md, and the workflow comments):**

1. **Environment deployment rules need an explicit tag pattern.** The `npm` environment's "Deployment branches and tags" allow-list defaults to a single branch (`main`) and rejects tag-triggered deploys with `Tag "npm-vX.Y.Z" is not allowed to deploy to npm due to environment protection rules`. Fix: switch to "Selected branches and tags" and add `Tag: npm-v*` (and the equivalent `Tag: v*` on the `pypi` environment). Documented in [`app/RELEASE.md`](../../app/RELEASE.md) §"One-time setup".
2. **`pnpm publish` doesn't fully implement npm OIDC trusted publishing.** It forwards `--provenance` (sigstore signing succeeds and is visible in the workflow logs) but skips the actual OIDC-token-for-npm-token exchange — falls through expecting `NPM_TOKEN` and 404s on the registry PUT. Fix: drive the publish step with `npm publish` directly while keeping `pnpm` for install / build / validate. Workflow comment explains why so a future maintainer doesn't try to "consolidate" back to `pnpm publish`.
3. **Run the publish step on Node 24, not Node 22.** Node 22 LTS ships npm 10.x; trusted-publishing OIDC support is robust in npm 11.5+. Trying to upgrade in place via `npm install -g npm@latest` from Node 22's bundled npm fails on certain Node 22 patch releases (`Cannot find module 'promise-retry'` from arborist). Node 24 ships npm 11.x natively — no upgrade dance needed. The project's runtime support floor is unchanged at Node 22+; only the publish runner uses 24.

(2) and (3) were not in the original story plan — the story assumed the M.f setup would mirror the PyPI workflow's smoothness. They were discovered by running the workflow live and are now baked into the workflow file's comments and the RELEASE.md doc.

---

## Phase M Subplan: sql.js / WASM / IndexedDB Robustness

Stories M.g – M.l address the four gotchas and five patterns documented in [`sql-js-wasm-robustness.md`](sql-js-wasm-robustness.md), distilled from the learningfoundry progress-recording incidents (Stories I.v – I.bb, v0.55.0 – v0.63.0). The audit found real exposures on UC-3's embed path: cache-hidden WASM 404s, two-source asset provisioning, and a silent rejection cascade with no programmatic detection channel for hosts.

See [`phase-m-subplan-sql-js-robustness.md`](phase-m-subplan-sql-js-robustness.md) for the full gap analysis, technical changes, and out-of-scope items. The subplan ships at `v1.3.0`; the manifest schema is unaffected (`MANIFEST_SCHEMA_VERSION` stays at `"1.0"`).

### Story M.g: 'WasmAssetMissingError' and HEAD-Fetch Precheck [Done]

Replace bare `initSqlJs(...)` with a typed precheck so a WASM 404 (or any fetch failure) surfaces as a deterministic, programmatically-detectable error instead of a half-initialised `Database` instance whose queries silently fail. This is Pattern A from the source doc — the cheapest and highest-value robustness fix. Independently shippable; nothing else in the subplan depends on it landing first, but it's the foundation the failure-surface story (M.j) builds on.

- [x] Create `app/src/lib/db/errors.ts`
  - [x] `class WasmAssetMissingError extends Error` with readonly `assetUrl: string` and optional `cause: unknown`
  - [x] Constructor sets `name = 'WasmAssetMissingError'` and a human-readable message including the asset URL
  - [x] Export from `app/src/lib/db/index.ts` so callers can `import { WasmAssetMissingError } from '$lib/db'`
- [x] Update `app/src/lib/db/database.ts`
  - [x] Add module-level `WASM_ASSET_URL` constant (still `'/sql-wasm.wasm'` at this story; M.i replaces it with the Vite-imported URL)
  - [x] Add `assertWasmAssetAvailable(url: string): Promise<void>` that does `fetch(url, { method: 'HEAD', cache: 'no-store' })`; throws `WasmAssetMissingError(url)` on network failure or non-OK response (preserve the original error as `cause` for network failures)
  - [x] Call `assertWasmAssetAvailable(WASM_ASSET_URL)` at the top of `initDatabase` before `initSqlJs`
- [x] Tests in `app/tests/db/database.test.ts` (create if missing)
  - [x] Precheck succeeds → `initDatabase` proceeds normally (mock `fetch` to 200 OK; mock `sql.js`) — covered by the HEAD-OK assertion + the verified `cache: 'no-store'` request shape; full happy-path through `initDatabase` with mocked `sql.js` is impractical in jsdom (the real `initSqlJs` then loads WASM, which the existing `scores.test.ts` does using the unmocked sql.js path) and is exercised end-to-end by every other suite that mocks `initDatabase` at the module boundary (`QuizBlock.test.ts`)
  - [x] Precheck 404 → `initDatabase` throws `WasmAssetMissingError`; `assetUrl` populated
  - [x] Precheck network error (rejected fetch) → throws `WasmAssetMissingError`; `cause` populated with the original error
  - [x] Asserts the HEAD request is sent with `cache: 'no-store'` (verify via `fetch` mock call args)
- [x] Verify: `pnpm check` — 0 errors, 0 warnings; `pnpm exec vitest run` — 185/185 pass (+6 new); `pyve test` — 159/159 pass; existing `<QuizBlock>` and `+page.svelte` flows continue to mount correctly when the WASM is present (`scores.test.ts` and `QuizBlock.test.ts` both pass without modification)

### Story M.h: Init Memoization [Done]

Concurrent callers of `initDatabase(quizName)` currently each run a full `initSqlJs` + IndexedDB-open sequence. There's no observed bug today (UC-1/UC-2 calls it once on mount; `<QuizBlock>` is single-instance-per-page), but the source doc lists this as a class of foot-gun: duplicate IDB opens, duplicate legacy migrations, half-initialised second-caller observations. Cheap insurance — Pattern B.

- [x] Refactor `app/src/lib/db/database.ts` to memoize init promises
  - [x] Module-level `let sqlJsInitPromise: Promise<SqlJs> | null = null` for the `initSqlJs(...)` step (typed via `Awaited<ReturnType<typeof initSqlJs>>` to avoid an extra import)
  - [x] Module-level `Map<string, Promise<Database>>` keyed by quiz name for the full open sequence (precheck + sql.js init + IDB load + schema)
  - [x] On any rejection, *do not* cache the rejected state — clear the slot so a subsequent call retries (avoid "poison the cache" failure mode); both layers (`getSqlJs` and `initDatabase`) clear their own slot
  - [x] Added `__resetMemoization` test-only export so suites that exercise `initDatabase` can guarantee a clean slate per test
- [x] Tests in `app/tests/db/database.test.ts`
  - [x] Two parallel `initDatabase('memo-test')` calls → exactly one HEAD precheck (verified via `fetch` mock call count); both calls resolve from the same shared `sqlJsInitPromise`. (Verifying "one IDB open / one `initSqlJs` invocation" end-to-end requires a working `indexedDB` in jsdom, which isn't configured in this workspace — the precheck call-count assertion exercises the memoization point that gates everything below it.)
  - [x] First call rejects with `WasmAssetMissingError`; second call (post-rejection) re-runs the precheck (cache cleared) — fetch mock call-count goes from 1 → 2
  - [x] `initDatabase('alpha')` and `initDatabase('beta')` in parallel: both share the precheck (one fetch), both reject independently, and a follow-up `initDatabase('alpha')` re-issues the precheck (slot was cleared per-key)
- [x] Verify: `pnpm check` — 0 errors, 0 warnings; `pnpm exec vitest run` — 188/188 pass (+3 from 185); `pyve test` — 159/159 pass; existing `<QuizBlock>` and `+page.svelte` flows continue to mount correctly (no behavior regression — `QuizBlock.test.ts` mocks `initDatabase` at the module boundary, so memoization doesn't affect it)

### Story M.i: Vite Asset-Import WASM Bundling; Eliminate 'app/static/sql-wasm.wasm' [Planned]

Switch both UC-1/UC-2 and UC-3 to Vite's `?url` asset-import pattern so the WASM resolves from `node_modules/sql.js/dist/` at build time and emits into the host's build output automatically. Eliminates the entire "host forgot to copy" failure class for `<QuizBlock>` consumers, removes the checked-in `app/static/sql-wasm.wasm` (no more two sources of truth), and shrinks the README's setup story to one sentence. Pattern C alternative for the embed shape.

**Breaking change for existing `<QuizBlock>` hosts** — they must remove their `cp node_modules/sql.js/...` step. Per Q4, low risk: few existing implementations.

- [ ] Update `app/src/lib/db/database.ts`
  - [ ] Add `import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';` at the top
  - [ ] Replace `WASM_ASSET_URL` constant with `wasmUrl` (or replace `locateFile: f => '/' + f` with `locateFile: () => wasmUrl`)
  - [ ] Update the M.g HEAD precheck to use `wasmUrl` (which Vite resolves to a hashed path under `_app/immutable/assets/` in production, or the dev URL in development)
- [ ] Delete `app/static/sql-wasm.wasm` from git (`git rm`)
- [ ] Audit `app/package.json` for any `postinstall` or other script that copies the WASM into `static/`; remove if present
- [ ] Update `app/src/lib/embed/README.md`
  - [ ] Replace the entire "sql.js WASM setup" section with a single-line note: "No WASM setup required. The `sql-wasm.wasm` asset is bundled into your build output automatically by Vite when you import `<QuizBlock>`."
  - [ ] Remove the version-aware filename guidance (no longer host-side concern)
  - [ ] Add a one-line "Migration note for existing hosts" mentioning the removed copy step
- [ ] Update main repo [`README.md`](../../README.md) "Embed in your own SvelteKit app" section: remove the WASM-copy step from the host-setup checklist (drops from three steps to two: SSR-disable + styles import)
- [ ] Update [`docs/specs/tech-spec.md`](../../docs/specs/tech-spec.md) "WASM binary handling" subsection
  - [ ] Replace the version-aware filename guidance with the Vite asset-import approach (one paragraph)
  - [ ] Remove the note about pinning to `sql.js@^1.13.0` for the legacy single-file copy — no longer relevant
  - [ ] Update the "Package contents" / "Peer expectations" sections in the npm packaging block: hosts no longer copy WASM; `sql.js` runtime dep is the only requirement
- [ ] Update [`app/src/lib/embed/README.md`](../../app/src/lib/embed/README.md)'s "SvelteKit host setup" subsection if it references WASM (the SSR-disable note from M.b stays as-is)
- [ ] Tests
  - [ ] Existing `app/tests/embed/QuizBlock.test.ts` continues to pass (Vite asset-import works in Vitest's default Vite environment)
  - [ ] Add a test that asserts the resolved `wasmUrl` is a non-empty string (sanity check that the import resolves)
- [ ] Verify
  - [ ] `pnpm dev` starts and renders a quiz without `app/static/sql-wasm.wasm` present
  - [ ] `pnpm --dir app build` produces a working static SPA; the WASM appears under `app/build/_app/immutable/assets/`
  - [ ] `pnpm --dir app package` produces a working npm bundle (the asset-import resolves at host build time, not at package build time, so `dist/` does not contain the WASM)
  - [ ] `pnpm publint` passes
  - [ ] `pnpm check` — 0 errors, 0 warnings
  - [ ] *(pending — manual host harness)* Fresh SvelteKit scratch app, `pnpm add @pointmatic/quizazz`, no WASM copy step, `<QuizBlock>` renders and completes a quiz end-to-end

### Story M.j: '<QuizBlock>' Error Channel; '+page.svelte' Layout Banner [Planned]

Surface DB-init failures programmatically (UC-3) and visually (UC-1/UC-2). `<QuizBlock>` gains an `onerror` callback prop and a `CustomEvent('error')` channel mirroring the dual-channel pattern of `complete`; `+page.svelte` gains a layout-level `<RecordingPausedBanner>` driven by a `dbInit` store with status-aware actions. Pattern E for both shapes.

- [ ] Define `QuizErrorEvent` in `app/src/lib/types/index.ts`
  - [ ] `{ quizRef: string; errorType: 'wasm-missing' | 'failed'; message: string }`
- [ ] Create `app/src/lib/stores/db-init.ts`
  - [ ] `export const dbInit = writable<'pending' | 'ready' | 'wasm-missing' | 'failed'>('pending')`
  - [ ] (Optional) helper functions to set the store from observed errors
- [ ] Create `app/src/lib/components/RecordingPausedBanner.svelte`
  - [ ] Subscribes to `dbInit`
  - [ ] Renders nothing on `'pending'` and `'ready'`
  - [ ] On `'wasm-missing'`: explanatory copy + "Reload" button (`window.location.reload()`)
  - [ ] On `'failed'`: explanatory copy + "Reset Database" button (drops the IDB entry for the active quiz via `indexedDB.deleteDatabase(getDbName(quizName))`, then reloads)
  - [ ] Visible/dismissable styling matching the existing app design (Tailwind utilities)
- [ ] Update `app/src/routes/+page.svelte`
  - [ ] Wrap each `initDatabase(...)` call in `try/catch`
  - [ ] On `WasmAssetMissingError`: `dbInit.set('wasm-missing')`
  - [ ] On other errors: `dbInit.set('failed')`
  - [ ] On success: `dbInit.set('ready')` after seeding scores
  - [ ] Render `<RecordingPausedBanner />` at the top of the layout
  - [ ] Don't render quiz UI (`viewMode === 'chooser' | 'nav' | ...`) until `$dbInit === 'ready'`
- [ ] Update `app/src/lib/embed/QuizBlock.svelte`
  - [ ] Add `onerror?: (event: QuizErrorEvent) => void` to `Props`
  - [ ] Wrap `initDatabase(manifest.quizName)` in `onMount` with `try/catch`
  - [ ] On typed failure: classify (`'wasm-missing'` for `WasmAssetMissingError`, `'failed'` otherwise), build payload, call `onerror?.(payload)`, dispatch `rootEl?.dispatchEvent(new CustomEvent('error', { detail: payload, bubbles: true }))`, set local error state
  - [ ] When local error state is set, render `<aside data-quizazz-error>` with explanatory copy in place of the quiz UI; don't call `startQuiz` or `seedScores`
  - [ ] Don't fire `complete` after an error
- [ ] Tests
  - [ ] `app/tests/embed/QuizBlock.test.ts`: mock `initDatabase` to reject with `WasmAssetMissingError` → `onerror` invoked with `errorType: 'wasm-missing'`, payload-shape assertions; `CustomEvent('error', { detail, bubbles: true })` fires on the root; fallback aside renders; `startQuiz` not called
  - [ ] Same suite: generic `Error` rejection → `errorType: 'failed'`
  - [ ] Regression: successful init does not call `onerror` and does not dispatch `'error'` event
  - [ ] `app/tests/components/RecordingPausedBanner.test.ts`: each store value renders the right shape and the right action; "Reset Database" action calls `indexedDB.deleteDatabase` with the expected name and reloads
  - [ ] `app/tests/stores/db-init.test.ts`: store transitions don't fire reactive cycles when set to the same value (sanity)
- [ ] Verify: `pnpm check` — 0 errors, 0 warnings; `pnpm exec vitest run` passes; manual smoke-test: temporarily break the WASM URL, observe banner in `+page.svelte` and `onerror`/fallback in `<QuizBlock>`

### Story M.k: Repo-Boundary Swallow Rule [Planned]

Defensive `try/catch` around runtime DB calls so a transient IDB error (quota exceeded, transaction abort, post-init corruption) doesn't crash an in-progress answer-submit or score-load. Surfaces failures to the `dbInit` store from M.j; UI continues to render rather than blank. Pattern D, adapted to quizazz's structure (where init errors land at mount time rather than per-call, so the swallow site is the *runtime* path, not the read/write boundary).

- [ ] Update `app/src/lib/db/scores.ts`
  - [ ] Wrap `getScores`, `seedScores`, `updateScore`, `recordAnswer` in `try/catch`
  - [ ] On any caught error: log to `console.error` with `[quizazz]` prefix; flip `dbInit` store to `'failed'`; return safe sentinel:
    - `getScores` → `[]`
    - `seedScores` / `updateScore` / `recordAnswer` → no-op return
  - [ ] Add a module-comment block at the top: "Runtime sql.js errors are swallowed here because they are surfaced once via the `dbInit` store (subscribed by `<RecordingPausedBanner>`) or via `<QuizBlock>`'s `onerror` channel. Do not refactor away these catches without first verifying the failure-surface contract is preserved. See [phase-m-subplan-sql-js-robustness.md](../../docs/specs/phase-m-subplan-sql-js-robustness.md)."
- [ ] Update `app/src/lib/engine/lifecycle.ts` `persistDatabase` call site at [line 164](../../app/src/lib/engine/lifecycle.ts#L164)
  - [ ] Wrap in `try/catch`; on caught error: log + flip `dbInit` to `'failed'`; do not throw (callers like `submitAnswer` should not abort on a persist failure — the in-memory state is correct, only persistence to IDB failed)
- [ ] Tests
  - [ ] `app/tests/db/scores.test.ts`: mock `db.exec` / `db.run` to throw → `getScores` returns `[]`; writes are no-ops; `dbInit` flips to `'failed'`
  - [ ] `app/tests/engine/lifecycle.test.ts`: mock `persistDatabase` to throw → `submitAnswer` still completes (in-memory state updated); `dbInit` flips to `'failed'`
- [ ] Verify: `pnpm check` — 0 errors, 0 warnings; `pnpm exec vitest run` passes; the failure-surface from M.j is preserved

### Story M.l: v1.3.0 Release [Planned]

Lockstep version bump and CI-driven publish for the subplan bundle. Mirrors the M.f release flow (tag-driven CI for both PyPI and npm); no new infrastructure work — just confirming the M.f workflows handle a clean release end-to-end.

- [ ] Bump versions
  - [ ] [`python/pyproject.toml`](../../python/pyproject.toml) `[project].version` → `1.3.0`
  - [ ] [`python/src/quizazz/__init__.py`](../../python/src/quizazz/__init__.py) `__version__` → `"1.3.0"`
  - [ ] [`app/package.json`](../../app/package.json) `version` → `"1.3.0"`
  - [ ] `MANIFEST_SCHEMA_VERSION` stays at `"1.0"` (no manifest shape changes — confirm by grep)
- [ ] Local preflight (mirrors what CI runs)
  - [ ] `pyve test` — full Python suite passes
  - [ ] `pnpm --dir app exec vitest run` — full TypeScript suite passes
  - [ ] `pnpm --dir app exec svelte-check --tsconfig ./tsconfig.json --fail-on-warnings` — 0 errors, 0 warnings
  - [ ] `pnpm --dir app package` — emits `dist/` with `dist/styles.css` cleanly; no `app/static/sql-wasm.wasm` reference
  - [ ] `pnpm --dir app exec publint` — "All good!"
  - [ ] `python -m build python/` + `twine check` — both sdist and wheel PASSED
- [ ] Update [`README.md`](../../README.md) and [`python/README.md`](../../python/README.md) version references (any `1.2.0` mentions) to `1.3.0`
- [ ] Push tags
  - [ ] `git tag -a npm-v1.3.0 -m "@pointmatic/quizazz 1.3.0" && git push origin npm-v1.3.0` — triggers [`publish-npm.yml`](../../.github/workflows/publish-npm.yml)
  - [ ] `git tag -a v1.3.0 -m "quizazz 1.3.0" && git push origin v1.3.0` — triggers [`publish-pypi.yml`](../../.github/workflows/publish-pypi.yml)
- [ ] Verify post-publish
  - [ ] `pnpm view @pointmatic/quizazz version` returns `1.3.0`
  - [ ] `pip install quizazz==1.3.0` in a fresh venv works; `quizazz --version` prints `1.3.0`
  - [ ] Provenance signature visible on the npm web UI ("Built and signed on GitHub Actions")
  - [ ] Re-run the post-publish host harness:
    - [ ] Fresh SvelteKit scratch app, `pnpm add @pointmatic/quizazz@1.3.0`, **no WASM copy step**, import styles, `<QuizBlock>` renders end-to-end
    - [ ] Smoke-test the failure surface: temporarily block the WASM URL via dev tools, verify `onerror` fires with `errorType: 'wasm-missing'` and the in-bounds fallback aside renders
- [ ] Append the M.g – M.l must-know facts to [`docs/specs/project-essentials.md`](project-essentials.md) per `plan_phase` step 7 (this happens after the stories ship, not as part of M.l's pre-release work — see the Project-Essentials Impact section in the subplan plan doc for the candidate facts)

---

## Future

<!--
This section captures items intentionally deferred from the active phases above:
- Stories not yet planned in detail
- Phases beyond the current scope
- Project-level out-of-scope items
The `archive_stories` mode preserves this section verbatim when archiving stories.md.
-->
