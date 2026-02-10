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

### Story A.d: v0.4.0 TypeScript Types and Compiled Data Import [Planned]

Define TypeScript types and wire up the compiled JSON for the app.

- [ ] Create `app/src/lib/types/index.ts`
  - [ ] `AnswerCategory`, `Answer`, `Question`, `QuizConfig`
  - [ ] `PresentedAnswer`, `QuizQuestion`, `QuizSession`, `QuestionScore`
- [ ] Create `app/src/lib/data/questions.json` by running the builder against `data/questions/sample.yaml`
- [ ] Create a simple import test: `app/src/lib/data/` exports typed question data
- [ ] Verify: `pnpm build` in `app/` succeeds with the compiled JSON present

---

## Phase B: Core Engine

### Story B.a: v0.5.0 Client-Side SQLite Database [Planned]

Set up sql.js with IndexedDB persistence and the score schema.

- [ ] Install `sql.js` in `app/`
- [ ] Copy `sql-wasm.wasm` to `app/static/` (add a postinstall script or document manual step)
- [ ] Create `app/src/lib/db/database.ts`
  - [ ] `initDatabase()` — load WASM, restore from IndexedDB or create fresh
  - [ ] `persistDatabase(db)` — export to Uint8Array, save to IndexedDB
  - [ ] `createSchema(db)` — create `question_scores` and `session_answers` tables
- [ ] Create `app/src/lib/db/scores.ts`
  - [ ] `getScores(db)` — return all question scores
  - [ ] `updateScore(db, questionId, points)` — increment cumulative score
  - [ ] `seedScores(db, questionIds)` — INSERT OR IGNORE with score 0
  - [ ] `recordAnswer(db, sessionId, questionId, category, points)` — insert session answer
- [ ] Create `app/tests/db/scores.test.ts`
  - [ ] Test seed scores initializes all questions to 0
  - [ ] Test updateScore increments correctly (positive and negative)
  - [ ] Test getScores returns all seeded questions
  - [ ] Test recordAnswer inserts correctly
  - [ ] Test seedScores is idempotent (INSERT OR IGNORE)
- [ ] Verify: `pnpm test` passes in `app/`

### Story B.b: v0.6.0 Weighted Random Selection [Planned]

Question selection engine that favors lower-scored questions.

- [ ] Create `app/src/lib/utils/random.ts`
  - [ ] `shuffle<T>(array: T[]): T[]` — Fisher-Yates shuffle (returns new array)
  - [ ] `weightedRandomIndex(weights: number[]): number` — pick index proportional to weight
- [ ] Create `app/src/lib/engine/selection.ts`
  - [ ] `selectQuestions(questions, scores, count)` — weighted random without replacement
  - [ ] Weight formula: `max_score - score + 1` (minimum weight = 1)
- [ ] Create `app/tests/utils/random.test.ts`
  - [ ] Test shuffle returns all elements
  - [ ] Test shuffle does not mutate original
  - [ ] Test weightedRandomIndex respects weights (statistical test, N=10000)
- [ ] Create `app/tests/engine/selection.test.ts`
  - [ ] Test selects correct count
  - [ ] Test handles count > pool size (returns all)
  - [ ] Test lower-scored questions selected more often (statistical test, N=10000)
  - [ ] Test all questions have nonzero selection probability
- [ ] Verify: `pnpm test` passes

### Story B.c: v0.7.0 Answer Presentation and Scoring [Planned]

Answer selection, shuffling, and point calculation.

- [ ] Create `app/src/lib/engine/presentation.ts`
  - [ ] `presentAnswers(question, answerCount)` — pick 1 correct + (N-1) others, shuffle, label
- [ ] Create `app/src/lib/engine/scoring.ts`
  - [ ] `SCORE_MAP` constant
  - [ ] `scoreAnswer(category)` function
- [ ] Create `app/tests/engine/presentation.test.ts`
  - [ ] Test exactly 1 correct answer in presented set
  - [ ] Test total presented count matches answerCount (3, 4, 5)
  - [ ] Test labels are sequential ("a", "b", "c", ...)
  - [ ] Test answers are shuffled (statistical test over N runs)
  - [ ] Test handles question with exactly 5 answers and answerCount=5
- [ ] Create `app/tests/engine/scoring.test.ts`
  - [ ] Test each category returns correct point value
  - [ ] Test correct → +1, partially_correct → -2, incorrect → -5, ridiculous → -10
- [ ] Verify: `pnpm test` passes

---

## Phase C: Quiz State Management

### Story C.a: v0.8.0 Svelte Stores and Quiz Lifecycle [Planned]

Reactive state management for the entire quiz flow.

- [ ] Create `app/src/lib/stores/quiz.ts`
  - [ ] `quizSession` writable store
  - [ ] `viewMode` writable store (`"config" | "quiz" | "summary" | "review"`)
  - [ ] `reviewIndex` writable store
  - [ ] `currentQuestion` derived store
  - [ ] `progress` derived store (current, total, percent)
- [ ] Create quiz lifecycle functions (in stores or a separate `lib/engine/lifecycle.ts`)
  - [ ] `startQuiz(config, questions, scores, db)` — select questions, present answers, init session
  - [ ] `submitAnswer(label, db)` — score, record, advance or complete
  - [ ] `retakeQuiz(db)` — reshuffle same questions/answers, reset session state
  - [ ] `newQuiz()` — return to config view
  - [ ] `quitQuiz()` — return to config view
  - [ ] `reviewQuestion(index)` — set review mode
  - [ ] `backToSummary()` — return to summary view
- [ ] Verify: stores and lifecycle functions are importable and type-correct (`pnpm check`)

---

## Phase D: User Interface

### Story D.a: v0.9.0 Config View [Planned]

The quiz configuration screen — first thing the user sees.

- [ ] Create `app/src/lib/components/ConfigView.svelte`
  - [ ] Number of questions: slider or number input (1 to max, default = max)
  - [ ] Number of answer choices: radio group (3, 4, 5; default = 4)
  - [ ] Display total available questions count
  - [ ] "Start Quiz" button (disabled if config invalid)
  - [ ] `Enter` key starts quiz when config is valid
  - [ ] Clean, minimal styling with Tailwind
- [ ] Wire into `app/src/routes/+page.svelte`
  - [ ] Initialize database on mount
  - [ ] Load questions from compiled JSON
  - [ ] Show ConfigView when `viewMode === "config"`
- [ ] Verify: app loads, shows config screen, Start button works

### Story D.b: v0.10.0 Quiz View [Planned]

The main quiz interaction — question display, answer selection, submission.

- [ ] Create `app/src/lib/components/QuizView.svelte`
  - [ ] Display question text
  - [ ] Display answer choices as clickable rows with radio buttons
  - [ ] Entire answer row is clickable (not just the radio button)
  - [ ] Keyboard: `a`–`e` selects corresponding answer
  - [ ] Selected answer is visually highlighted
  - [ ] "Submit" button (disabled until an answer is selected)
  - [ ] `Enter` key submits when an answer is selected
  - [ ] After submit: advance to next question (or complete quiz)
- [ ] Create `app/src/lib/components/ProgressBar.svelte`
  - [ ] Visual progress bar (filled percentage)
  - [ ] "Question N of M" label
- [ ] Wire into `+page.svelte`: show QuizView when `viewMode === "quiz"`
- [ ] Verify: can complete a full quiz using keyboard only
- [ ] Verify: can complete a full quiz using mouse only

### Story D.c: v0.11.0 Summary View [Planned]

Post-quiz results summary.

- [ ] Create `app/src/lib/components/SummaryView.svelte`
  - [ ] Score percentage display (prominent)
  - [ ] Points earned / max possible
  - [ ] Question list with ✓/✗ indicators
  - [ ] Each question row is clickable → navigates to review
  - [ ] Action buttons: "Retake", "Start New Quiz", "Quit"
  - [ ] Clean, celebratory (or encouraging) styling based on score
- [ ] Wire into `+page.svelte`: show SummaryView when `viewMode === "summary"`
- [ ] Verify: Retake reshuffles and restarts same questions
- [ ] Verify: Start New Quiz returns to config
- [ ] Verify: Quit returns to config

### Story D.d: v0.12.0 Review View [Planned]

Detailed question review with explanations.

- [ ] Create `app/src/lib/components/ReviewView.svelte`
  - [ ] Display question text
  - [ ] Display all presented answers with:
    - [ ] User's selection highlighted
    - [ ] Category label for each answer (correct, partially correct, incorrect, ridiculous)
    - [ ] Explanation text for each answer
    - [ ] Visual distinction: correct answer marked green, user's wrong answer marked red
  - [ ] "← Back" button returns to summary
  - [ ] `←` / `Backspace` key returns to summary
- [ ] Wire into `+page.svelte`: show ReviewView when `viewMode === "review"`
- [ ] Verify: clicking a question in summary shows correct review
- [ ] Verify: Back button returns to summary with scroll position preserved

---

## Phase E: Testing & Quality

### Story E.a: v0.13.0 Integration Tests and Edge Cases [Planned]

End-to-end verification of the full quiz flow.

- [ ] Add integration tests for quiz lifecycle
  - [ ] Config → start → answer all → summary → review → back
  - [ ] Config → start → answer all → retake → answer all → summary
  - [ ] Config → start → answer all → start new → config
- [ ] Add edge case tests
  - [ ] Quiz with 1 question
  - [ ] Quiz with max questions (all questions in bank)
  - [ ] 3 answer choices, 4 answer choices, 5 answer choices
  - [ ] Question with exactly 5 answers (minimum)
  - [ ] Question with many answers (10+)
  - [ ] Database missing on load (fresh start)
  - [ ] All questions have same score (uniform selection)
  - [ ] One question has very negative score (should be selected frequently)
- [ ] Verify: all tests pass (`pnpm test` in `app/`, `pytest` in `builder/`)

---

## Phase F: Documentation & Polish

### Story F.a: v0.14.0 README, Sample Data, and Final Polish [Planned]

Documentation, sample content, and UI polish.

- [ ] Update root `README.md`
  - [ ] Project description and screenshot/demo
  - [ ] Prerequisites (Node, Python, pnpm, uv)
  - [ ] Setup instructions (install deps, build questions, run app)
  - [ ] YAML question format documentation with examples
  - [ ] Scoring system explanation
  - [ ] License badge
- [ ] Expand `data/questions/sample.yaml` to 10+ diverse, well-crafted questions
- [ ] UI polish pass
  - [ ] Consistent spacing, typography, and color palette
  - [ ] Responsive layout (works on narrow screens)
  - [ ] Loading state while database initializes
  - [ ] Smooth transitions between views
- [ ] Final verification
  - [ ] Clean build: `python -m quizazz_builder --input data/questions/ --output app/src/lib/data/questions.json`
  - [ ] Clean build: `pnpm build` in `app/`
  - [ ] All tests pass in both workspaces
  - [ ] Manual walkthrough of full quiz flow
