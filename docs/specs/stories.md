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

### Story I.c: v0.24.0 Manifest Generation [Planned]

Build the navigation tree structure from validated quiz files and directory hierarchy.

- [ ] Create `builder/src/quizazz_builder/manifest.py`
  - [ ] `build_navigation_tree(validated_files: list[tuple[Path, QuizFile]]) -> list[dict]` — build nested tree from directory structure, file metadata, and subtopics
  - [ ] Directory nodes: `type: "directory"`, `id` from relative path, `label` from directory name, `questionIds` aggregated from children
  - [ ] Topic nodes: `type: "topic"`, `id` from relative file path (without extension), `label` from `menu_name`, `description` from `menu_description`, `questionIds` from all questions in the file
  - [ ] Subtopic nodes: `type: "subtopic"`, `id` from `{topic_id}/{subtopic_slug}`, `label` from `subtopic` field, `questionIds` from subtopic's questions
  - [ ] Question IDs use the existing SHA-256 hash of question text
- [ ] Create `builder/tests/test_manifest.py`
  - [ ] Test single file at root → single topic node, no directory nodes
  - [ ] Test file with subtopics → topic node with subtopic children
  - [ ] Test files in subdirectory → directory node wrapping topic nodes
  - [ ] Test nested subdirectories → nested directory nodes
  - [ ] Test `questionIds` at each node are correct and aggregated upward
  - [ ] Test mixed bare + subtopic questions in same file
- [ ] Verify: `pytest` passes in `builder/`

### Story I.d: v0.25.0 Compiler — Manifest JSON Output [Planned]

Update the compiler to produce a `manifest.json` per quiz containing the navigation tree and all compiled questions.

- [ ] Update `builder/src/quizazz_builder/compiler.py`
  - [ ] `compile_quiz(validated_files: list[tuple[Path, QuizFile]], quiz_name: str, output_dir: Path) -> None`
  - [ ] Generate `manifest.json` with `quizName`, `tree` (from `build_navigation_tree`), and `questions` (flat list with `topicId` and `subtopic` fields)
  - [ ] Each question includes `topicId` (relative file path without extension) and `subtopic` (name or `null`)
  - [ ] Stable question IDs (SHA-256 of question text, unchanged)
  - [ ] Flatten categorized answers with `category` field (unchanged)
  - [ ] Remove or deprecate `compile_questions()` (old single-file output)
- [ ] Update `builder/tests/test_compiler.py`
  - [ ] Test manifest JSON structure: `quizName`, `tree`, `questions` keys present
  - [ ] Test questions include `topicId` and `subtopic` fields
  - [ ] Test stable IDs unchanged from previous behavior
  - [ ] Test category flattening unchanged
  - [ ] Test manifest `tree` matches expected navigation structure
  - [ ] Test output written to correct directory
- [ ] Verify: `pytest` passes in `builder/`

### Story I.e: v0.26.0 CLI — Single Quiz and Batch Modes [Planned]

Enhance the CLI to support building a single quiz or all quizzes in batch.

- [ ] Update `builder/src/quizazz_builder/__main__.py`
  - [ ] Single quiz mode: `python -m quizazz_builder --input data/quiz/ --output app/build/quiz/`
    - [ ] `--input` is a quiz directory (contains `.yaml` files)
    - [ ] `--output` is the target directory for `manifest.json`
  - [ ] Batch mode: `python -m quizazz_builder --all --input data/ --output app/build/`
    - [ ] Each immediate subdirectory of `--input` is treated as a separate quiz
    - [ ] Each quiz compiled to `--output/{quiz_name}/manifest.json`
  - [ ] `--all` flag is mutually exclusive with single-quiz mode (error if `--input` points to a file)
  - [ ] Print summary: "Compiled N questions in M topics for quiz '{name}' to {output_dir}"
  - [ ] Exit 0 on success, exit 1 with descriptive error on validation failure
- [ ] Verify: `python -m quizazz_builder --input data/quiz/ --output app/build/quiz/` produces valid `manifest.json`
- [ ] Verify: `python -m quizazz_builder --all --input data/ --output app/build/` compiles all quiz directories

### Story I.f: v0.27.0 Migrate Sample Data and Builder Tests [Planned]

Migrate existing sample data to the new `QuizFile` format and update all builder tests.

- [ ] Migrate `data/questions/sample.yaml` → `data/quiz/sample.yaml`
  - [ ] Wrap existing questions in `QuizFile` format with `menu_name`, `menu_description`, `quiz_description`
  - [ ] Optionally group some questions under subtopics to demonstrate the feature
- [ ] Rename `data/questions/` → `data/quiz/` (or create `data/quiz/` and move files)
- [ ] Update `.gitkeep` / `.gitignore` as needed
- [ ] Run full builder test suite — all tests pass with new format
- [ ] Compile `data/quiz/` → `app/src/lib/data/manifest.json` (temporary location until app is updated)
- [ ] Verify: `pytest` passes in `builder/`, all new and existing tests green

---

## Phase J: Multi-Quiz App

Update the SvelteKit app to load quiz data from the manifest, display a navigation tree with mastery scores, scope question selection to selected topics/subtopics, and isolate databases per quiz.

### Story J.a: v0.28.0 TypeScript Types and Manifest Import [Planned]

Define new types and wire up the manifest JSON for the app.

- [ ] Update `app/src/lib/types/index.ts`
  - [ ] Add `topicId: string` and `subtopic: string | null` to `Question`
  - [ ] Add `NavNode` interface: `id`, `label`, `description`, `type`, `questionIds`, `children`
  - [ ] Add `QuizManifest` interface: `quizName`, `tree`, `questions`
  - [ ] Add `selectedNodeIds: string[]` to `QuizConfig`
- [ ] Update `app/src/lib/data/index.ts`
  - [ ] Import `manifest.json` instead of `questions.json`
  - [ ] Export typed `manifest: QuizManifest`, `questions: Question[]`, `allTags: string[]`, `navTree: NavNode[]`
- [ ] Verify: `pnpm check` — 0 errors

### Story J.b: v0.29.0 Mastery Score Computation [Planned]

Add runtime mastery score aggregation for navigation tree display.

- [ ] Create `app/src/lib/engine/mastery.ts`
  - [ ] `MasteryScore` interface: `total`, `positive`, `percent`
  - [ ] `computeMastery(questionIds: string[], scores: QuestionScore[]) -> MasteryScore`
  - [ ] Mastery = percentage of questions with `cumulative_score > 0`
- [ ] Create `app/tests/engine/mastery.test.ts`
  - [ ] Test all scores zero → 0% mastery
  - [ ] Test all scores positive → 100% mastery
  - [ ] Test mixed scores → correct percentage
  - [ ] Test empty questionIds → 0 total, 0%
  - [ ] Test negative scores count as not mastered
- [ ] Verify: `pnpm vitest run` passes

### Story J.c: v0.30.0 Database Isolation Per Quiz [Planned]

Make the IndexedDB database name dynamic, keyed by quiz name.

- [ ] Update `app/src/lib/db/database.ts`
  - [ ] `getDbName(quizName: string): string` — returns `"quizazz-{quizName}"`
  - [ ] `initDatabase(quizName: string)` — use `getDbName` for IndexedDB name
  - [ ] `persistDatabase(db, quizName)` — use `getDbName` for IndexedDB name
  - [ ] Schema unchanged (`question_scores`, `session_answers`)
- [ ] Update all callers of `initDatabase` and `persistDatabase` to pass `quizName`
  - [ ] `app/src/routes/+page.svelte` — get `quizName` from manifest
  - [ ] `app/src/lib/engine/lifecycle.ts` — pass `quizName` through where needed
- [ ] Update `app/tests/db/scores.test.ts`
  - [ ] Test database initialization with different quiz names produces isolated databases
- [ ] Verify: `pnpm vitest run` passes, `pnpm check` — 0 errors

### Story J.d: v0.31.0 Navigation Tree Component [Planned]

Build the navigation tree UI with topic/subtopic selection and mastery scores.

- [ ] Create `app/src/lib/components/NavigationTree.svelte`
  - [ ] Render tree from `NavNode[]` recursively
  - [ ] Directory nodes: expandable/collapsible groups
  - [ ] Topic nodes: show `label`, `description`, mastery percentage
  - [ ] Subtopic nodes: show `label`, mastery percentage
  - [ ] Checkbox selection: select/deselect nodes (selecting a parent selects all children)
  - [ ] "Select All" / "Clear" controls
  - [ ] "Continue" button (disabled if no nodes selected) → proceeds to ConfigView
  - [ ] Clean, minimal styling consistent with existing UI
- [ ] Update `app/src/lib/stores/quiz.ts`
  - [ ] Add `"nav"` to `ViewMode` type (already added in tech_spec)
  - [ ] Default `viewMode` to `"nav"`
- [ ] Verify: `pnpm check` — 0 errors

### Story J.e: v0.32.0 Wire Navigation Tree into Quiz Flow [Planned]

Integrate the navigation tree into the quiz lifecycle and page routing.

- [ ] Update `app/src/routes/+page.svelte`
  - [ ] Show `NavigationTree` when `viewMode === "nav"`
  - [ ] Pass `navTree`, `scores` to NavigationTree
  - [ ] On "Continue": transition to `"config"` view with selected node IDs
  - [ ] Pass selected question pool (filtered by node IDs) to ConfigView
- [ ] Update `app/src/lib/engine/lifecycle.ts`
  - [ ] `startQuiz` receives `selectedNodeIds` in config; filters questions by selected nodes before weighted selection
  - [ ] `newQuiz()` and `quitQuiz()` return to `"nav"` view (not `"config"`)
- [ ] Update `app/src/lib/engine/selection.ts`
  - [ ] Accept question pool already scoped by navigation selection (no change needed if caller pre-filters)
- [ ] Update `app/src/lib/components/ConfigView.svelte`
  - [ ] Accept pre-filtered question pool from navigation selection
  - [ ] "← Back" button returns to navigation tree
- [ ] Create `app/tests/integration/navigation.test.ts`
  - [ ] Test selecting a topic scopes questions to that topic
  - [ ] Test selecting a subtopic scopes questions to that subtopic
  - [ ] Test selecting a directory selects all children
  - [ ] Test selecting all nodes includes all questions
  - [ ] Test nav → config → quiz → summary → nav flow
- [ ] Verify: `pnpm vitest run` passes, `pnpm check` — 0 errors

### Story J.f: v0.33.0 Sample Data Migration, README, and Final Tests [Planned]

Complete the migration, update documentation, and ensure full test coverage.

- [ ] Compile `data/quiz/` → `app/src/lib/data/manifest.json` (final location)
- [ ] Remove old `app/src/lib/data/questions.json` if still present
- [ ] Update root `README.md`
  - [ ] Update project description to mention multi-quiz support
  - [ ] Update YAML format documentation with `menu_name`, `menu_description`, `quiz_description`, and subtopic examples
  - [ ] Update setup instructions: builder commands for single quiz and batch mode
  - [ ] Update "Taking a Quiz" section: navigation tree → config → quiz flow
  - [ ] Add "Creating a New Quiz" section
  - [ ] Update test counts
- [ ] Final verification
  - [ ] Clean compile: `python -m quizazz_builder --input data/quiz/ --output app/build/quiz/`
  - [ ] Clean build: `pnpm build` succeeds
  - [ ] `pnpm check` — 0 errors
  - [ ] All tests pass (app + builder)
