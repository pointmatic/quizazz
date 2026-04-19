# multi_quiz_features.md — Quizazz Multi-Quiz Support

## Overview

This document summarizes the design decisions made for multi-quiz support in Quizazz. It captures the discussion outcomes and serves as the basis for updates to [`features.md`](features.md), [`tech_spec.md`](tech_spec.md), and [`stories.md`](stories.md).

---

## Data Layout

The current `data/questions/` directory is renamed to `data/quiz/` and becomes the **default quiz** — the one that ships with the repository and is referenced in the README as the getting-started example.

Users create additional quizzes as sibling directories under `data/`:

```
data/
  quiz/                        ← default quiz (ships with repo)
    sample.yaml
    advanced/
      topic-a.yaml
      topic-b.yaml
  data-engineering/            ← user-created quiz
    fundamentals.yaml
    pipelines/
      batch.yaml
      streaming.yaml
  python-trivia/               ← user-created quiz
    basics.yaml
```

All quiz directories are treated equally by the builder. The `data/quiz/` directory is only "special" in that it ships with the repo and is used in documentation examples.

---

## YAML File Format

Each `.yaml` file represents a **topic**. The file format changes from a bare list of questions to a document with metadata and an optional subtopic hierarchy:

```yaml
menu_name: "Batch Processing"
menu_description: "ETL and batch pipeline patterns"
quiz_description: "Test your knowledge of batch data processing"
questions:
  - subtopic: "MapReduce"
    questions:
      - question: "What is a mapper?"
        tags: ["distributed"]
        answers:
          correct:
            - text: "..."
              explanation: "..."
          partially_correct:
            - text: "..."
              explanation: "..."
          incorrect:
            - text: "..."
              explanation: "..."
          ridiculous:
            - text: "..."
              explanation: "..."
  - question: "What does ETL stand for?"
    answers:
      correct:
        - text: "..."
          explanation: "..."
      partially_correct:
        - text: "..."
          explanation: "..."
      incorrect:
        - text: "..."
          explanation: "..."
      ridiculous:
        - text: "..."
          explanation: "..."
```

### File-Level Metadata

| Field | Required | Description |
|-------|----------|-------------|
| `menu_name` | Yes | Display name shown in the quiz navigation tree |
| `menu_description` | No | Short blurb shown alongside the menu entry |
| `quiz_description` | No | Longer description shown when the user selects this topic |

### Question Hierarchy

The `questions` list at the file level can contain either:

- **Bare questions** — a `Question` object directly (backward-compatible structure minus the bare-list root).
- **Subtopic groups** — an object with `subtopic: str` and `questions: list[Question]`, providing an optional grouping layer within a topic.

Both can be mixed freely in the same file.

---

## Builder CLI

The builder CLI is enhanced to support per-quiz and batch compilation:

```bash
# Build a single quiz
python -m quizazz_builder --input data/quiz/ --output app/build/quiz/

# Build all quizzes under data/
python -m quizazz_builder --all --input data/ --output app/build/
```

Each quiz directory produces a **self-contained SPA** — an `index.html` with bundled assets and a compiled JSON manifest describing the navigation tree and all questions.

---

## Navigation Tree

Each quiz SPA includes a **navigation tree** that mirrors the directory structure of the quiz's YAML files. The tree is built from:

- **Directory names** → tree nodes (folders become expandable groups)
- **YAML file metadata** (`menu_name`, `menu_description`) → leaf nodes (or intermediate nodes if the file contains subtopics)
- **Subtopics** within a file → child nodes under the file's entry

The user browses the tree, selects one or more topics/subtopics, and then enters the existing ConfigView (question count, answer count, tag filter) scoped to the selected questions.

---

## Score Visibility

Scores are stored **per question** (unchanged from v1). The navigation tree displays **per-topic** and **per-subtopic** score summaries, computed at runtime by aggregating the question-level scores that belong to each group. No additional database tables are needed — the compiled manifest carries the topic/subtopic → question mapping, and the question bank is small enough that aggregation is trivial.

For example, the navigation tree might show:

```
📁 Pipelines
   📄 Batch Processing          72% mastery (18/25 questions positive)
       ├─ MapReduce              80% (8/10)
       └─ Spark                  67% (10/15)
   📄 Streaming                  45% mastery (9/20 questions positive)
```

---

## Database Isolation

Each quiz gets its own IndexedDB database, keyed by the quiz directory name (e.g., `quizazz-data-engineering`). This provides:

- **Complete isolation** — scores from one quiz never affect another.
- **Independent deployment** — each quiz can be deployed to a separate URL.
- **No schema changes** — the `question_scores` and `session_answers` tables remain identical; only the IndexedDB database name changes.

---

## What Stays the Same

- **Scoring engine** (`scoring.ts`) — unchanged.
- **Weighted selection** (`selection.ts`) — unchanged; operates on whatever `Question[]` it receives.
- **Answer presentation** (`presentation.ts`) — unchanged.
- **QuizView, SummaryView, ReviewView components** — unchanged; they receive data, not quiz identity.
- **Tags** — still work within a quiz; orthogonal to the tree/subtopic structure.

---

## What Changes

| Layer | Change |
|-------|--------|
| **Data layout** | `data/questions/` → `data/quiz/`; sibling dirs are additional quizzes |
| **YAML format** | Add `menu_name`, `menu_description`, `quiz_description`; nest questions under `questions` key; add optional `subtopic` grouping |
| **Pydantic models** | New `QuizFile` model (metadata + questions); new `SubtopicGroup` model; `QuestionBank` replaced by `QuizFile` |
| **Builder CLI** | Add `--all` flag for batch compilation; per-quiz output directories |
| **Builder compiler** | Generate navigation manifest JSON per quiz; per-file compilation preserving tree structure |
| **App data layer** | Load quiz-specific manifest + questions instead of single `questions.json` |
| **App UI** | New navigation tree component for topic/subtopic selection |
| **App DB** | IndexedDB name derived from quiz directory name |

---

## Design Decisions Log

1. **One DB per quiz vs. one DB with quiz_path column** — Chose one DB per quiz for complete isolation and simpler deployment. No schema migration needed.
2. **All quizzes equal** — No quiz is architecturally special. `data/quiz/` is just the default example for new users.
3. **Per-quiz build output** — Each quiz compiles to its own SPA. The CLI supports building one quiz or all quizzes.
4. **Subtopics are optional** — Questions can live at the topic level or be grouped under subtopics within a file. Both styles can coexist in the same file.
5. **Breaking YAML format change** — The move from bare `list[Question]` to a `QuizFile` document model is a breaking change. Existing YAML files must be migrated.
