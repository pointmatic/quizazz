# Quizazz

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

A browser-based study tool that quizzes you on your understanding of a topic. Questions are authored in YAML and organized into quizzes with topics, subtopics, and a navigation tree. A Python builder validates and compiles the YAML into an optimized JSON manifest, and a SvelteKit app presents interactive multiple-choice quizzes. A weighted-random algorithm tracks your performance and prioritizes the material you struggle with most.

## Features

- **Multi-quiz support** — organize questions into quizzes with topics, subtopics, and a navigation tree
- **YAML question authoring** — write questions with categorized answers, explanations, and subtopic grouping
- **Python builder** — validates YAML schema and compiles to optimized JSON manifest (single or batch mode)
- **Navigation tree** — browse topics and subtopics, see mastery scores, and select what to study
- **Weighted selection** — questions you get wrong appear more frequently
- **Mastery tracking** — per-topic and per-subtopic mastery percentages based on cumulative scores
- **Keyboard-first** — navigate the entire quiz with keyboard shortcuts
- **Persistent scores** — client-side SQLite (sql.js/WASM) persisted to IndexedDB, isolated per quiz
- **Review mode** — after each quiz, review every answer with explanations; navigate between questions with carousel
- **Mid-quiz review** — go back to review previously answered questions without losing progress
- **Tag filtering** — optionally filter questions by topic tags before starting
- **Configurable** — choose question count (1–N) and answer choices (3, 4, or 5)

## Repository Structure

| Directory | Purpose |
|-----------|---------|
| `app/` | SvelteKit quiz UI and runtime (TypeScript, Tailwind CSS) |
| `builder/` | Python YAML validation and JSON compilation |
| `data/` | YAML question banks organized by quiz |
| `docs/` | Specifications, tech spec, and stories |

## Prerequisites

- **Node.js** 22+ and **pnpm** 10+
- **Python** 3.12+ with a virtual environment

## Setup

### 1. Python Builder

```bash
# From the repository root (with venv activated)
pip install -e "builder[dev]"
```

### 2. Compile Questions

**Single quiz** (compile one quiz directory):

```bash
quizazz-builder --input data/quiz/ --output app/src/lib/data/
```

**Batch mode** (compile all quizzes under a parent directory):

```bash
quizazz-builder --all --input data/ --output app/build/
```

### 3. SvelteKit App

```bash
cd app
pnpm install
pnpm dev
```

The app will be available at `http://localhost:5173`.

### 4. Run the Quiz

After compiling questions and installing dependencies, run:

```bash
python serve.py
```

This builds the app (if needed), starts a local server, and opens the quiz in your browser at `http://localhost:8000`.

## Usage

### Authoring Questions

Each quiz lives in its own directory under `data/`. YAML files within a quiz directory become **topics** in the navigation tree. Each file can optionally contain `menu_name`, `menu_description`, and `subtopic` groupings.

**Simple format** (flat questions):

```yaml
menu_name: "General Knowledge"
menu_description: "A mix of geography, science, and more"

questions:
  - question: "What is the capital of France?"
    tags: ["geography"]
    answers:
      correct:
        - text: "Paris"
          explanation: "Paris has been the capital since the 10th century."
      partially_correct:
        - text: "Lyon"
          explanation: "Lyon is the second-largest city but not the capital."
      incorrect:
        - text: "Berlin"
          explanation: "Berlin is the capital of Germany."
      ridiculous:
        - text: "Atlantis"
          explanation: "Atlantis is a mythical city."
        - text: "The Moon"
          explanation: "The Moon is not a city."
```

**Subtopic format** (grouped questions):

```yaml
menu_name: "Advanced Concepts"
menu_description: "Challenging questions on algorithms and physics"

questions:
  - subtopic: "Algorithms"
    questions:
      - question: "What is the worst-case time complexity of quicksort?"
        tags: ["algorithms"]
        answers:
          correct:
            - text: "O(n²)"
              explanation: "Quicksort degrades to O(n²) with poor pivot selection."
          # ... more answer categories
  - subtopic: "Physics"
    questions:
      - question: "What is the Heisenberg Uncertainty Principle?"
        tags: ["physics"]
        answers:
          correct:
            - text: "Position and momentum cannot both be known exactly"
              explanation: "Δx·Δp ≥ ℏ/2"
          # ... more answer categories
```

**Requirements per question:**
- At least **5 answers** total
- At least **1** answer in each category: `correct`, `partially_correct`, `incorrect`, `ridiculous`
- **`tags`** is optional — a list of lowercase strings for filtering (e.g., `["math", "science"]`)
- **`menu_name`** and **`menu_description`** are optional — displayed in the navigation tree
- **`subtopic`** groups are optional — create subtopic nodes in the navigation tree

After editing YAML files, recompile:

```bash
quizazz-builder --input data/quiz/ --output app/src/lib/data/
```

### Creating a New Quiz

1. Create a new directory under `data/`, e.g., `data/my-quiz/`
2. Add YAML files with questions (each file becomes a topic)
3. Optionally use subdirectories for organization (they become directory nodes in the nav tree)
4. Compile: `quizazz-builder --input data/my-quiz/ --output app/src/lib/data/`
5. Run the app: `cd app && pnpm dev`

### Taking a Quiz

1. **Navigate** — browse the topic tree, see mastery scores, and select topics/subtopics to study
2. **Configure** — filter by tags (optional), choose question count and answer choices
3. **Answer** — select an answer and submit
4. **Review answered** (optional) — go back mid-quiz to review previously answered questions
5. **Review** — after the quiz, see your score and review every answer with explanations
6. **Retake** or **Start New** — retake the same questions or start fresh

Mastery badges show your progress: green (≥80%), amber (≥40%), gray (<40%). When tags are selected, only questions matching **any** selected tag are included (OR logic). The question count slider adjusts automatically to the filtered pool size.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `a`–`e` | Select an answer |
| `Enter` | Submit selected answer |
| `Escape` | Go back (to answered questions, summary, or quiz) |
| `←` / `→` | Navigate between questions in review mode |

## Scoring

| Answer Category | Points |
|-----------------|--------|
| Correct | **+1** |
| Partially correct | **−2** |
| Incorrect | **−5** |
| Ridiculous | **−10** |

Scores accumulate per question across sessions. The selection algorithm uses the formula `weight = max_score − score + 1`, so lower-scored questions are drawn more frequently.

## Testing

```bash
# App tests (101 tests)
cd app && pnpm vitest run

# Builder tests
cd builder && python -m pytest
```

## Building for Production

```bash
cd app
pnpm build
```

The static site is output to `app/build/`.

## License

Apache-2.0 — see [LICENSE](LICENSE) for details.
