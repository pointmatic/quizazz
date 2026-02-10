# Quizazz

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

A browser-based study tool that quizzes you on your understanding of a topic. Questions are authored in YAML, validated and compiled at build time, and presented as an interactive multiple-choice quiz with weighted question selection that prioritizes the material you struggle with most.

## Repository Structure

| Directory | Purpose |
|-----------|---------|
| `app/` | SvelteKit quiz UI and runtime |
| `builder/` | Python-based YAML validation and compilation |
| `data/` | Shared YAML question bank |
| `docs/` | Specifications and guides |

## Prerequisites

- **Node.js** 22+ and **pnpm** 10+
- **Python** 3.12+

## Setup

### Python Builder

```bash
# From the repository root (with venv activated)
pip install -e builder[dev]
```

### SvelteKit App

```bash
# Install Node dependencies
cd app
pnpm install
```

## Usage

### 1. Author Questions

Create YAML files in `data/questions/`. See `data/questions/sample.yaml` for the format.

### 2. Compile Questions

```bash
python -m quizazz_builder --input data/questions/ --output app/src/lib/data/questions.json
```

### 3. Run the App

```bash
cd app
pnpm dev
```

## Question Format

```yaml
- question: "What is the capital of France?"
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

Each question must have:
- At least **5 answers** total
- At least **1** answer in each category (`correct`, `partially_correct`, `incorrect`, `ridiculous`)

## Scoring

| Answer Type | Points |
|-------------|--------|
| Correct | +1 |
| Partially correct | −2 |
| Incorrect | −5 |
| Ridiculous | −10 |

Scores are tracked per question across sessions. Lower-scored questions are more likely to appear in future quizzes.

## License

Apache-2.0 — see [LICENSE](LICENSE) for details.
