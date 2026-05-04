# Changelog

All notable changes to Quizazz are recorded here. Each entry lists the story IDs that landed in a given version; full task-level detail lives in [`docs/specs/stories.md`](docs/specs/stories.md) (and [`docs/specs/.archive/`](docs/specs/.archive/) for pre-1.0.0 history).

The project follows loose semver per [`docs/specs/project-essentials.md`](docs/specs/project-essentials.md): **X** for breaking changes or major milestones, **Y** for features (typically one story, or a bundle of stories within a phase once production is stable), **Z** for bug fixes and trivial changes. Both published packages — `quizazz` on PyPI and `@pointmatic/quizazz` on npm (Phase L onwards) — release in lockstep at the same project version.

`MANIFEST_SCHEMA_VERSION` (embedded in every compiled manifest as `schemaVersion`) is a separate protocol marker that tracks producer/consumer compatibility; it bumps only on actual manifest-shape changes. Current value: `1.0`.

This changelog was first compiled retrospectively from the stories spec at v1.2.0.

---

## [Unreleased]

_No unreleased changes._

---

## [1.3.0] — Phase M Subplan: sql.js / WASM / IndexedDB Robustness

Audit-driven robustness work addressing the four gotchas and five patterns from [`docs/specs/sql-js-wasm-robustness.md`](docs/specs/sql-js-wasm-robustness.md). Whole-subplan release per the post-1.0.0 phase-versioning convention; bump landed in M.l. See [`docs/specs/phase-m-subplan-sql-js-robustness.md`](docs/specs/phase-m-subplan-sql-js-robustness.md) for the full plan.

**Breaking change for existing `<QuizBlock>` hosts:** the host-side WASM-copy step (`cp node_modules/sql.js/dist/*.wasm static/`) is no longer required and is no longer supported. The asset is now bundled into the host's build output automatically by Vite. See M.i.

- **M.g** — `WasmAssetMissingError` typed error class + HEAD-fetch precheck before `initSqlJs`. New [`app/src/lib/db/errors.ts`](app/src/lib/db/errors.ts); `WASM_ASSET_URL` constant and `assertWasmAssetAvailable` exported from [`$lib/db`](app/src/lib/db/index.ts); `initDatabase` runs the precheck before `initSqlJs` so a 404 or network failure throws a typed, programmatically-catchable error instead of silently producing a half-initialised `Database`.
- **M.h** — Init memoization (Pattern B). Two-layer memo in [`app/src/lib/db/database.ts`](app/src/lib/db/database.ts): module-level `sqlJsInitPromise` for the shared sql.js init (precheck + `initSqlJs`), and a per-quiz `Map<string, Promise<Database>>` for the full open sequence. Both layers clear their slot on rejection so a retry re-runs without "poison the cache" failure. Test-only `__resetMemoization` export so each test gets a clean slate.
- **M.i** — Vite asset-import WASM bundling for both UC-1/UC-2 and UC-3. [`app/src/lib/db/database.ts`](app/src/lib/db/database.ts) now imports the WASM via `import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';`; Vite resolves the import at host build time and emits the asset under `_app/immutable/assets/sql-wasm-<hash>.wasm`. Removes the checked-in `app/static/sql-wasm.wasm`, drops the host-side `cp node_modules/sql.js/dist/*.wasm static/` step from the `<QuizBlock>` setup contract (breaking change for existing hosts — they must remove their copy step), and shrinks the embed setup story to two host-side steps (SSR-disable + styles import). Docs updated: embed README, main repo README, `tech-spec.md` ("WASM binary handling" + "Peer expectations").
- **M.j** — DB-init failure surfacing for both UC-1/UC-2 and UC-3. `<QuizBlock>` gains an `onerror` callback prop and a bubbling `CustomEvent('error')` channel ([`QuizErrorEvent`](app/src/lib/types/index.ts) → `{ quizRef, errorType: 'wasm-missing' | 'failed', message }`); on init failure it renders a fallback `<aside data-quizazz-error>` in place of the quiz UI and never fires `complete`. `+page.svelte` gains a layout-level [`<RecordingPausedBanner>`](app/src/lib/components/RecordingPausedBanner.svelte) driven by a new [`dbInit` store](app/src/lib/stores/db-init.ts) (`'pending' | 'ready' | 'wasm-missing' | 'failed'`) with status-aware actions: "Reload" for `wasm-missing`, "Reset Database" (`indexedDB.deleteDatabase` + reload) for `failed`. Quiz UI is suppressed in error states. Tests: +20 (7 QuizBlock error-channel, 7 banner, 6 store).
- **M.k** — Repo-boundary swallow rule for runtime DB errors. [`scores.ts`](app/src/lib/db/scores.ts) wraps `getScores` / `seedScores` / `updateScore` / `recordAnswer` in `try/catch`; on failure, logs `[quizazz] <op> failed:` and flips `dbInit` to `'failed'`, returning safe sentinels (`[]` for reads, no-op for writes) so a transient IDB error doesn't crash an in-progress answer-submit or score-load. `persistDatabase` call site in [`lifecycle.ts`](app/src/lib/engine/lifecycle.ts) gets the same treatment so a final-flush failure doesn't abort `submitAnswer` — in-memory state is already correct, only persistence failed. The failure-surface from M.j (`<RecordingPausedBanner>` / `<QuizBlock>` `onerror`) is preserved. Module-level comment in `scores.ts` documents the swallow contract for future readers. Tests: +6 (5 scores swallow paths, 1 lifecycle persist-fail).
- **M.l** — v1.3.0 lockstep release: bumped [`python/pyproject.toml`](python/pyproject.toml), [`python/src/quizazz/__init__.py`](python/src/quizazz/__init__.py) `__version__`, and [`app/package.json`](app/package.json) to `1.3.0`. `MANIFEST_SCHEMA_VERSION` stays at `"1.0"` (no manifest-shape changes in this subplan). Local preflight: 159/159 Python tests, 215/215 TS tests, 0/0 svelte-check, `pnpm package` + `publint` clean, `python -m build` + `twine check` PASSED on both sdist and wheel. Tag-driven CI publish via `npm-v1.3.0` and `v1.3.0`.

---

## [1.2.0] — Phase M: Hardening, Standalone Build, and Release Automation

Whole-phase release per the post-1.0.0 phase-versioning convention; bump landed in M.f. Published `@pointmatic/quizazz@1.2.0` to npm via the new tag-driven CI workflow with provenance attestation. PyPI side pending tag push at the time of this changelog backfill.

- **M.a** — Resolve `ConfigView` Svelte 5 `state_referenced_locally` warning; restores zero-warning baseline from `pnpm check`.
- **M.b** — Embed README WASM filename fix (sql.js ≥ 1.14 ships `sql-wasm-browser.wasm`); document the SSR-disable requirement (`export const ssr = false;`) on host routes that mount `<QuizBlock>`.
- **M.c** — SPDX-only header retrofit across 56 pre-K source files (Python, TypeScript, Svelte, CSS, shell, root config files); replaces the 14-line Apache-2.0 boilerplate with the 2-line SPDX form.
- **M.d** — `<QuizBlock>` self-contained styles bundle: precompiled `dist/styles.css` (~13 KB) emitted by `@tailwindcss/cli` from `src/lib/embed/styles.css`; sub-exported as `./styles.css`; preflight-free so the bundle does not restyle host elements outside `<QuizBlock>`.
- **M.e** — UC-1 `quizazz build --standalone <quiz-name>`: stages other manifests to a temp dir, sets `QUIZAZZ_STANDALONE` + `VITE_QUIZAZZ_STANDALONE` env vars, restores manifests on completion or failure; `+page.svelte` honors the env to skip chooser and auto-select the named manifest.
- **M.f** — CI-based npm publishing: tag-driven [`publish-npm.yml`](.github/workflows/publish-npm.yml) on `npm-v*` tags with OIDC trusted publishing and provenance, mirroring the existing PyPI workflow. Hard-won lessons (environment deployment-rule patterns, `npm publish` vs `pnpm publish` for OIDC, Node 24 for npm 11+) baked into the workflow comments and [`app/RELEASE.md`](app/RELEASE.md).

---

## [1.1.0] — Phase L: Embeddable Component (`@pointmatic/quizazz` on npm)

First-time release of the embeddable SvelteKit component for UC-3. Whole phase shipped together; bump landed in L.d.

- **L.a** — `<QuizBlock>` skeleton at `app/src/lib/embed/QuizBlock.svelte`: props (`manifest`, `quizRef`, `class`, `oncomplete`), single-instance-per-page guard via a module-level mount counter, soft schema-version compatibility check, per-quiz IndexedDB initialization on mount.
- **L.b** — End-to-end quiz flow inside `<QuizBlock>`: wires `selection` / `presentation` / `scoring` / `lifecycle` engines and `QuizView` / `AnsweredQuestionsView` / `ReviewView` / `SummaryView` views; new `quiz-review` `ViewMode` variant and `reviewAnsweredMidQuiz` / `exitMidQuizReview` lifecycle helpers.
- **L.c** — Keyboard scoping (root-bound `on:keydown`, no `window` listeners anywhere reachable from `<QuizBlock>`); `complete` event via both `oncomplete` callback prop and `CustomEvent('complete')` on the root; CSS custom property theming hooks (`--quizazz-color-correct/-incorrect/-partially-correct/-ridiculous`, `--quizazz-radius`, `--quizazz-font-family`).
- **L.d** — v1.1.0 npm release: configured `@sveltejs/package` to emit `dist/` from `app/src/lib/embed/`; polished `app/package.json` for public distribution (`name = "@pointmatic/quizazz"`, `exports`, `peerDependencies`, `publishConfig.access = "public"`); package README with install / usage / sql.js WASM setup / theming / single-instance / schema-version sections; lockstep bump of `python/pyproject.toml` and `python/src/quizazz/__init__.py`.

---

## [1.0.0] — First public release (`quizazz` on PyPI)

First stable public release of the Python package. Story K.d shipped a major version per the loose-semver "X bumps on a big amazing new thing" rule. Folded in three in-place renames (free before publish, squatter after) and the legacy console-script cleanup originally planned as a Phase M story.

- **K.d** — PyPI release `quizazz 1.0.0`:
  - PyPI distribution rename `quizazz-builder` → `quizazz`.
  - Python import / source-directory rename `quizazz_builder` → `quizazz`.
  - Top-level repo subdirectory rename `builder/` → `python/` (symmetric with `app/` and `data/`).
  - Dropped legacy `quizazz-builder` and `quizazz_builder` console scripts; only `quizazz = "quizazz.cli:main"` remains. `python -m quizazz` continues to work via a thin `__main__.py` delegator.
  - GitHub Actions workflow [`publish-pypi.yml`](.github/workflows/publish-pypi.yml) on bare `v*` tags with OIDC trusted publishing.
  - `pyproject.toml` metadata polish (description, keywords, classifiers, project URLs); release-process note at `python/RELEASE.md`.

## [0.41.0]

- **K.c** — Public Library API: `quizazz/api.py` with `compile_assessment(yaml_path, base_dir) -> dict`, `validate_assessment(yaml_path, base_dir) -> list[str]`, and a `_resolve_under_base` path-escape guard. `from quizazz import compile_assessment, validate_assessment, ValidationError` is now a stable, documented contract for host frameworks (UC-3 build-time integration).

## [0.40.0]

- **K.b** — Shared Compile Core + `schemaVersion`: extracted `compile_quiz_to_dict` as the shared core used by both the CLI (`compile_quiz` wraps it with disk write) and the future library API; introduced `MANIFEST_SCHEMA_VERSION = "1.0"` and injected `schemaVersion` as the first key in every emitted manifest; added optional `schemaVersion?: string` to the TypeScript `QuizManifest` interface (reserved for Phase L).

## [0.39.0]

- **K.a** — Structured `ValidationError`: renamed `QuizValidationError` → `ValidationError`; added `file_path: Path`, `message: str`, `detail: dict | None` attributes so host frameworks can catch and inspect violations programmatically. CLI error output format unchanged.

---

## [0.38.0]

- **J.k** — Upload custom quiz package at runtime: `validate-manifest.ts` shape validator; `ManifestUpload.svelte` chooser-screen file input with drag-and-drop; uploaded manifests appear alongside built-in quizzes (session-scoped); per-quiz DB initialized for uploaded `quizName`; remove-uploaded-quiz button.
- **J.l** *(post-bump housekeeping, no version)* — `install.sh` script at repo root; README updated to use `./install.sh`; Pyve tip added.

## [0.37.0]

- **J.j** — Multi-Quiz Discovery and Chooser: Vite `import.meta.glob` discovers all `*.json` quiz packages at build time; single manifest auto-loads (current behavior preserved); multiple manifests show a chooser screen; `chooser` view mode added.

## [0.36.0]

- **J.i** — Unified `quizazz` CLI: replaced `quizazz-builder` and `serve.py` with a single `quizazz` entry point exposing `generate` / `build` / `run` subcommands; sensible defaults so each subcommand works with zero flags from repo root; manifest output renamed `manifest.json` → `{quiz_name}.json`.

## [0.35.0]

- **J.h** — Per-Question Timer: live mm:ss display in `QuizView`; elapsed time accumulates across edits, resumes on edit, snapshots on view transitions; `elapsed_ms` column added to `session_answers` (schema migration 0 → 1); summary shows per-question time + total + average.

## [0.34.0]

- **J.g** — Deferred Scoring, Answer Changing, Developer Experience: scoring deferred until quiz completion (`finalizeQuiz`); `frontierIndex` tracks furthest unanswered question separately from `currentIndex`; `editAnsweredQuestion` lets users re-answer prior questions; `quizazz-builder` CLI entry point added; deduplicated Pydantic validation errors; `serve.py` helper script (later subsumed by `quizazz run` in J.i).

## [0.33.0]

- **J.f** — Sample Data Migration, README, Final Tests: compiled `data/quiz/` to `app/src/lib/data/manifest.json` (19 questions, 2 topics); README rewritten for multi-quiz / nav-tree / mastery / per-quiz DB isolation; "Creating a New Quiz" section added.

## [0.32.0]

- **J.e** — Wire Navigation Tree into Quiz Flow: nav → config → quiz transition; `setNavNodes`, `collectQuestionIds`, `filterByNodeIds` lifecycle helpers; `startQuiz` filters by `selectedNodeIds` before weighted selection; integration tests for the nav scoping.

## [0.31.0]

- **J.d** — Navigation Tree Component: `NavigationTree.svelte` renders nested directory/topic/subtopic structure; collapse/expand on directory nodes; checkbox selection with parent-child propagation; mastery badges (green ≥80%, amber ≥40%, gray <40%).

## [0.30.0]

- **J.c** — Database Isolation Per Quiz: `getDbName(quizName)` returns `"quizazz-{quizName}"`; `initDatabase` and `persistDatabase` accept `quizName`; `lifecycle.startQuiz` accepts and stores `activeQuizName`. Cross-quiz score interference structurally impossible.

## [0.29.0]

- **J.b** — Mastery Score Computation: `MasteryScore` interface (`total`, `positive`, `percent`); `computeMastery(questionIds, scores)` aggregates per-node mastery as percentage of questions with `cumulativeScore > 0`.

## [0.28.0]

- **J.a** — TypeScript Types and Manifest Import: added `topicId` and `subtopic` to `Question`; new `NavNode`, `NavNodeType`, `QuizManifest` types; `selectedNodeIds: string[]` added to `QuizConfig`; `app/src/lib/data/index.ts` imports the manifest JSON.

---

## [0.27.0]

- **I.f** — Migrate Sample Data and Builder Tests: migrated `data/quiz/sample.yaml` to `QuizFile` format with subtopics; new `data/quiz/advanced/advanced_sample.yaml` demonstrating nested directories; multi-quiz layout `data/quiz/` (default) + `data/aws-ml-specialty-exam/`.

## [0.26.0]

- **I.e** — CLI Single Quiz and Batch Modes: `python -m quizazz_builder --input data/quiz/ --output app/build/quiz/` for single; `--all --input data/ --output app/build/` for batch; per-quiz `manifest.json` emission; `--all` validates `--input` is a directory.

## [0.25.0]

- **I.d** — Compiler Manifest JSON Output: `compile_quiz` produces `manifest.json` with `quizName` / `tree` / `questions`; questions carry `topicId` and `subtopic` references; `compile_questions` deprecated.

## [0.24.0]

- **I.c** — Manifest Generation: `manifest.py` `build_navigation_tree` constructs nested directory/topic/subtopic nodes with aggregated `questionIds`; question IDs are SHA-256 hashes of question text.

## [0.23.0]

- **I.b** — Validator QuizFile Format and Recursive Directory: `validate_file` returns `QuizFile` (breaking change from `list[Question]`); `validate_quiz_directory` returns `(relative_path, QuizFile)` tuples preserving hierarchy.

## [0.22.0]

- **I.a** — `QuizFile` and `SubtopicGroup` Pydantic Models: per-file metadata (`menu_name`, `menu_description`, `quiz_description`); subtopic grouping; mixed bare + subtopic question lists; `QuestionBank` retained as deprecated legacy.

---

## [0.21.0]

- **H.c** — Polish, README, Final Tests for navigation: README "Keyboard Shortcuts" table; full-flow integration test (answer → go back → review → carousel → return → continue → summary → review).

## [0.20.0]

- **H.b** — Mid-Quiz Navigation to Answered Questions: `quiz-answered` and `quiz-review` view modes; `showAnsweredQuestions`, `reviewAnsweredQuestion`, `backToQuiz` lifecycle helpers; `AnsweredQuestionsView.svelte`; `Escape` opens answered list when ≥1 answered.

## [0.19.0]

- **H.a** — ReviewView Escape Hotkey and Carousel: `Escape` returns to summary (was `←`/`Backspace`); `←`/`→` carousel keys + buttons navigate between answered questions; `reviewPrev` / `reviewNext` lifecycle helpers with boundary clamping.

---

## [0.18.0]

- **G.d** — Sample Data, README, Tests for Tags: 12 sample questions tagged across `geography` / `science` / `technology` / `history` / `literature` / `math`; integration tests for tag OR-logic filter.

## [0.17.0]

- **G.c** — ConfigView Tag Filter UI: toggleable rounded chips for each tag; live "N of M questions available" count; question-count slider max adjusts to filtered pool.

## [0.16.0]

- **G.b** — App Types, Engine, Data for Tags: `tags: string[]` on `Question`; `selectedTags: string[]` on `QuizConfig`; `allTags` derived from compiled data; `selectQuestions` accepts `selectedTags` (OR-logic pre-filter).

## [0.15.0]

- **G.a** — Builder Optional Tags in YAML Schema: `Question.tags: list[str] | None = None` with lowercase normalization; empty/blank strings rejected; backward compatible with tagless questions.

---

## [0.14.0]

- **F.a** — README, Sample Data, Final Polish: project README rewritten with prerequisites / setup / YAML format / scoring system / build instructions; expanded `sample.yaml` to 12 questions; UI polish pass (dark theme, indigo accents, responsive containers, loading spinner, error state).

## [0.13.0]

- **E.a** — Integration Tests and Edge Cases: full quiz lifecycle integration tests; edge cases (1-question quiz, max-count quiz, all answer-count variants, uniform scores, all-negative scores, fresh DB).

---

## [0.12.0]

- **D.d** — Review View: per-question detail with all presented answers, user's selection highlighted, color-coded category labels (correct=green / partial=amber / incorrect=red / ridiculous=purple), explanations.

## [0.11.0]

- **D.c** — Summary View: prominent score percentage; correct count / total; per-question ✓/✗ list with click-to-review; Retake / Start New / Quit actions.

## [0.10.0]

- **D.b** — Quiz View: question display with clickable answer rows; `a`–`e` keyboard selection; `Enter` to submit; `ProgressBar` component ("Question N of M" + percent).

## [0.9.0]

- **D.a** — Config View: question-count slider, answer-count button group (3/4/5), Start button (disabled when invalid), `Enter`-to-start; `+page.svelte` initializes the database on mount and shows loading + error states.

---

## [0.8.0]

- **C.a** — Svelte Stores and Quiz Lifecycle: `quizSession` / `viewMode` / `reviewIndex` writables; `currentQuestion` / `progress` derived stores; lifecycle functions `startQuiz`, `submitAnswer`, `retakeQuiz`, `newQuiz`, `quitQuiz`, `reviewQuestion`, `backToSummary`.

---

## [0.7.0]

- **B.c** — Answer Presentation and Scoring: `presentAnswers(question, answerCount)` picks 1 correct + (N−1) others, shuffles, and assigns labels `a`..`e`; `SCORE_MAP = { correct: +1, partially_correct: −2, incorrect: −5, ridiculous: −10 }`.

## [0.6.0]

- **B.b** — Weighted Random Selection: `selectQuestions` weighted-without-replacement with weight formula `max_score − score + 1` (guarantees nonzero probability); `shuffle` (Fisher-Yates) and `weightedRandomIndex` utilities.

## [0.5.0]

- **B.a** — Client-Side SQLite Database: sql.js + IndexedDB persistence; `question_scores` and `session_answers` schema; `getScores` / `updateScore` / `seedScores` / `recordAnswer` CRUD; `sql-wasm.wasm` copied to `app/static/`.

---

## [0.4.0]

- **A.d** — TypeScript Types and Compiled Data Import: `AnswerCategory`, `Answer`, `Question`, `QuizConfig`, `PresentedAnswer`, `QuizQuestion`, `QuizSession`, `QuestionScore`; compiled `questions.json` wired into the app.

## [0.3.0]

- **A.c** — YAML Validator and Compiler: `validator.py` parses + validates YAML; `compiler.py` emits flat JSON with stable SHA-256 question IDs and category-flattened answers; CLI with `--input` and `--output`.

## [0.2.0]

- **A.b** — Pydantic Models and YAML Schema: `Answer`, `AnswerSet`, `Question`, `QuestionBank` models; AnswerSet validator (≥1 per category, total ≥5); non-empty text and explanation enforced.

## [0.1.0]

- **A.a** — Project Scaffolding and Hello World: SvelteKit skeleton with `@sveltejs/adapter-static`, TypeScript strict, Tailwind CSS 4.x, `lucide-svelte`; `builder/` workspace with `pyproject.toml` (pip + ruff + pytest); root README with project title and setup instructions.
