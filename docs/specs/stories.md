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

### Story G.a: v0.15.0 Builder — Optional Tags in YAML Schema [Planned]

Add optional `tags` field to the YAML question format. Existing tagless questions remain valid.

- [ ] Update `builder/src/quizazz_builder/models.py`
  - [ ] Add `tags: list[str] | None = None` to `Question` model
  - [ ] Add `@field_validator("tags", mode="before")` to normalize tags to lowercase
  - [ ] Reject empty strings in tags list
- [ ] Update `builder/src/quizazz_builder/compiler.py`
  - [ ] Include `tags` in compiled JSON output (as `[]` when absent)
- [ ] Update `builder/tests/test_models.py`
  - [ ] Test question with tags is valid
  - [ ] Test question without tags is valid (backward compatible)
  - [ ] Test tags are normalized to lowercase
  - [ ] Test empty string in tags is rejected
  - [ ] Test empty tags list is valid
- [ ] Update `builder/tests/test_compiler.py`
  - [ ] Test compiled JSON includes `tags` array
  - [ ] Test compiled JSON has empty `tags` array when no tags provided
- [ ] Verify: `pytest` passes in `builder/`

### Story G.b: v0.16.0 App — Types, Engine, and Data for Tags [Planned]

Update TypeScript types, selection engine, and lifecycle to support tag filtering.

- [ ] Update `app/src/lib/types/index.ts`
  - [ ] Add `tags: string[]` to `Question` interface
  - [ ] Add `selectedTags: string[]` to `QuizConfig` interface
- [ ] Update `app/src/lib/data/index.ts`
  - [ ] Export `allTags` — a sorted, deduplicated list of all tags across all questions
- [ ] Update `app/src/lib/engine/selection.ts`
  - [ ] Accept optional tag filter; when non-empty, pre-filter question pool to those matching any selected tag (OR logic)
- [ ] Update `app/src/lib/engine/lifecycle.ts`
  - [ ] Pass `selectedTags` from config through to selection
- [ ] Update `app/tests/engine/selection.test.ts`
  - [ ] Test tag filtering returns only matching questions
  - [ ] Test empty tag filter returns all questions
  - [ ] Test OR logic: question matching any selected tag is included
  - [ ] Test question with no tags is excluded when tags are active
- [ ] Verify: `pnpm vitest run` and `pnpm check` pass

### Story G.c: v0.17.0 App — ConfigView Tag Filter UI [Planned]

Add tag filter controls to the configuration screen.

- [ ] Update `app/src/lib/components/ConfigView.svelte`
  - [ ] Display all available tags as toggleable chips/buttons
  - [ ] Selected tags are visually highlighted (indigo, matching existing style)
  - [ ] "All" state when no tags selected (show total question count)
  - [ ] Filtered question count updates dynamically as tags are toggled
  - [ ] Question count slider max adjusts to filtered pool size
  - [ ] "Start Quiz" button disabled if filtered pool is empty
  - [ ] Clear all tags button/link
- [ ] Update `app/src/routes/+page.svelte`
  - [ ] Pass `allTags` and handle `selectedTags` in `handleStart`
- [ ] Verify: app loads, tag filter works, slider adjusts, quiz starts with filtered pool

### Story G.d: v0.18.0 Sample Data, README, and Tests [Planned]

Add tags to sample questions, update documentation, and add integration tests.

- [ ] Update `data/questions/sample.yaml`
  - [ ] Add `tags` to all 12 questions with diverse, meaningful tags
  - [ ] Use at least 4–5 distinct tags (e.g., `geography`, `science`, `technology`, `literature`, `math`)
  - [ ] Some questions should share tags; some should have multiple tags
- [ ] Recompile `app/src/lib/data/questions.json`
- [ ] Update root `README.md`
  - [ ] Add `tags` to the YAML format example
  - [ ] Document tag filtering behavior in the "Taking a Quiz" section
- [ ] Add integration tests (`app/tests/integration/`)
  - [ ] Test quiz with tag filter selects only matching questions
  - [ ] Test quiz with no tag filter selects from all questions
  - [ ] Test tag filter with no matching questions disables start
  - [ ] Test `allTags` is correctly derived from question data
- [ ] Final verification
  - [ ] Clean compile with tagged questions
  - [ ] Clean build: `pnpm build` succeeds
  - [ ] All tests pass in both workspaces
