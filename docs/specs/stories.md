# stories.md — Quizazz (SvelteKit + Node + Python)

Stories are organized by phase and reference modules defined in [`tech_spec.md`](tech_spec.md). Each story is a small, independently completable unit of work with a checklist of concrete tasks.

Stories are numbered `<Phase>.<letter>` (e.g., A.a, A.b, B.a). Each story that produces code changes includes a semver version number, bumped incrementally. Stories with no code changes omit the version. The suffix `[Planned]` indicates work not yet started; `[Done]` indicates completed work.

---

## Phase A: Foundation

### Story A.a: v0.1.0 Project Scaffolding and Hello World [Done]

Minimal runnable artifacts for both workspaces. Proves the toolchain works end-to-end.

- [x] Initialize `app/` with SvelteKit skeleton
  - [x] Configure `@sveltejs/adapter-static` in `svelte.config.js`
  - [x] Enable TypeScript strict mode
  - [x] Install and configure Tailwind CSS 4.x with `@tailwindcss/vite`
  - [x] Install `lucide-svelte`
  - [x] Add Apache-2.0 copyright header to all new source files
- [x] Create `app/src/routes/+page.svelte` with a "Hello, Quizazz!" heading styled with Tailwind
- [x] Initialize `builder/` with `pyproject.toml` (using pip)
  - [x] Configure ruff, pytest
  - [x] Create `src/quizazz_builder/__init__.py` with `__version__ = "0.1.0"`
  - [x] Create `src/quizazz_builder/__main__.py` that prints "Hello, Quizazz Builder!"
  - [x] Add Apache-2.0 copyright header to all new source files
- [x] Create `data/questions/` directory with a placeholder `.gitkeep`
- [x] Create root `README.md` with project title, description, license badge, and basic setup instructions
- [x] Verify: `pnpm dev` in `app/` serves the hello world page
- [x] Verify: `python -m quizazz_builder` prints the hello message

### Story A.b: v0.2.0 Pydantic Models and YAML Schema [Done]

Define the data models that enforce the YAML question bank schema.

- [x] Create `builder/src/quizazz_builder/models.py`
  - [x] `Answer` model: `text: str`, `explanation: str` (both non-empty)
  - [x] `AnswerSet` model: `correct`, `partially_correct`, `incorrect`, `ridiculous` lists of `Answer`
  - [x] `AnswerSet` model validator: each category has >= 1 answer, total >= 5
  - [x] `Question` model: `question: str` (non-empty), `answers: AnswerSet`
  - [x] `QuestionBank` as `RootModel[list[Question]]`
- [x] Create `builder/tests/test_models.py`
  - [x] Test valid question passes validation
  - [x] Test empty question text raises error
  - [x] Test empty answer text raises error
  - [x] Test empty explanation raises error
  - [x] Test missing category raises error
  - [x] Test fewer than 5 total answers raises error
  - [x] Test 0 correct answers raises error
  - [x] Test question with extra answers (>5) passes validation
- [x] Verify: `pytest` passes in `builder/`

### Story A.c: v0.3.0 YAML Validator and Compiler [Done]

Read YAML files, validate with Pydantic models, and compile to JSON.

- [x] Create `builder/src/quizazz_builder/validator.py`
  - [x] `validate_file(path: Path) -> list[Question]` — parse YAML, validate via Pydantic
  - [x] `validate_directory(directory: Path) -> list[Question]` — validate all `.yaml` files, merge results
  - [x] Clear error messages: file path, question index, specific violation
- [x] Create `builder/src/quizazz_builder/compiler.py`
  - [x] `compile_questions(questions: list[Question], output_path: Path) -> None`
  - [x] Generate stable question IDs (SHA-256 of question text)
  - [x] Flatten categorized answers into flat list with `category` field
  - [x] Write JSON output
- [x] Update `builder/src/quizazz_builder/__main__.py`
  - [x] CLI with `--input` (directory) and `--output` (JSON path) arguments
  - [x] Exit 0 on success, exit 1 with error message on failure
- [x] Create `data/questions/sample.yaml` with 6 well-formed example questions
- [x] Create `builder/tests/test_validator.py`
  - [x] Test valid YAML file
  - [x] Test malformed YAML (syntax error)
  - [x] Test missing file
  - [x] Test empty file
  - [x] Test directory with multiple files
- [x] Create `builder/tests/test_compiler.py`
  - [x] Test JSON output structure matches expected format
  - [x] Test stable IDs (same question text → same ID)
  - [x] Test category flattening
- [x] Verify: `python -m quizazz_builder --input data/questions/ --output app/src/lib/data/questions.json` produces valid JSON
- [x] Verify: validation errors report file path and question index (covered in test suite)

### Story A.d: v0.4.0 TypeScript Types and Compiled Data Import [Done]

Define TypeScript types and wire up the compiled JSON for the app.

- [x] Create `app/src/lib/types/index.ts`
  - [x] `AnswerCategory`, `Answer`, `Question`, `QuizConfig`
  - [x] `PresentedAnswer`, `QuizQuestion`, `QuizSession`, `QuestionScore`
- [x] Create `app/src/lib/data/questions.json` by running the builder against `data/questions/sample.yaml`
- [x] Create `app/src/lib/data/index.ts` — typed export of compiled question data
- [x] Verify: `pnpm build` in `app/` succeeds with the compiled JSON present

---

## Phase B: Core Engine

### Story B.a: v0.5.0 Client-Side SQLite Database [Done]

Set up sql.js with IndexedDB persistence and the score schema.

- [x] Install `sql.js` in `app/`
- [x] Copy `sql-wasm.wasm` to `app/static/`
- [x] Create `app/src/lib/db/database.ts`
  - [x] `initDatabase()` — load WASM, restore from IndexedDB or create fresh
  - [x] `persistDatabase(db)` — export to Uint8Array, save to IndexedDB
  - [x] `createSchema(db)` — create `question_scores` and `session_answers` tables
- [x] Create `app/src/lib/db/scores.ts`
  - [x] `getScores(db)` — return all question scores
  - [x] `updateScore(db, questionId, points)` — increment cumulative score
  - [x] `seedScores(db, questionIds)` — INSERT OR IGNORE with score 0
  - [x] `recordAnswer(db, sessionId, questionId, category, points)` — insert session answer
- [x] Create `app/tests/db/scores.test.ts`
  - [x] Test seed scores initializes all questions to 0
  - [x] Test updateScore increments correctly (positive and negative)
  - [x] Test getScores returns all seeded questions
  - [x] Test recordAnswer inserts correctly
  - [x] Test seedScores is idempotent (INSERT OR IGNORE)
- [x] Verify: `pnpm vitest run` passes in `app/`

### Story B.b: v0.6.0 Weighted Random Selection [Done]

Question selection engine that favors lower-scored questions.

- [x] Create `app/src/lib/utils/random.ts`
  - [x] `shuffle<T>(array: T[]): T[]` — Fisher-Yates shuffle (returns new array)
  - [x] `weightedRandomIndex(weights: number[]): number` — pick index proportional to weight
- [x] Create `app/src/lib/engine/selection.ts`
  - [x] `selectQuestions(questions, scores, count)` — weighted random without replacement
  - [x] Weight formula: `max_score - score + 1` (minimum weight = 1)
- [x] Create `app/tests/utils/random.test.ts`
  - [x] Test shuffle returns all elements
  - [x] Test shuffle does not mutate original
  - [x] Test weightedRandomIndex respects weights (statistical test, N=10000)
- [x] Create `app/tests/engine/selection.test.ts`
  - [x] Test selects correct count
  - [x] Test handles count > pool size (returns all)
  - [x] Test lower-scored questions selected more often (statistical test, N=10000)
  - [x] Test all questions have nonzero selection probability
- [x] Verify: `pnpm vitest run` passes

### Story B.c: v0.7.0 Answer Presentation and Scoring [Done]

Answer selection, shuffling, and point calculation.

- [x] Create `app/src/lib/engine/presentation.ts`
  - [x] `presentAnswers(question, answerCount)` — pick 1 correct + (N-1) others, shuffle, label
- [x] Create `app/src/lib/engine/scoring.ts`
  - [x] `SCORE_MAP` constant
  - [x] `scoreAnswer(category)` function
- [x] Create `app/tests/engine/presentation.test.ts`
  - [x] Test exactly 1 correct answer in presented set
  - [x] Test total presented count matches answerCount (3, 4, 5)
  - [x] Test labels are sequential ("a", "b", "c", ...)
  - [x] Test answers are shuffled (statistical test over N runs)
  - [x] Test handles question with exactly 5 answers and answerCount=5
- [x] Create `app/tests/engine/scoring.test.ts`
  - [x] Test each category returns correct point value
  - [x] Test correct → +1, partially_correct → -2, incorrect → -5, ridiculous → -10
- [x] Verify: `pnpm vitest run` passes

---

## Phase C: Quiz State Management

### Story C.a: v0.8.0 Svelte Stores and Quiz Lifecycle [Done]

Reactive state management for the entire quiz flow.

- [x] Create `app/src/lib/stores/quiz.ts`
  - [x] `quizSession` writable store
  - [x] `viewMode` writable store (`"config" | "quiz" | "summary" | "review"`)
  - [x] `reviewIndex` writable store
  - [x] `currentQuestion` derived store
  - [x] `progress` derived store (current, total, percent)
- [x] Create `app/src/lib/engine/lifecycle.ts`
  - [x] `startQuiz(config, questions, scores, db)` — select questions, present answers, init session
  - [x] `submitAnswer(label, db)` — score, record, advance or complete
  - [x] `retakeQuiz(db)` — reshuffle same questions/answers, reset session state
  - [x] `newQuiz()` — return to config view
  - [x] `quitQuiz()` — return to config view
  - [x] `reviewQuestion(index)` — set review mode
  - [x] `backToSummary()` — return to summary view
- [x] Create `app/src/lib/db/index.ts` — barrel export for db module
- [x] Verify: `pnpm check` — 0 errors, 0 warnings

---

## Phase D: User Interface

### Story D.a: v0.9.0 Config View [Done]

The quiz configuration screen — first thing the user sees.

- [x] Create `app/src/lib/components/ConfigView.svelte`
  - [x] Number of questions: slider (1 to max, default = min(10, max))
  - [x] Number of answer choices: button group (3, 4, 5; default = 4)
  - [x] Display total available questions count
  - [x] "Start Quiz" button (disabled if config invalid)
  - [x] `Enter` key starts quiz when config is valid
  - [x] Clean, minimal styling with Tailwind
- [x] Wire into `app/src/routes/+page.svelte`
  - [x] Initialize database on mount
  - [x] Load questions from compiled JSON
  - [x] Show ConfigView when `viewMode === "config"`
  - [x] Loading spinner and error states
- [x] Verify: app loads, shows config screen, Start button works

### Story D.b: v0.10.0 Quiz View [Done]

The main quiz interaction — question display, answer selection, submission.

- [x] Create `app/src/lib/components/QuizView.svelte`
  - [x] Display question text
  - [x] Display answer choices as clickable rows with letter badges
  - [x] Entire answer row is clickable
  - [x] Keyboard: `a`–`e` selects corresponding answer
  - [x] Selected answer is visually highlighted
  - [x] "Submit" button (disabled until an answer is selected)
  - [x] `Enter` key submits when an answer is selected
  - [x] After submit: advance to next question (or complete quiz)
- [x] Create `app/src/lib/components/ProgressBar.svelte`
  - [x] Visual progress bar (filled percentage)
  - [x] "Question N of M" label
- [x] Wire into `+page.svelte`: show QuizView when `viewMode === "quiz"`

### Story D.c: v0.11.0 Summary View [Done]

Post-quiz results summary.

- [x] Create `app/src/lib/components/SummaryView.svelte`
  - [x] Score percentage display (prominent)
  - [x] Correct count / total
  - [x] Question list with ✓/✗ indicators
  - [x] Each question row is clickable → navigates to review
  - [x] Action buttons: "Retake", "Start New", "Quit"
  - [x] Color-coded styling based on score (green/amber/red)
- [x] Wire into `+page.svelte`: show SummaryView when `viewMode === "summary"`

### Story D.d: v0.12.0 Review View [Done]

Detailed question review with explanations.

- [x] Create `app/src/lib/components/ReviewView.svelte`
  - [x] Display question text
  - [x] Display all presented answers with:
    - [x] User's selection highlighted with "Your answer" badge
    - [x] Category label for each answer (color-coded)
    - [x] Explanation text for each answer
    - [x] Visual distinction: correct=green, partial=amber, incorrect=red, ridiculous=purple
  - [x] "← Back" button returns to summary
  - [x] `←` / `Backspace` key returns to summary
- [x] Wire into `+page.svelte`: show ReviewView when `viewMode === "review"`

---

## Phase E: Testing & Quality

### Story E.a: v0.13.0 Integration Tests and Edge Cases [Done]

End-to-end verification of the full quiz flow.

- [x] Add integration tests for quiz lifecycle (`tests/integration/lifecycle.test.ts`)
  - [x] Config → start → answer all → summary → review → back
  - [x] Config → start → answer all → retake → answer all → summary
  - [x] Config → start → answer all → start new → config
  - [x] Derived stores (currentQuestion, progress) track correctly
  - [x] quitQuiz clears session
  - [x] submitAnswer edge cases (no session, already submitted, invalid label)
  - [x] Database integration (scores updated, session answers recorded)
- [x] Add edge case tests (`tests/integration/edge-cases.test.ts`)
  - [x] Quiz with 1 question
  - [x] Quiz with max questions (all questions in bank)
  - [x] Count > pool size handled gracefully
  - [x] 3 answer choices, 4 answer choices, 5 answer choices
  - [x] Question with exactly 5 answers (minimum)
  - [x] Question with many answers (12)
  - [x] Fresh database / empty scores (fresh start)
  - [x] All questions have same score (uniform selection)
  - [x] One question has very negative score (statistical test, N=1000)
- [x] Verify: all tests pass — 61 app tests (`pnpm vitest run`), 42 builder tests (`pytest`)

---

## Phase F: Documentation & Polish

### Story F.a: v0.14.0 README, Sample Data, and Final Polish [Done]

Documentation, sample content, and UI polish.

- [x] Update root `README.md`
  - [x] Project description with features list
  - [x] Prerequisites (Node, Python, pnpm)
  - [x] Setup instructions (install deps, compile questions, run app)
  - [x] YAML question format documentation with examples
  - [x] Scoring system explanation with weighted selection formula
  - [x] License badge
  - [x] Testing and production build instructions
- [x] Expand `data/questions/sample.yaml` to 12 diverse, well-crafted questions
- [x] UI polish pass
  - [x] Consistent spacing, typography, and color palette (dark theme, indigo accents)
  - [x] Responsive layout (max-w containers, px-4 padding)
  - [x] Loading spinner while database initializes
  - [x] Error state with reload button
  - [x] Smooth progress bar transitions
- [x] Final verification
  - [x] Clean compile: 12 questions compiled to `questions.json`
  - [x] Clean build: `pnpm build` succeeds
  - [x] All tests pass: 61 app tests + 42 builder tests = 103 total

---

## Phase G: Tags and Category Filtering

### Story G.a: v0.15.0 Builder — Optional Tags in YAML Schema [Done]

Add optional `tags` field to the YAML question format. Existing tagless questions remain valid.

- [x] Update `builder/src/quizazz_builder/models.py`
  - [x] Add `tags: list[str] | None = None` to `Question` model
  - [x] Add `@field_validator("tags", mode="before")` to normalize tags to lowercase
  - [x] Reject empty strings in tags list
- [x] Update `builder/src/quizazz_builder/compiler.py`
  - [x] Include `tags` in compiled JSON output (as `[]` when absent)
- [x] Update `builder/tests/test_models.py`
  - [x] Test question with tags is valid
  - [x] Test question without tags is valid (backward compatible)
  - [x] Test tags are normalized to lowercase
  - [x] Test empty string in tags is rejected
  - [x] Test blank string in tags is rejected
  - [x] Test empty tags list is valid
- [x] Update `builder/tests/test_compiler.py`
  - [x] Test compiled JSON includes `tags` array
  - [x] Test compiled JSON has empty `tags` array when no tags provided
- [x] Verify: 50 builder tests pass (`pytest`)

### Story G.b: v0.16.0 App — Types, Engine, and Data for Tags [Done]

Update TypeScript types, selection engine, and lifecycle to support tag filtering.

- [x] Update `app/src/lib/types/index.ts`
  - [x] Add `tags: string[]` to `Question` interface
  - [x] Add `selectedTags: string[]` to `QuizConfig` interface
- [x] Update `app/src/lib/data/index.ts`
  - [x] Export `allTags` — a sorted, deduplicated list of all tags across all questions
- [x] Update `app/src/lib/engine/selection.ts`
  - [x] Accept optional `selectedTags` parameter; pre-filter pool with OR logic
- [x] Update `app/src/lib/engine/lifecycle.ts`
  - [x] Pass `config.selectedTags` through to `selectQuestions`
- [x] Update `app/src/routes/+page.svelte`
  - [x] `handleStart` accepts and passes `selectedTags`
- [x] Update all test fixtures to include `tags: []` and `selectedTags: []`
- [x] Add 4 new tag filtering tests in `app/tests/engine/selection.test.ts`
- [x] Verify: 65 tests pass (`pnpm vitest run`), `pnpm check` — 0 errors

### Story G.c: v0.17.0 App — ConfigView Tag Filter UI [Done]

Add tag filter controls to the configuration screen.

- [x] Update `app/src/lib/components/ConfigView.svelte`
  - [x] Accept `questions` and `allTags` props (replaces `maxQuestions`)
  - [x] Display all available tags as toggleable rounded chips
  - [x] Selected tags highlighted with indigo border/background
  - [x] "N of M questions available" updates dynamically as tags are toggled
  - [x] Question count slider max adjusts to filtered pool size
  - [x] "Start Quiz" button disabled if filtered pool is empty (shows "No questions match selected tags")
  - [x] "Clear all" link appears when tags are selected
  - [x] `$derived` filteredCount with OR-logic filtering
- [x] Update `app/src/routes/+page.svelte`
  - [x] Import `allTags` from `$lib/data`
  - [x] Pass `questions` and `allTags` to ConfigView
  - [x] `handleStart` forwards `selectedTags`
- [x] Verify: 65 tests pass, `pnpm check` — 0 errors

### Story G.d: v0.18.0 Sample Data, README, and Tests [Done]

Add tags to sample questions, update documentation, and add integration tests.

- [x] Update `data/questions/sample.yaml`
  - [x] Add `tags` to all 12 questions with 5 distinct tags: `geography`, `science`, `technology`, `history`, `literature`, `math`
  - [x] Questions share tags where topically appropriate; some have multiple tags
- [x] Recompile `app/src/lib/data/questions.json` — 12 questions with tags
- [x] Update root `README.md`
  - [x] Add `tags` to YAML format example and requirements
  - [x] Add "Tag filtering" to features list
  - [x] Document tag filtering in "Taking a Quiz" section with OR-logic explanation
  - [x] Update test counts
- [x] Add integration tests (`app/tests/integration/tags.test.ts`)
  - [x] Test quiz with tag filter selects only matching questions
  - [x] Test OR logic: questions matching any selected tag are included
  - [x] Test quiz with no tag filter selects from all questions
  - [x] Test tag filter with no matching questions results in 0 questions
  - [x] Test `allTags` derivation: sorted, deduplicated, no empty strings
- [x] Final verification
  - [x] Clean compile: 12 tagged questions
  - [x] Clean build: `pnpm build` succeeds
  - [x] All tests pass: 71 app tests + 50 builder tests = 121 total

---

## Phase H: Question Navigation and UI Improvements

### Story H.a: v0.19.0 ReviewView — Escape Hotkey and Carousel Navigation [Done]

Improve post-quiz review navigation: change "Back to Summary" hotkey from `←`/`Backspace` to `Escape`, and add carousel buttons to navigate between reviewed questions.

- [x] Update `app/src/lib/components/ReviewView.svelte`
  - [x] Change hotkey from `ArrowLeft`/`Backspace` to `Escape` for "Back to Summary"
  - [x] Add `←` / `→` carousel buttons below the question card (ChevronLeft/ChevronRight icons)
  - [x] `←` disabled on first question, `→` disabled on last question (opacity-30)
  - [x] Show "N of M" position indicator between carousel buttons
  - [x] `ArrowLeft` / `ArrowRight` keyboard shortcuts for prev/next question
- [x] Update `app/src/lib/components/ReviewView.svelte` props
  - [x] Accept `currentIndex`, `totalQuestions`, `onPrev`, `onNext` props
- [x] Update `app/src/lib/engine/lifecycle.ts`
  - [x] Add `reviewPrev()` — decrements `reviewIndex` (clamped to 0)
  - [x] Add `reviewNext()` — increments `reviewIndex` (clamped to last index)
- [x] Update `app/src/routes/+page.svelte`
  - [x] Wire `onPrev` / `onNext` to `reviewPrev` / `reviewNext`
  - [x] Pass `currentIndex` and `totalQuestions` to ReviewView
- [x] Add 4 lifecycle tests for `reviewPrev` / `reviewNext` with boundary clamping
- [x] Verify: 75 tests pass (`pnpm vitest run`), `pnpm check` — 0 errors

### Story H.b: v0.20.0 QuizView — Mid-Quiz Navigation to Answered Questions [Done]

Allow navigating back to previously answered questions during a quiz, with `Escape` to return to the current unanswered question.

- [x] Add `quiz-answered` and `quiz-review` to `ViewMode` type in `app/src/lib/stores/quiz.ts`
- [x] Update `app/src/lib/engine/lifecycle.ts`
  - [x] Add `showAnsweredQuestions()` — sets `viewMode` to `quiz-answered`
  - [x] Add `reviewAnsweredQuestion(index)` — sets `viewMode` to `quiz-review` with guard (index < currentIndex)
  - [x] Add `backToQuiz()` — restores `quiz` view mode, clears `reviewIndex`
  - [x] `reviewNext()` scoped to answered questions in `quiz-review` mode
- [x] Update `app/src/lib/components/QuizView.svelte`
  - [x] Add "← Back to Answered Questions" link (visible when `hasAnswered`)
  - [x] `Escape` key triggers `onShowAnswered` when questions have been answered
- [x] Create `app/src/lib/components/AnsweredQuestionsView.svelte`
  - [x] Show list of answered questions with correct/incorrect indicators
  - [x] "N of M answered — currently on question N" status text
  - [x] Click a question to review it (enters `quiz-review` mode)
  - [x] `Escape` key and "Return to Quiz" button return to current unanswered question
- [x] Reuse `ReviewView` for `quiz-review` mode
  - [x] `Escape` returns to answered questions index (not summary)
  - [x] Carousel scoped to answered questions only (`reviewNext` clamps at `currentIndex - 1`)
- [x] Update `app/src/routes/+page.svelte`
  - [x] Handle `quiz-answered` and `quiz-review` view modes
  - [x] Wire all new lifecycle functions
- [x] Add 7 mid-quiz navigation tests in `app/tests/integration/lifecycle.test.ts`
- [x] Verify: 82 tests pass (`pnpm vitest run`), `pnpm check` — 0 errors

### Story H.c: v0.21.0 Polish, README, and Final Tests [Done]

Final polish, documentation, and comprehensive test coverage for navigation features.

- [x] Update root `README.md`
  - [x] Add "Mid-quiz review" and updated "Review mode" to features list
  - [x] Add "Keyboard Shortcuts" table: `a`–`e`, `Enter`, `Escape`, `←`/`→`
  - [x] Update "Taking a Quiz" section with mid-quiz review step
  - [x] Update test counts
- [x] Add full-flow integration test in `app/tests/integration/lifecycle.test.ts`
  - [x] Test: answer → go back → review answered → carousel → return to quiz → continue → summary → post-quiz review
- [x] Final verification
  - [x] Clean build: `pnpm build` succeeds
  - [x] `pnpm check` — 0 errors
  - [x] All tests pass: 83 app tests + 50 builder tests = 133 total

---

## Phase I: Multi-Quiz Builder

Migrate the builder to support the new `QuizFile` YAML format (with metadata and subtopics), generate a navigation manifest per quiz, and enhance the CLI for single-quiz and batch compilation. See [`multi_quiz_features.md`](multi_quiz_features.md) for design rationale.

### Story I.a: v0.22.0 QuizFile and SubtopicGroup Pydantic Models [Done]

Replace `QuestionBank` with `QuizFile` and add `SubtopicGroup` to support the new YAML format.

- [x] Update `builder/src/quizazz_builder/models.py`
  - [x] Add `SubtopicGroup` model: `subtopic: str` (non-empty), `questions: list[Question]` (>= 1)
  - [x] Add `QuizFile` model: `menu_name: str` (non-empty), `menu_description: str = ""`, `quiz_description: str = ""`, `questions: list[Question | SubtopicGroup]`
  - [x] Add `QuizFile` model validator: file must contain at least one question (directly or via subtopics)
  - [x] Remove `QuestionBank` (or deprecate with alias)
- [x] Update `builder/tests/test_models.py`
  - [x] Test valid `QuizFile` with bare questions only
  - [x] Test valid `QuizFile` with subtopic groups only
  - [x] Test valid `QuizFile` with mixed bare questions and subtopic groups
  - [x] Test `QuizFile` with empty `menu_name` raises error
  - [x] Test `QuizFile` with no questions raises error
  - [x] Test `SubtopicGroup` with empty `subtopic` raises error
  - [x] Test `SubtopicGroup` with empty questions list raises error
  - [x] Test `menu_description` and `quiz_description` default to empty string
- [x] Verify: `pytest` passes in `builder/` — 64 passed (40 model + 24 others)

### Story I.b: v0.23.0 Validator — QuizFile Format and Recursive Directory [Done]

Update the validator to parse the new `QuizFile` format and support recursive directory traversal.

- [x] Update `builder/src/quizazz_builder/validator.py`
  - [x] `validate_file(path: Path) -> QuizFile` — parse YAML as `QuizFile` model (breaking change from `list[Question]`)
  - [x] `validate_quiz_directory(quiz_dir: Path) -> list[tuple[Path, QuizFile]]` — recursively validate all `.yaml` files, return `(relative_path, QuizFile)` tuples preserving hierarchy
  - [x] Keep `validate_directory()` as a thin wrapper (backward-compatible, deprecated)
  - [x] Error messages include file path and validation details
- [x] Update `builder/tests/test_validator.py`
  - [x] Test valid `QuizFile` YAML parses correctly
  - [x] Test YAML with subtopic groups validates
  - [x] Test YAML with mixed bare + subtopic questions validates
  - [x] Test YAML missing `menu_name` fails with clear error
  - [x] Test YAML with old bare-list format fails (migration required)
  - [x] Test recursive directory validation returns correct relative paths
  - [x] Test nested subdirectories are traversed
  - [x] Test empty directory raises error
- [x] Verify: `pytest` passes in `builder/` — 71 passed (40 model + 20 validator + 11 compiler)

### Story I.c: v0.24.0 Manifest Generation [Done]

Build the navigation tree structure from validated quiz files and directory hierarchy.

- [x] Create `builder/src/quizazz_builder/manifest.py`
  - [x] `build_navigation_tree(validated_files: list[tuple[Path, QuizFile]]) -> list[dict]` — build nested tree from directory structure, file metadata, and subtopics
  - [x] Directory nodes: `type: "directory"`, `id` from relative path, `label` from directory name, `questionIds` aggregated from children
  - [x] Topic nodes: `type: "topic"`, `id` from relative file path (without extension), `label` from `menu_name`, `description` from `menu_description`, `questionIds` from all questions in the file
  - [x] Subtopic nodes: `type: "subtopic"`, `id` from `{topic_id}/{subtopic_slug}`, `label` from `subtopic` field, `questionIds` from subtopic's questions
  - [x] Question IDs use the existing SHA-256 hash of question text
- [x] Create `builder/tests/test_manifest.py`
  - [x] Test single file at root → single topic node, no directory nodes
  - [x] Test file with subtopics → topic node with subtopic children
  - [x] Test files in subdirectory → directory node wrapping topic nodes
  - [x] Test nested subdirectories → nested directory nodes
  - [x] Test `questionIds` at each node are correct and aggregated upward
  - [x] Test mixed bare + subtopic questions in same file
- [x] Verify: `pytest` passes in `builder/` — 80 passed (40 model + 20 validator + 11 compiler + 9 manifest)
- [x] Bonus: renamed `_question_id` → `question_id` (public) in compiler for shared use by manifest module

### Story I.d: v0.25.0 Compiler — Manifest JSON Output [Done]

Update the compiler to produce a `manifest.json` per quiz containing the navigation tree and all compiled questions.

- [x] Update `builder/src/quizazz_builder/compiler.py`
  - [x] `compile_quiz(validated_files: list[tuple[Path, QuizFile]], quiz_name: str, output_dir: Path) -> None`
  - [x] Generate `manifest.json` with `quizName`, `tree` (from `build_navigation_tree`), and `questions` (flat list with `topicId` and `subtopic` fields)
  - [x] Each question includes `topicId` (relative file path without extension) and `subtopic` (name or `null`)
  - [x] Stable question IDs (SHA-256 of question text, unchanged)
  - [x] Flatten categorized answers with `category` field (unchanged)
  - [x] Deprecate `compile_questions()` (kept for backward compatibility)
- [x] Update `builder/tests/test_compiler.py`
  - [x] Test manifest JSON structure: `quizName`, `tree`, `questions` keys present
  - [x] Test questions include `topicId` and `subtopic` fields
  - [x] Test stable IDs unchanged from previous behavior
  - [x] Test category flattening unchanged
  - [x] Test manifest `tree` matches expected navigation structure
  - [x] Test output written to correct directory
  - [x] Test mixed bare + subtopic questions
- [x] Verify: `pytest` passes in `builder/` — 88 passed (40 model + 20 validator + 19 compiler + 9 manifest)

### Story I.e: v0.26.0 CLI — Single Quiz and Batch Modes [Done]

Enhance the CLI to support building a single quiz or all quizzes in batch.

- [x] Update `builder/src/quizazz_builder/__main__.py`
  - [x] Single quiz mode: `python -m quizazz_builder --input data/quiz/ --output app/build/quiz/`
    - [x] `--input` is a quiz directory (contains `.yaml` files)
    - [x] `--output` is the target directory for `manifest.json`
  - [x] Batch mode: `python -m quizazz_builder --all --input data/ --output app/build/`
    - [x] Each immediate subdirectory of `--input` is treated as a separate quiz
    - [x] Each quiz compiled to `--output/{quiz_name}/manifest.json`
  - [x] `--all` flag errors if `--input` is not a directory
  - [x] Print summary: "Compiled N questions in M topics for quiz '{name}' to {output_dir}"
  - [x] Exit 0 on success, exit 1 with descriptive error on validation failure
- [x] Verify: single quiz mode produces valid `manifest.json`
- [x] Verify: batch mode compiles all quiz directories
- [x] Verify: `pytest` passes in `builder/` — 88 passed (unchanged)

### Story I.f: v0.27.0 Migrate Sample Data and Builder Tests [Done]

Migrate existing sample data to the new `QuizFile` format and create multi-quiz sample structure.

- [x] Create `data/quiz/sample.yaml` — migrated from old bare-list format
  - [x] Wrapped in `QuizFile` format with `menu_name`, `menu_description`, `quiz_description`
  - [x] Grouped questions into subtopics: Science (4), Technology (5), plus 3 bare questions
- [x] Create `data/quiz/advanced/advanced_sample.yaml` — new harder questions
  - [x] 7 questions across 3 subtopics: Algorithms & Complexity, Physics, History of Computing
  - [x] Demonstrates nested directory structure within a quiz
- [x] Multi-quiz data layout: `data/quiz/` (default) + `data/aws-ml-specialty-exam/` (user-managed)
- [x] Compile `data/quiz/` → `app/src/lib/data/manifest.json` — 19 questions, 2 topics
- [x] Navigation tree verified: directory node (advanced/) + topic nodes + subtopic nodes
- [x] Verify: `pytest` passes in `builder/` — 88 passed, all green

---

## Phase J: Multi-Quiz App

Update the SvelteKit app to load quiz data from the manifest, display a navigation tree with mastery scores, scope question selection to selected topics/subtopics, and isolate databases per quiz.

### Story J.a: v0.28.0 TypeScript Types and Manifest Import [Done]

Define new types and wire up the manifest JSON for the app.

- [x] Update `app/src/lib/types/index.ts`
  - [x] Add `topicId: string` and `subtopic: string | null` to `Question`
  - [x] Add `NavNode` interface: `id`, `label`, `description`, `type`, `questionIds`, `children`
  - [x] Add `NavNodeType` type: `'directory' | 'topic' | 'subtopic'`
  - [x] Add `QuizManifest` interface: `quizName`, `tree`, `questions`
  - [x] Add `selectedNodeIds: string[]` to `QuizConfig`
- [x] Update `app/src/lib/data/index.ts`
  - [x] Import `manifest.json` instead of `questions.json`
  - [x] Export typed `manifest: QuizManifest`, `questions: Question[]`, `allTags: string[]`, `navTree: NavNode[]`
- [x] Update all test files to include new required fields (`topicId`, `subtopic`, `selectedNodeIds`)
- [x] Verify: `pnpm check` — 0 errors, 1 pre-existing warning

### Story J.b: v0.29.0 Mastery Score Computation [Done]

Add runtime mastery score aggregation for navigation tree display.

- [x] Create `app/src/lib/engine/mastery.ts`
  - [x] `MasteryScore` interface: `total`, `positive`, `percent`
  - [x] `computeMastery(questionIds: string[], scores: QuestionScore[]) -> MasteryScore`
  - [x] Mastery = percentage of questions with `cumulative_score > 0`
- [x] Create `app/tests/engine/mastery.test.ts`
  - [x] Test all scores zero → 0% mastery
  - [x] Test all scores positive → 100% mastery
  - [x] Test mixed scores → correct percentage
  - [x] Test empty questionIds → 0 total, 0%
  - [x] Test negative scores count as not mastered
  - [x] Test missing scores treated as zero
  - [x] Test rounding (1/3 → 33%)
- [x] Verify: `pnpm vitest run` — 90 passed (9 test files)

### Story J.c: v0.30.0 Database Isolation Per Quiz [Done]

Make the IndexedDB database name dynamic, keyed by quiz name.

- [x] Update `app/src/lib/db/database.ts`
  - [x] `getDbName(quizName: string): string` — returns `"quizazz-{quizName}"`
  - [x] `initDatabase(quizName: string)` — use `getDbName` for IndexedDB name
  - [x] `persistDatabase(db, quizName)` — use `getDbName` for IndexedDB name
  - [x] Schema unchanged (`question_scores`, `session_answers`)
- [x] Update all callers of `initDatabase` and `persistDatabase` to pass `quizName`
  - [x] `app/src/routes/+page.svelte` — get `quizName` from `manifest`
  - [x] `app/src/lib/engine/lifecycle.ts` — `startQuiz` accepts `quizName`, stores in `activeQuizName`, passes to `persistDatabase`
- [x] Update `app/tests/db/scores.test.ts`
  - [x] Test `getDbName` returns quiz-specific name
  - [x] Test different quizzes produce different DB names
  - [x] Test same quiz produces consistent DB name
- [x] Verify: `pnpm vitest run` — 93 passed, `pnpm check` — 0 errors

### Story J.d: v0.31.0 Navigation Tree Component [Done]

Build the navigation tree UI with topic/subtopic selection and mastery scores.

- [x] Create `app/src/lib/components/NavigationTree.svelte`
  - [x] Render tree from `NavNode[]` recursively using Svelte 5 snippets
  - [x] Directory nodes: expandable/collapsible with chevron toggle
  - [x] Topic nodes: show `label`, `description`, mastery percentage badge
  - [x] Subtopic nodes: show `label`, mastery percentage badge
  - [x] Checkbox selection: select/deselect nodes (parent selects all children, children auto-check parent)
  - [x] "Select All" / "Clear" controls
  - [x] "Continue" button (disabled if no nodes selected) shows selected question count
  - [x] Icons: FolderOpen (directory), FileText (topic), List (subtopic)
  - [x] Mastery badges: green (≥80%), amber (≥40%), gray (<40%)
  - [x] Clean, minimal styling consistent with existing dark UI
- [x] Update `app/src/lib/stores/quiz.ts`
  - [x] Add `"nav"` to `ViewMode` type
  - [x] Default `viewMode` to `"nav"`
- [x] Verify: `pnpm check` — 0 errors, `pnpm vitest run` — 93 passed

### Story J.e: v0.32.0 Wire Navigation Tree into Quiz Flow [Done]

Integrate the navigation tree into the quiz lifecycle and page routing.

- [x] Update `app/src/routes/+page.svelte`
  - [x] Show `NavigationTree` when `viewMode === "nav"`
  - [x] Pass `navTree`, `scores` to NavigationTree
  - [x] On "Continue": transition to `"config"` view with selected node IDs, pre-filter questions
  - [x] Pass filtered question pool and derived tags to ConfigView
  - [x] Call `setNavNodes(navTree)` on mount for lifecycle filtering
- [x] Update `app/src/lib/engine/lifecycle.ts`
  - [x] Add `setNavNodes`, `collectQuestionIds`, `filterByNodeIds` helpers
  - [x] `startQuiz` filters questions by `selectedNodeIds` via nav tree before weighted selection
  - [x] `newQuiz()` and `quitQuiz()` return to `"nav"` view (not `"config"`)
- [x] Update `app/src/lib/engine/selection.ts`
  - [x] No change needed — caller pre-filters question pool
- [x] Update `app/src/lib/components/ConfigView.svelte`
  - [x] Accept pre-filtered question pool from navigation selection
  - [x] Optional `onBack` prop with "← Topics" back button
- [x] Create `app/tests/integration/navigation.test.ts`
  - [x] Test selecting a topic scopes questions to that topic
  - [x] Test selecting a subtopic scopes questions to that subtopic
  - [x] Test selecting a directory selects all children
  - [x] Test selecting all nodes includes all questions
  - [x] Test empty selectedNodeIds uses all questions
  - [x] Test multiple non-overlapping nodes combine questions
  - [x] Test nav → config → quiz → summary → nav flow
  - [x] Test quitQuiz returns to nav
- [x] Verify: `pnpm vitest run` — 101 passed, `pnpm check` — 0 errors

### Story J.f: v0.33.0 Sample Data Migration, README, and Final Tests [Done]

Complete the migration, update documentation, and ensure full test coverage.

- [x] Compile `data/quiz/` → `app/src/lib/data/manifest.json` (19 questions, 2 topics)
- [x] Remove old `app/src/lib/data/questions.json`
- [x] Update root `README.md`
  - [x] Update project description to mention multi-quiz support, navigation tree, mastery tracking
  - [x] Update features list: multi-quiz, navigation tree, mastery tracking, per-quiz DB isolation
  - [x] Update YAML format documentation with `menu_name`, `menu_description`, and subtopic examples
  - [x] Update setup instructions: builder commands for single quiz and batch mode
  - [x] Update "Taking a Quiz" section: navigation tree → config → quiz flow
  - [x] Add "Creating a New Quiz" section
  - [x] Update test counts (101 app tests)
- [x] Final verification
  - [x] Clean compile: `python -m quizazz_builder --input data/quiz/ --output app/src/lib/data/`
  - [x] Clean build: `pnpm build` succeeds
  - [x] `pnpm check` — 0 errors
  - [x] App tests: 101 passed (10 files)
  - [x] Builder tests: 88 passed

### Story J.g: v0.34.0 Deferred Scoring, Answer Changing, and Developer Experience [Done]

Change mid-quiz review to allow changing answers instead of revealing corrections.
Scoring is deferred until the quiz is fully completed. Improve builder CLI and
local development experience.

- [x] Update `app/src/lib/engine/lifecycle.ts`
  - [x] Defer scoring: `submitAnswer` records choice only; `finalizeQuiz` scores all answers on quiz completion
  - [x] Track `frontierIndex` (furthest unanswered question) separately from `currentIndex`
  - [x] Add `editAnsweredQuestion(index)` — navigates to a previous question for re-answering
  - [x] Re-submitting an edited answer returns to the frontier
  - [x] `backToQuiz` restores `currentIndex` to frontier
  - [x] Export `getFrontierIndex()` getter
  - [x] Remove `reviewAnsweredQuestion` (replaced by `editAnsweredQuestion`)
  - [x] Remove `quiz-review` view mode references
- [x] Update `app/src/lib/components/AnsweredQuestionsView.svelte`
  - [x] Remove ✓/✗ correctness icons — show neutral numbered list
  - [x] Replace `onReview` prop with `onSelect` prop
- [x] Update `app/src/lib/components/QuizView.svelte`
  - [x] Pre-select previous answer (`submittedLabel`) when editing a question
- [x] Update `app/src/lib/stores/quiz.ts`
  - [x] Remove `quiz-review` from `ViewMode` type
- [x] Update `app/src/routes/+page.svelte`
  - [x] Replace `reviewAnsweredQuestion` with `editAnsweredQuestion`
  - [x] Remove `quiz-review` view block
  - [x] Use `getFrontierIndex()` for `hasAnswered` and answered questions slice
- [x] Update `app/tests/integration/lifecycle.test.ts`
  - [x] Replace `reviewAnsweredQuestion` tests with `editAnsweredQuestion` tests
  - [x] Add test: re-submitting edited answer returns to frontier
  - [x] Add test: scoring is deferred until quiz completion
  - [x] Rewrite full navigation flow test for edit-and-continue behavior
- [x] Add `quizazz-builder` CLI entry point
  - [x] Add `[project.scripts]` to `builder/pyproject.toml` (both `quizazz-builder` and `quizazz_builder`)
- [x] Improve builder validation error formatting
  - [x] Add `_clean_loc` — strips Pydantic union discriminator noise from error paths
  - [x] Add `_format_validation_errors` — deduplicated, one error per line
- [x] Add `serve.py` — builds app (if needed), serves locally, opens browser
- [x] Update `README.md`
  - [x] Fix `pip install` quoting for zsh
  - [x] Add "Run the Quiz" section with `python serve.py`
  - [x] Use `quizazz-builder` CLI command throughout
- [x] Verify: `pnpm vitest run` — 101 passed (10 files), `pnpm check` — 0 errors

### Story J.h: v0.35.0 Per-Question Timer [Done]

Track how long the user spends on each question. The timer starts when a question
is displayed, pauses when the user navigates away, and resumes if they return to
edit their answer. Elapsed time is stored per question and aggregated in the
summary and database, mirroring how scores are tracked today.

- [x] Add `elapsedMs` field to `QuizQuestion` type (default `0`)
- [x] Timer logic in `lifecycle.ts`
  - [x] Record `Date.now()` when a question becomes active (`startQuiz`, `submitAnswer` advancing, `editAnsweredQuestion`)
  - [x] On leaving a question (`submitAnswer`, `editAnsweredQuestion`, `showAnsweredQuestions`), accumulate elapsed time into `elapsedMs`
  - [x] Resuming an edited question resumes from its existing `elapsedMs`
- [x] Display timer in `QuizView`
  - [x] Show live elapsed time (mm:ss) while answering
  - [x] Timer counts up, no time limit
- [x] Store elapsed time in database
  - [x] Add `elapsed_ms` column to `session_answers` table
  - [x] Schema migration: detect version 0 (no `schema_version`), add column, set version to 1
  - [x] Pass `elapsedMs` through `recordAnswer` and `finalizeQuiz`
- [x] Display in `SummaryView`
  - [x] Per-question time in review list
  - [x] Total quiz time and average time per question
- [x] Display in `ReviewView`
  - [x] Show time spent on each question
- [x] Tests
  - [x] Timer accumulates across edits
  - [x] Timer resets on retake
  - [x] Schema migration from version 0 → 1
  - [x] `elapsedMs` persisted in `session_answers`
  - [x] `formatTime` utility (6 tests)
  - [x] `showAnsweredQuestions` snapshots elapsed time
- [x] Verify: `pnpm check` — 0 errors, 115 tests passed (11 files)

### Story J.i: v0.36.0 Unified `quizazz` CLI [Done]

Replace the separate `quizazz-builder` entry point and `serve.py` script with a
single `quizazz` command that handles generation, building, and serving. All
subcommands use sensible defaults so they work with zero flags from the repo root.

```
quizazz generate [--input data/quiz/] [--output app/src/lib/data/]
quizazz build    [--output app/build/]
quizazz run      [--port 8000]
```

- [x] Create `quizazz` CLI entry point (Python, installed via pip)
  - [x] `generate` subcommand — calls existing `compile_quiz` internals
    - [x] `--input` defaults to `data/quiz/`
    - [x] `--output` defaults to `app/src/lib/data/`
    - [x] `--all` batch mode carried over from `quizazz-builder`
    - [x] Output file named `{input_dir_name}.json` (not `manifest.json`)
  - [x] `build` subcommand — shells out to `pnpm --dir app build`
    - [x] `--output` defaults to `app/build/`
    - [x] Checks pnpm is available, prints helpful error if not
  - [x] `run` subcommand — serves built app and opens browser
    - [x] `--port` defaults to `8000`
    - [x] Auto-builds if `app/build/` is missing or stale
    - [x] Replaces `serve.py`
- [x] Deprecate `quizazz-builder` entry point (keep as alias, print deprecation notice)
- [x] Remove `serve.py` (functionality moved to `quizazz run`)
- [x] Rename `manifest.json` to `{quiz_name}.json` in compiler and app data layer
- [x] Update README with new CLI commands and CLI reference table
- [x] Tests (11 new CLI tests)
  - [x] `quizazz generate` produces named manifest with defaults
  - [x] `quizazz generate --input --output` overrides work
  - [x] Batch mode generates per-quiz manifests
  - [x] Invalid input exits with error
  - [x] Manifest uses folder name as filename
  - [x] `quizazz build` checks for pnpm and app directory
  - [x] `quizazz run` checks for build and pnpm
  - [x] `--version` flag works
  - [x] No subcommand exits with error
  - [x] End-to-end generate via main entry point
- [x] Verify: 99 builder tests passed, 115 app tests passed, `pnpm check` — 0 errors

### Story J.j: v0.37.0 Named Manifests and Multi-Quiz Discovery

Rename the builder output from `manifest.json` to `{quiz_name}.json` (matching
the package folder name). Update the app to discover all `.json` quiz packages
in the data directory at build time — auto-load if only one, show a chooser if
multiple.

- [ ] Builder: rename output file
  - [ ] `compile_quiz` outputs `{quiz_name}.json` instead of `manifest.json`
  - [ ] Update `--output` help text
  - [ ] Update builder tests for new filename
- [ ] App: multi-manifest data layer
  - [ ] Change `$lib/data` to export a list of available manifests (auto-discovered from `*.json` in data dir)
  - [ ] Add manifest store: reactive store holding the active `QuizManifest`
  - [ ] Derived `questions`, `navTree`, `allTags` from the active manifest
- [ ] App: quiz chooser
  - [ ] If one manifest, auto-load it (current behavior)
  - [ ] If multiple, show a chooser screen before the nav tree
  - [ ] Display quiz name and question count for each option
- [ ] Wire active manifest into quiz flow
  - [ ] Replace static imports with manifest store reads in `+page.svelte`
  - [ ] Initialize per-quiz DB using active manifest's `quizName`
  - [ ] Reset session state when switching quizzes
- [ ] Update `serve.py` and README for new filename convention
- [ ] Tests
  - [ ] Builder outputs `{quiz_name}.json`
  - [ ] Single manifest auto-loads
  - [ ] Multiple manifests show chooser
  - [ ] Switching quizzes resets session and DB
- [ ] Verify: `pnpm check` — 0 errors, all tests pass

### Story J.k: v0.38.0 Upload Custom Quiz Package

Allow the user to upload a compiled `.json` quiz package at runtime instead of
using the baked-in data. This lets anyone run a custom quiz without rebuilding
the app — just compile YAML with `quizazz-builder` and upload the resulting file.

- [ ] Add `QuizManifest` validation utility
  - [ ] Validate shape: `quizName` (string), `tree` (NavNode[]), `questions` (Question[])
  - [ ] Return typed errors for malformed files
- [ ] Upload UI on nav/chooser screen
  - [ ] File input accepting `.json` files
  - [ ] Drag-and-drop zone as alternative
  - [ ] Show upload errors inline
  - [ ] Uploaded quiz appears alongside built-in quizzes
- [ ] Wire uploaded manifest into quiz flow
  - [ ] Initialize per-quiz DB using uploaded `quizName`
  - [ ] Reset session state when loading uploaded quiz
- [ ] "Remove uploaded quiz" option
- [ ] Tests
  - [ ] Valid upload adds quiz to chooser
  - [ ] Invalid JSON shows error
  - [ ] Missing fields show validation error
  - [ ] Quiz flow works end-to-end with uploaded manifest
- [ ] Verify: `pnpm check` — 0 errors, all tests pass
