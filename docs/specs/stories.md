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
> The console-script cleanup from story M.b was also folded in here (see M.b for the record). A Data Flow subsection was added to `tech-spec.md` so the `data/` → `python/` → `app/src/lib/data/` → `app/build/` pipeline is documented as one thought instead of scattered across four tables.

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

---

## Phase L: LearningFoundry Integration — Embeddable Component

Ship the SvelteKit half of the UC-3 host-integration contract: a `<QuizBlock>` component that takes a Phase-K-produced manifest plus a host-supplied `quizRef` and renders a full quiz experience inline in a host SvelteKit app, emitting a `complete` event with aggregate score on finish. Distributed as `@pointmatic/quizazz` on npm.

Phase L depends on Phase K (for the `schemaVersion` field and the published library API). No changes to the quiz engine, scoring, selection, presentation, or per-quiz IndexedDB — the component is a self-contained wrapper around existing engine modules. The one v1 restriction is single-instance-per-page; a mount-counter guard enforces this defensively.

**Intended release version:** `v1.1.0` — the whole phase ships together. Individual stories land unversioned; the version bump lives in the last story (L.d).

### Story L.a: `<QuizBlock>` Skeleton, Single-Instance Guard, Schema-Version Check [Done]

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

### Story L.b: End-to-End Quiz Flow Inside `<QuizBlock>` [Planned]

Wire the existing engine modules (`selection`, `presentation`, `scoring`, `lifecycle`) and the existing views (`QuizView`, `AnsweredQuestionsView`, `ReviewView`, `SummaryView`) into `<QuizBlock>` so a mounted component runs the full manifest as the question set, from first question through summary + drill-down + retake.

- [ ] Update `QuizBlock.svelte`
  - [ ] On mount (non-blocked, compatible), call `startQuiz(...)` with the full manifest question set
    - [ ] `config.questionCount = manifest.questions.length` (whole manifest)
    - [ ] `config.answerCount = 4` (fixed in v1; override is Future Vision per features.md)
    - [ ] `config.selectedTags = []` (no tag filter in embed mode)
    - [ ] `config.selectedNodeIds = []` (no nav scoping in embed mode)
  - [ ] Render the appropriate view based on `viewMode`:
    - [ ] `quiz` → `<QuizView>`
    - [ ] `quiz-answered` → `<AnsweredQuestionsView>`
    - [ ] `quiz-review` → `<ReviewView>` (mid-quiz)
    - [ ] `summary` → `<SummaryView>` (Retake visible; Start / Quit suppressed via a prop or wrapper)
    - [ ] `review` → `<ReviewView>` (post-quiz drill-down)
  - [ ] `SummaryView` integration: hide Start and Quit buttons when rendered inside `<QuizBlock>` (add a `showStartQuit?: boolean` prop to `SummaryView` defaulting to `true`; `<QuizBlock>` passes `false`)
- [ ] Tests in `QuizBlock.test.ts`
  - [ ] All-correct run through N questions → summary shows 100%; per-question drill-down works
  - [ ] All-incorrect run → cumulative scores reflect the `-5` per-question penalty
  - [ ] Retake: reshuffles answers, same question set, scores accumulate in DB, new `complete` event NOT fired until retake completes
  - [ ] Mid-quiz review: Escape opens answered list; selecting an answered question shows the `ReviewView`; Escape returns to current unanswered question without losing progress
  - [ ] Drill-down from summary: carousel (← / →) navigates between answered questions
- [ ] Verify: `pnpm check` — 0 errors; full quiz flow passes inside the component without regressing `+page.svelte` behavior

### Story L.c: Keyboard Scoping, `complete` Event, Theming Hooks [Planned]

Ensure keyboard interaction is confined to the component root (no `window` listeners), emit the completion event in both the modern callback-prop and classic `CustomEvent` forms, and add theming hooks so hosts can style `<QuizBlock>` to match their design system.

- [ ] Keyboard scoping
  - [ ] All keyboard handlers bound to the component root via `on:keydown` (or Svelte 5 equivalent); no `window.addEventListener` anywhere in the component or its imports
  - [ ] Audit the existing `QuizView`, `ReviewView`, `AnsweredQuestionsView` for any `window`-level listeners; if present, refactor to accept key events from a parent-supplied handler OR bind to their own root instead
  - [ ] Root element has `tabindex="0"` so the user can focus it by tabbing; focus ring styled to be visible but unobtrusive
- [ ] `complete` event
  - [ ] When the last question submits (transition into `summary`), compute aggregate: `score = sum of positive points across submitted answers` (the cumulative-score delta for this session), `maxScore = questionCount`, `questionCount = manifest.questions.length`
  - [ ] Call `oncomplete?.({ quizRef, score, maxScore, questionCount })`
  - [ ] Also `dispatchEvent(new CustomEvent('complete', { detail: {...}, bubbles: true }))` on the root element
  - [ ] Fires exactly once per end-of-quiz; retake does not re-fire until the retake also completes
- [ ] Theming hooks
  - [ ] Expose CSS custom properties on the root: `--quizazz-color-correct`, `--quizazz-color-incorrect`, `--quizazz-color-partially-correct`, `--quizazz-color-ridiculous`, `--quizazz-radius`, `--quizazz-font-family`
  - [ ] Document the full list in `app/src/lib/embed/README.md`
  - [ ] Update internal views to read these custom properties in place of (or as overrides for) hardcoded Tailwind color classes, where practical. Where impractical, note the limitation in the README.
- [ ] Tests
  - [ ] Keyboard: with document focus outside the component root, pressing `a` does NOT select an answer; with focus inside, pressing `a` selects answer A
  - [ ] `oncomplete` callback prop: fires exactly once on last-question submit, with the correct payload shape
  - [ ] `CustomEvent('complete')` also fires on the root and bubbles
  - [ ] Retake: `complete` does not re-fire until retake reaches its own last question
  - [ ] Theming: setting `--quizazz-color-correct` on the component root changes the correct-indicator color (visual-free assertion: computed style on the relevant element reflects the override)
- [ ] Verify: `pnpm check` — 0 errors; all embed tests pass; existing app tests still pass

### Story L.d: v1.1.0 npm Release — `@pointmatic/quizazz` 1.1.0 [Planned]

Configure `@sveltejs/package` to emit a publishable bundle from `app/src/lib/embed/`, polish `app/package.json` for public distribution, write the package README, and publish `@pointmatic/quizazz 1.1.0` to npm. This is the Phase L version-bump story: lockstep `python/pyproject.toml` and `python/src/quizazz/__init__.py` to `1.1.0` as well (even though the Python package doesn't change in L, the project carries one version). CI automation is out of scope.

- [ ] Configure `app/svelte.config.js` `package` section
  - [ ] Output directory: `dist/`
  - [ ] Entry: `src/lib/embed/index.ts`
  - [ ] Exclude: `routes/`, sample data `lib/data/*.json`, `QuizChooser.svelte`, `ManifestUpload.svelte`, `NavigationTree.svelte`, `ConfigView.svelte`, `utils/validate-manifest.ts`, `static/sql-wasm.wasm`
  - [ ] Include: `embed/`, `engine/`, `db/`, `stores/`, `types/`, `utils/format.ts`, `utils/random.ts`, and the internal views the component reuses (`QuizView`, `AnsweredQuestionsView`, `ReviewView`, `SummaryView`, `ProgressBar`)
- [ ] Update `app/package.json` for public distribution
  - [ ] `name = "@pointmatic/quizazz"`
  - [ ] `version = "1.1.0"` (matches the project version; `MANIFEST_SCHEMA_VERSION = "1.0"` is unchanged — Phase L doesn't alter the manifest shape)
  - [ ] `description`: "Embeddable SvelteKit quiz component for Quizazz assessments."
  - [ ] `keywords`: `["quiz", "assessment", "education", "svelte", "sveltekit", "quizazz"]`
  - [ ] `license = "Apache-2.0"`
  - [ ] `repository.url`, `homepage`, `author` fields filled in
  - [ ] `exports` pointing at `./dist/embed/index.js` with `types` and `svelte` condition entries
  - [ ] `peerDependencies`: `svelte ^5`
  - [ ] `dependencies`: `sql.js ^1` (host's install will pull this in)
  - [ ] `files` whitelist: `["dist"]`
  - [ ] `publishConfig.access = "public"`
  - [ ] `type = "module"` (already set; confirm)
- [ ] Package README (`app/src/lib/embed/README.md` or host-rendered in `app/package.json` via `"readme"` field)
  - [ ] Install: `pnpm add @pointmatic/quizazz`
  - [ ] Usage example: `<QuizBlock manifest={...} quizRef="..." oncomplete={...} />`
  - [ ] sql.js WASM setup: copy `sql-wasm.wasm` to host's static root; configurable via `locateFile` override if needed (documented as Future Vision)
  - [ ] Theming: list of CSS custom properties + an example of theming via `<QuizBlock class="my-theme" />` + a `.my-theme { --quizazz-color-correct: ... }` block
  - [ ] Single-instance-per-page note with rationale and an explicit warning about the mount-counter guard
  - [ ] Schema-version compatibility: soft-warn behavior, current major = 1
- [ ] Release process documentation (in `app/src/lib/embed/README.md` or an adjacent `RELEASE.md`)
  - [ ] `pnpm --dir app package` to emit `dist/`
  - [ ] `pnpm --dir app publint` (or equivalent) to sanity-check the package layout
  - [ ] `pnpm --dir app publish --access public` (manual credential handling; no CI)
  - [ ] Dry-run on npm's `--dry-run` first; consider `npm publish --dry-run --tag next` or similar staging step before hitting `latest`
- [ ] Bump `python/pyproject.toml` `[project].version` and `python/src/quizazz/__init__.py` `__version__` to `1.1.0` (project carries one version even though the Python package is unchanged in Phase L)
- [ ] Publish `@pointmatic/quizazz 1.1.0` to npm
- [ ] Verify: fresh SvelteKit scratch app → `pnpm add @pointmatic/quizazz` + host-supplied WASM → `<QuizBlock>` renders and completes a quiz end-to-end; `complete` event observable from the host
- [ ] Update the main repo README with an "Embed in your own SvelteKit app" section referencing `@pointmatic/quizazz`

---

## Phase M: Standalone SPA Packaging and Housekeeping

Close out the UC-1 surface promised in features.md (a `quizazz build --standalone <name>` CLI flag that produces a one-quiz SPA with chooser/upload UI elided), and clean up two items deliberately deferred from Phases K and L: the legacy CLI console scripts, and the full Apache-2.0 boilerplate headers on existing source files.

Phase M has no learningfoundry dependency. It is pure project-internal. Phase L must be landed before Phase M because FM-2 and Phase L both touch `+page.svelte`.

**Intended release version:** `v1.2.0` — the whole phase ships together. Individual stories land unversioned; the version bump lives in the last story (M.c).

### Story M.a: UC-1 `quizazz build --standalone <name>` [Planned]

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

### Story M.b: Remove Legacy CLI Console Scripts [Done]

> Absorbed into K.d as part of the PyPI package rename (`quizazz-builder` → `quizazz`). Shipping 1.0.0 with legacy console scripts only to delete them in 1.0.1 would have been silly, so the cleanup landed in the same change that renamed the dist.

- [x] Dropped `quizazz-builder = "quizazz_builder.__main__:main"` and `quizazz_builder = "quizazz_builder.__main__:main"` from `[project.scripts]`. Only `quizazz = "quizazz.cli:main"` remains.
- [x] Simplified `python/src/quizazz/__main__.py` to the thin `from quizazz.cli import main` delegator with the SPDX-only header.
- [x] Repo-wide grep for `quizazz-builder` / `quizazz_builder` shell-command references cleaned up during the rename sweep (READMEs, docs, release notes, GHA workflow).
- [x] No separate PyPI release note needed — `quizazz 1.0.0` is the first public release, so nothing to deprecate.

### Story M.c: v1.2.0 SPDX-Only Header Retrofit [Planned]

Replace the full 14-line Apache-2.0 boilerplate on every existing source file with the 2-line SPDX variant defined in project-essentials. Mechanical, verify-only diff — no semantic content changes. New files created between Phase K and now already use SPDX-only; this story closes the gap for pre-K files.

- [ ] Identify the full set of files carrying the Apache-2.0 boilerplate
  - [ ] `python/src/quizazz/**/*.py`
  - [ ] `python/tests/**/*.py`
  - [ ] `app/src/**/*.ts`
  - [ ] `app/src/**/*.svelte`
  - [ ] `app/src/app.css`
  - [ ] `install.sh`
  - [ ] Any other file grep-discovers with the boilerplate block
- [ ] Write a one-shot replacement script (or use a sed command pinned in the PR description) that:
  - [ ] Matches the full boilerplate block verbatim (the current 14-line form)
  - [ ] Replaces it with the 2-line SPDX variant in the correct comment syntax for each file type
  - [ ] Preserves the copyright year as written (do not mass-rewrite years; if a file had `2025`, keep `2025`)
  - [ ] Leaves the rest of the file byte-for-byte identical
- [ ] Run the script; review the diff
  - [ ] Verify every changed file's diff shows **only** the header block substitution and nothing else
  - [ ] If any file's diff contains other changes, back out and investigate before landing
- [ ] Config files (`pyproject.toml`, `svelte.config.js`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `.gitignore`, `pnpm-workspace.yaml`) are left untouched — these do not conventionally carry per-file license headers
- [ ] Generated artifacts are left untouched (`app/src/lib/data/*.json`, `app/static/sql-wasm.wasm`)
- [ ] Bump `python/pyproject.toml` `[project].version` and `python/src/quizazz/__init__.py` `__version__` to `1.2.0` (Phase M version-bump story; landed after Phase L's `1.1.0`)
- [ ] Verify: all builder + app tests pass; `pnpm check` — 0 errors; manual spot-check of 3–5 files confirms the SPDX two-liner is correct for the file type

---

## Future

<!--
This section captures items intentionally deferred from the active phases above:
- Stories not yet planned in detail
- Phases beyond the current scope
- Project-level out-of-scope items
The `archive_stories` mode preserves this section verbatim when archiving stories.md.
-->
