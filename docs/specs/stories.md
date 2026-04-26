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

### Story M.e: UC-1 `quizazz build --standalone <name>` [Planned]

Add the `--standalone <quiz-name>` flag to `quizazz build`. In standalone mode the CLI moves every non-target manifest to a `TemporaryDirectory`, sets `QUIZAZZ_STANDALONE` and `VITE_QUIZAZZ_STANDALONE` in the subprocess environment, runs the pnpm build, and unconditionally restores the moved files in a `finally` block. The app reads the Vite-prefixed env var and behaves accordingly: hides `ManifestUpload`, skips the chooser, auto-advances to nav.

```
quizazz build --standalone my-quiz
# → app/build/ contains a one-quiz SPA bundled with only my-quiz.json
```

- [ ] Update `python/src/quizazz/cli.py`
  - [ ] Add `--standalone <quiz-name>` flag to the `build` subparser
  - [ ] Implement `_stage_standalone(data_dir, target_name)` as a `contextmanager`:
    - [ ] Validate `<target_name>.json` exists under `data_dir`; fail with clear stderr + exit 1 if not
    - [ ] Move every other `*.json` in `data_dir` to a `tempfile.TemporaryDirectory`
    - [ ] `yield`
    - [ ] On `finally`, restore every moved file to its original path
  - [ ] In `cmd_build`, when `args.standalone` is set:
    - [ ] Enter the staging context
    - [ ] Build the environment dict: `{**os.environ, "QUIZAZZ_STANDALONE": args.standalone, "VITE_QUIZAZZ_STANDALONE": args.standalone}`
    - [ ] Run `pnpm --dir app build` with that env
    - [ ] Exit 0 on success, 1 on pnpm non-zero
  - [ ] No change to the default (non-standalone) build path
- [ ] Update `app/src/routes/+page.svelte`
  - [ ] Read `import.meta.env.VITE_QUIZAZZ_STANDALONE` at module scope
  - [ ] When set:
    - [ ] Filter `manifests` to the named one
    - [ ] If not found in `manifests`, render an explicit "build misconfiguration" error state (not a blank screen)
    - [ ] Do not render `ManifestUpload`
    - [ ] Skip the `chooser` view entirely; initial `viewMode` goes directly to `nav`
    - [ ] Defensive: ignore any `uploadedManifests` that somehow appear
  - [ ] When unset: existing UC-2 behavior unchanged
- [ ] Update `python/tests/test_cli.py`
  - [ ] Standalone with valid target manifest: stages others to temp, sets env, runs pnpm, restores others
  - [ ] Standalone with missing target manifest: exits 1 with clear message; no files moved
  - [ ] Standalone with only the target already present: no staging work done (no temp dir created); env set; pnpm run
  - [ ] Simulate pnpm failure (returncode 1): exit 1, others restored
  - [ ] Simulate KeyboardInterrupt during pnpm: `finally` runs, others restored
  - [ ] Non-standalone build unchanged (regression test)
- [ ] Update app tests
  - [ ] With `VITE_QUIZAZZ_STANDALONE` unset: chooser + upload visible for multi-manifest fixture
  - [ ] With `VITE_QUIZAZZ_STANDALONE="known"`: matching manifest → goes straight to `nav`; no upload UI
  - [ ] With `VITE_QUIZAZZ_STANDALONE="missing"`: build-misconfiguration error state rendered
- [ ] Update main README with a "Standalone single-quiz SPA" section covering the flag and intended use case
- [ ] Verify: all builder + app tests pass; `pnpm check` — 0 errors

### Story M.f: CI-Based npm Publishing [Planned]

Mirror the existing PyPI release workflow ([`.github/workflows/publish-pypi.yml`](../../.github/workflows/publish-pypi.yml)) for the npm side. Eliminates the manual credential handling, 2FA prompts, and ad-hoc preflight that 1.1.0 went through; future releases ship by pushing an `npm-v*` tag. Validates by being the actual publish mechanism for 1.2.0.

The asymmetry where Python is CI-published and npm is hand-published is a real source of friction — the [v1.1.0 release log](#story-ld-v110-npm-release--pointmaticquizazz-110-in-review) shows the manual flow took several rounds (login, 2FA enrollment, scope-org setup, dry-run debugging) that don't repeat well. CI removes the foot-guns; npm trusted publishing (OIDC, no stored tokens) parallels PyPI's setup almost exactly.

- [ ] Add `.github/workflows/publish-npm.yml`
  - [ ] Trigger on tag push matching `npm-v*` (matches the convention in [`app/RELEASE.md`](../../app/RELEASE.md))
  - [ ] Job runs on `ubuntu-latest`; uses a GitHub environment named `npm` (mirrors the `pypi` environment pattern, supports optional reviewers / branch filters)
  - [ ] `permissions: id-token: write` (required for OIDC trusted publishing)
  - [ ] Steps:
    - [ ] Checkout
    - [ ] Setup Node (matching app's engines field) and pnpm
    - [ ] `pnpm --dir app install --frozen-lockfile`
    - [ ] Preflight: `pnpm --dir app exec vitest run`, `pnpm --dir app check` (treats warnings as errors via `--fail-on-warnings` or equivalent — see M.a)
    - [ ] Build: `pnpm --dir app package`
    - [ ] Validate: `pnpm --dir app publint`
    - [ ] Publish: `pnpm --dir app publish --access public --provenance` (OIDC-signed; no stored token)
- [ ] One-time configuration *(developer, before first tag push)*
  - [ ] Create GitHub environment `npm` on the repo
  - [ ] On npmjs.com: register the workflow as a trusted publisher for `@pointmatic/quizazz` (Account → Access Tokens → Trusted Publishers; needs repo owner `pointmatic`, repo `quizazz`, workflow `publish-npm.yml`, environment `npm`)
- [ ] Update [`app/RELEASE.md`](../../app/RELEASE.md)
  - [ ] Replace the "Publishing" section with the tag-driven flow as primary: bump version in three files → commit → push tag `npm-v<version>` → CI does the rest
  - [ ] Keep the manual `pnpm publish` flow as a labeled fallback (for emergency / offline use)
  - [ ] Document the one-time GitHub environment + npm trusted publisher setup
- [ ] Update [`docs/specs/project-essentials.md`](../../docs/specs/project-essentials.md) "One project version" section to mention both PyPI (`v*` tag) and npm (`npm-v*` tag) trigger CI workflows
- [ ] Bump `python/pyproject.toml` `[project].version` and `python/src/quizazz/__init__.py` `__version__` to `1.2.0` (Phase M version-bump story; landed after Phase L's `1.1.0`)
- [ ] Verify
  - [ ] First-time use validates by being the actual publish mechanism for 1.2.0 — push `npm-v1.2.0` tag, CI completes, `pnpm view @pointmatic/quizazz version` returns `1.2.0`
  - [ ] Provenance signature visible on the npm web UI (the "Built and signed on GitHub Actions" attestation)
  - [ ] PyPI side: tag `v1.2.0` separately to trigger the existing PyPI workflow; both packages land at 1.2.0
  - [ ] Re-run the post-publish host harness ([stories.md:264](stories.md#L264)) against the CI-published 1.2.0 to confirm parity with manual publish

---

## Future

<!--
This section captures items intentionally deferred from the active phases above:
- Stories not yet planned in detail
- Phases beyond the current scope
- Project-level out-of-scope items
The `archive_stories` mode preserves this section verbatim when archiving stories.md.
-->
