# features.md — Quizazz (SvelteKit + Node + Python)

## Overview

This document defines **what** Quizazz does — its requirements, inputs, outputs, and behavior — without specifying implementation details. For architecture and module design, see [`tech_spec.md`](tech_spec.md). For the phased implementation plan, see [`stories.md`](stories.md).

---

## Project Goal

Quizazz is a browser-based study tool that quizzes users on their understanding of a topic. Questions and categorized answers are authored in YAML, validated and compiled at build time, and presented as an interactive multiple-choice quiz in a modern single-page application. User performance is tracked in a client-side SQLite database (via sql.js/WASM), and a weighted-random algorithm prioritizes questions the user struggles with most.

The repository is organized as a monorepo with two primary workspaces:

| Directory | Purpose | Version |
|-----------|---------|--------|
| `app/` | SvelteKit quiz UI, runtime, and Node build tooling | v1 (this document) |
| `builder/` | Python-based quiz generation and YAML validation tooling | v1 (this document) |
| `data/` | Shared YAML question bank (consumed by both `app/` and `builder/`) | v1 (this document) |

This separation keeps the runtime app independent from the authoring/generation toolchain and positions the project for future expansion (see [Future Vision](#future-vision)).

### Core Requirements

1. **YAML question bank** — Questions and answers are defined in one or more YAML files, validated at build time, and bundled into the app as JSON.
2. **Answer categorization** — Each answer belongs to one of four categories: `correct`, `partially_correct`, `incorrect`, or `ridiculous`.
3. **Interactive quiz UI** — A minimalistic, modern web interface presents multiple-choice questions one at a time.
4. **Weighted question selection** — Questions are drawn from the pool using weighted random selection, where lower scores (including negative) are more likely to be drawn.
5. **Scoring and persistence** — Each answer is scored and recorded in a client-side SQLite database that persists across sessions via IndexedDB.
6. **Results summary** — After completing a quiz, the user sees a summary with score percentage, per-question results, and the ability to review each question with explanations.

### Operational Requirements

7. **Build-time validation** — The build script must validate YAML files and fail with clear error messages if any question does not meet the minimum answer requirements.
8. **Graceful error handling** — Runtime errors (e.g., corrupt database) should display a user-friendly message, not a blank screen or stack trace.
9. **Database initialization** — On first launch (or if the database is missing), the app automatically creates the schema and seeds initial scores.

### Quality Requirements

10. **Deterministic shuffling** — Answer order is randomized per question presentation, but the randomization is not seeded (true randomness each time).
11. **Fair question selection** — The weighted random algorithm must ensure all questions have a nonzero probability of being selected, regardless of score.

### Usability Requirements

12. **Keyboard-first interaction** — Users can answer questions by pressing `a`–`e` to select and `Enter` to submit. Mouse/touch interaction is equally supported.
13. **Progress indication** — A progress bar and "question N of M" label are always visible during the quiz.
14. **Quiz configuration** — Before starting, the user selects the number of questions (1 to max) and the number of answer choices (3, 4, or 5).
15. **Post-quiz navigation** — From the results summary, clicking a question navigates to a detailed review of that question. A "← Back" button returns to the summary.
16. **Post-quiz actions** — After completing a quiz, the user can:
    - **Retake** — Same questions and answers, reshuffled.
    - **Start** — New quiz with fresh question selection (returns to configuration screen).
    - **Quit** — Returns to the start/configuration screen.

### Non-Goals

- **User accounts or authentication** — This is a single-user, local-first app.
- **Server-side persistence** — All data lives in the browser (IndexedDB-backed SQLite).
- **Real-time multiplayer** — No collaborative or competitive features.
- **Question editing in the UI** — Questions are authored in YAML files and compiled at build time.
- **Mobile native app** — Browser-only; responsive design is acceptable but native wrappers are out of scope.
- **Score decay / spaced repetition** — Deferred to a future version.
- **Tags / category filtering** — Deferred to a future version.
- **Session history / stats over time** — Deferred to a future version.
- **LLM-powered quiz generation** — The `builder/` directory will eventually use LLM APIs to generate questions from source material. Out of scope for v1.
- **FastAPI backend** — A future `api/` directory could provide server-side auth, results aggregation, quiz generation triggers, and automated deployment of updated static apps. Out of scope for v1.
- **Multi-user / server-side persistence** — Deferred until the FastAPI backend is introduced.

---

## Inputs

### YAML Question File

One or more `.yaml` files in the shared data directory (`data/questions/`). Each file contains a list of questions. This directory lives at the repository root and is consumed by both `app/` (at build time) and `builder/` (for generation and validation).

**Structure per question:**

```yaml
- question: "What is the capital of France?"
  answers:
    correct:
      - text: "Paris"
        explanation: "Paris has been the capital of France since the 10th century."
    partially_correct:
      - text: "Lyon"
        explanation: "Lyon is the second-largest city in France but is not the capital."
    incorrect:
      - text: "Berlin"
        explanation: "Berlin is the capital of Germany, not France."
    ridiculous:
      - text: "Atlantis"
        explanation: "Atlantis is a mythical city and does not exist."
      - text: "The Moon"
        explanation: "The Moon is not a city, let alone a capital."
```

**Validation rules (enforced at build time):**

| Rule | Description |
|------|-------------|
| Minimum 5 answers | Each question must have at least 5 answers total across all categories. |
| At least 1 correct | Each question must have at least one answer in the `correct` category. |
| At least 1 in each non-correct category | Each question must have at least one `partially_correct`, one `incorrect`, and one `ridiculous` answer. |
| Exactly 1 correct in any presented set | When the app presents a question, exactly one of the shown answers will be `correct`. The remaining shown answers are drawn from the other categories. |
| Non-empty text and explanation | Every answer must have a non-empty `text` and `explanation` field. |
| Non-empty question | The `question` field must be a non-empty string. |

### Quiz Configuration (Runtime)

| Parameter | Type | Constraints |
|-----------|------|-------------|
| Number of questions | Integer | 1 to total number of questions in the bank |
| Number of answer choices | Integer | 3, 4, or 5 |

---

## Outputs

### Quiz Experience

- A sequence of multiple-choice questions presented one at a time.
- Each question shows the question text and the configured number of answer choices (labeled a–e).
- After submission, the user's answer is scored and recorded.

### Results Summary

After the final question, the app displays:

- **Score percentage** — Points earned as a percentage of the maximum possible (i.e., number of questions, since +1 per correct answer is the max).
- **Question list** — Each question with a correct/incorrect indicator.
- **Drill-down** — Clicking a question shows the question, the user's selected answer (highlighted), and the explanation for each presented answer.

### Persistent Data

- A SQLite database (stored in IndexedDB via sql.js) containing:
  - Per-question cumulative score.
  - Per-question answer history for the current quiz session (to support retake and review).

---

## Functional Requirements

### FR-1: Build-Time YAML Validation and Compilation

The build script reads all `.yaml` files from the question directory, validates each question against the rules in the Inputs section, and outputs a single JSON file bundled into the app. If any validation rule is violated, the build fails with a descriptive error message identifying the file, question index, and the specific violation.

### FR-2: Quiz Configuration Screen

On launch, the app presents a configuration screen where the user selects:
- Number of questions (slider or number input, range 1 to max).
- Number of answer choices (radio buttons: 3, 4, or 5).

A "Start Quiz" button begins the quiz. The button is disabled if the configuration is invalid.

### FR-3: Weighted Random Question Selection

When a quiz starts, the app loads all question scores from the database. Questions are selected using weighted random sampling without replacement:
- Weight is derived from the score such that lower scores yield higher weights.
- All questions must have a nonzero probability of selection.
- Selection continues until the requested number of questions is reached (or the pool is exhausted).

### FR-4: Answer Selection and Presentation

For each presented question:
1. Exactly one answer is randomly chosen from the `correct` category.
2. The remaining answer slots (answer_count − 1) are filled by randomly choosing from the combined pool of `partially_correct`, `incorrect`, and `ridiculous` answers for that question.
3. The selected answers are shuffled into a random order.
4. Answers are labeled sequentially: a, b, c, d (and e if 5 choices).

### FR-5: Answer Input

The user selects an answer by:
- Pressing the corresponding letter key (`a`–`e`), which highlights the answer, OR
- Clicking anywhere on the answer row (text, radio button, or surrounding area), which highlights the answer.

Selection is visually indicated (e.g., highlighted background, filled radio button). The user confirms by clicking the "Submit" button or pressing `Enter`. Submitting without a selection does nothing.

### FR-6: Scoring

Upon submission, the selected answer is scored based on its category:

| Category | Points |
|----------|--------|
| `correct` | +1 |
| `partially_correct` | −2 |
| `incorrect` | −5 |
| `ridiculous` | −10 |

The score is added to the question's cumulative score in the database. The answer and its category are recorded for the current session (for review purposes).

### FR-7: Progress Indication

During the quiz, the UI displays:
- A progress bar showing percent completion (questions answered / total questions).
- A label: "Question N of M" where N is the current question number and M is the total.

### FR-8: Results Summary

After the last question is submitted, the app displays:
- **Score**: points earned / maximum possible points (number of questions × 1), shown as a percentage.
- **Question list**: each question with a visual indicator (✓ or ✗) for correct/incorrect.
- Clicking a question navigates to a **detail view** showing:
  - The question text.
  - All presented answers with the user's selection highlighted.
  - The explanation for each answer.
  - The category of each answer (correct, partially correct, incorrect, ridiculous).
  - A "← Back" button to return to the summary.

### FR-9: Post-Quiz Actions

From the results summary, the user can:
- **Retake** — Restart the quiz with the same questions and answers, but with answer order reshuffled. Scores are recorded again (cumulative).
- **Start** — Return to the configuration screen to start a fresh quiz (new question selection).
- **Quit** — Return to the configuration screen (same as Start, but semantically "I'm done").

Note: "Quit" and "Start" both navigate to the configuration screen. "Quit" is provided as a distinct label for user intent clarity.

### FR-10: Database Initialization

On first load (or if the database is absent/corrupt):
1. Create the SQLite database in memory (sql.js).
2. Create the required tables.
3. Seed each question with an initial score of 0.
4. Persist the database to IndexedDB.

On subsequent loads, the database is restored from IndexedDB.

---

## Configuration

### Build-Time Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Question directory | `data/questions/` | Path to YAML question files, relative to repository root. Shared between `app/` and `builder/`. |
| Output JSON path | `app/src/lib/data/questions.json` | Where the compiled JSON is written for SvelteKit to import. |

### Runtime Configuration

All runtime configuration is done through the quiz configuration screen (FR-2). There are no environment variables or config files at runtime.

---

## Testing Requirements

- **YAML validation**: Unit tests covering valid files, each individual validation rule violation, and edge cases (empty file, duplicate questions).
- **Scoring logic**: Unit tests for each answer category's point value.
- **Weighted selection**: Tests verifying that lower-scored questions are selected more frequently over many iterations.
- **Answer presentation**: Tests verifying exactly one correct answer is always included and total answer count matches configuration.
- **UI interaction**: Tests for keyboard input (letter keys, Enter) and click interaction.
- **Database persistence**: Tests for initialization, score updates, and recovery from missing database.

---

## Security and Compliance Notes

- No sensitive data is processed or stored.
- The app runs entirely in the browser with no network requests after initial page load.
- sql.js WASM binary is bundled with the app (no CDN dependency).

---

## Performance Notes

- The question bank is expected to be small (tens to low hundreds of questions). No pagination or lazy loading is needed.
- sql.js operations are synchronous and fast for this data volume.
- IndexedDB persistence happens after each score update to minimize data loss risk.

---

## Acceptance Criteria

The project is complete when:

1. A user can author questions in YAML, build the app, and take a quiz in the browser.
2. The build fails with clear errors if YAML validation rules are violated.
3. Questions are presented with weighted random selection favoring lower-scored questions.
4. Each question shows exactly one correct answer among the configured number of choices.
5. Answers can be selected via keyboard (letter keys) or mouse click, and submitted via Enter or Submit button.
6. Scores are persisted across browser sessions.
7. The results summary shows score percentage, per-question results, and drill-down with explanations.
8. Retake and Start actions work as specified.
9. The UI is minimalistic, modern, and responsive.

---

## Future Vision

This section captures directional thinking for future versions. Nothing here is in scope for v1, but it informs architectural decisions (e.g., the monorepo layout).

- **`builder/` — LLM-powered quiz generation (Python)**: A Python toolchain that takes source material (documents, notes, textbooks) and uses LLM APIs to generate well-structured YAML question files. This is why `builder/` exists as a separate workspace and why YAML validation lives in Python.
- **`api/` — FastAPI backend**: A server component that could provide user authentication, centralized score/results storage, LLM quiz generation triggers, and automated redeployment of the static app with updated question banks.
- **Score decay / spaced repetition**: Scores drift toward 0 over time so mastered questions periodically resurface.
- **Tags and category filtering**: YAML questions gain optional `tags` fields; the config screen lets users filter by topic.
- **Session history and analytics**: Track quiz sessions over time with trend charts and improvement metrics.
