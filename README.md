# Quizazz

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

A browser-based study tool that quizzes you on your understanding of a topic. Questions are authored in YAML, validated and compiled at build time, and presented as an interactive multiple-choice quiz. A weighted-random algorithm tracks your performance and prioritizes the material you struggle with most.

## Features

- **YAML question authoring** — write questions with categorized answers and explanations
- **Python builder** — validates YAML schema and compiles to optimized JSON
- **Weighted selection** — questions you get wrong appear more frequently
- **Keyboard-first** — navigate the entire quiz with keyboard shortcuts
- **Persistent scores** — client-side SQLite (sql.js/WASM) persisted to IndexedDB
- **Review mode** — after each quiz, review every answer with explanations; navigate between questions with carousel
- **Mid-quiz review** — go back to review previously answered questions without losing progress
- **Tag filtering** — optionally filter questions by topic tags before starting
- **Configurable** — choose question count (1–N) and answer choices (3, 4, or 5)

## Repository Structure

| Directory | Purpose |
|-----------|---------|
| `app/` | SvelteKit quiz UI and runtime (TypeScript, Tailwind CSS) |
| `builder/` | Python YAML validation and JSON compilation |
| `data/` | Shared YAML question bank |
| `docs/` | Specifications, tech spec, and stories |

## Prerequisites

- **Node.js** 22+ and **pnpm** 10+
- **Python** 3.12+ with a virtual environment

## Setup

### 1. Python Builder

```bash
# From the repository root (with venv activated)
pip install -e builder[dev]
```

### 2. Compile Questions

```bash
python -m quizazz_builder --input data/questions/ --output app/src/lib/data/questions.json
```

### 3. SvelteKit App

```bash
cd app
pnpm install
pnpm dev
```

The app will be available at `http://localhost:5173`.

## Usage

### Authoring Questions

Create YAML files in `data/questions/`. Each file contains a list of questions:

```yaml
- question: "What is the capital of France?"
  tags: ["geography", "europe"]
  answers:
    correct:
      - text: "Paris"
        explanation: "Paris has been the capital of France since the 10th century."
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

**Requirements per question:**
- At least **5 answers** total
- At least **1** answer in each category: `correct`, `partially_correct`, `incorrect`, `ridiculous`
- **`tags`** is optional — a list of lowercase strings for filtering (e.g., `["math", "science"]`)

After editing YAML files, recompile:

```bash
python -m quizazz_builder --input data/questions/ --output app/src/lib/data/questions.json
```

### Taking a Quiz

1. **Filter** (optional) — select one or more tags to narrow the question pool
2. **Configure** — choose how many questions and answer choices
3. **Answer** — select an answer and submit
4. **Review answered** (optional) — go back mid-quiz to review previously answered questions
5. **Review** — after the quiz, see your score and review every answer with explanations
6. **Retake** or **Start New** — retake the same questions or start fresh

When tags are selected, only questions matching **any** selected tag are included (OR logic). The question count slider adjusts automatically to the filtered pool size.

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
# App tests (82+ tests)
cd app && pnpm vitest run

# Builder tests (50 tests)
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
