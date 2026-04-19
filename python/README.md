# quizazz

YAML question bank validator, compiler, and CLI for [Quizazz](https://github.com/pointmatic/quizazz) quizzes.

Use it as a command-line tool to compile quiz YAML into a browser-ready manifest, or as a Python library to compile assessments directly into dicts — ideal for host frameworks that bundle quizzes at their own build time.

## Install

```bash
pip install quizazz
```

Python 3.12+ required.

## CLI

```bash
# Compile a single quiz directory to a JSON manifest
quizazz generate --input data/my-quiz/ --output app/src/lib/data/

# Batch-compile every quiz under a parent directory
quizazz generate --all --input data/ --output app/src/lib/data/
```

`quizazz --help` lists all subcommands. The CLI exits non-zero on validation errors and prints one diagnostic per violation to stderr.

## Library API

For host frameworks that want to compile assessments without shelling out:

```python
from pathlib import Path
from quizazz import compile_assessment, validate_assessment, ValidationError

try:
    manifest = compile_assessment("module-4-pre.yaml", base_dir=Path("content"))
    # → dict with schemaVersion, quizName, tree, questions
except ValidationError as exc:
    print(exc.file_path, exc.message, exc.detail)

errors = validate_assessment("bad.yaml", base_dir=Path("content"))
# → [] on success, or one human-readable string per violation
```

Both functions accept `str` or `Path` for their arguments. `yaml_path` is joined under `base_dir` and must resolve strictly inside it; traversal attempts (`..`, absolute paths outside the base, escaping symlinks) raise `ValidationError` with `detail={"base_dir", "resolved"}`. Neither function writes to disk, spawns subprocesses, or issues network calls.

`validate_assessment` never raises — it swallows `ValidationError` and surfaces one string per underlying violation in the returned list.

## YAML schema

Each question requires five or more answers distributed across four categories — `correct`, `partially_correct`, `incorrect`, and `ridiculous`:

```yaml
menu_name: "General Knowledge"
questions:
  - question: "What is the capital of France?"
    tags: ["geography"]
    answers:
      correct:
        - text: "Paris"
          explanation: "Paris has been the capital since the 10th century."
      partially_correct:
        - text: "Lyon"
          explanation: "Second-largest city but not the capital."
      incorrect:
        - text: "Berlin"
          explanation: "Berlin is the capital of Germany."
      ridiculous:
        - text: "Atlantis"
          explanation: "A mythical city."
        - text: "The Moon"
          explanation: "Not a city."
```

Subtopic grouping is optional. See the full repository README for the complete schema, tag filtering, and the SvelteKit quiz UI that consumes the compiled manifests.

## Manifest schema version

The compiled manifest includes a top-level `schemaVersion` field. `quizazz` 1.x emits `"1.0"`; consumers should check compatibility before treating the manifest as authoritative. This is the cross-package versioning boundary between `quizazz` (producer) and `@pointmatic/quizazz` (future npm consumer).

## License

Apache-2.0. See the repository [LICENSE](https://github.com/pointmatic/quizazz/blob/main/LICENSE).
