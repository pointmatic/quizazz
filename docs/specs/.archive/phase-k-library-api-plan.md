# Phase K Plan — LearningFoundry Integration: Library API

Combined mini-concept / features / tech-spec for Phase K.

For full specifications see [`concept.md`](concept.md), [`features.md`](features.md), [`tech-spec.md`](tech-spec.md), and the integration contract in [`learningfoundry-dependency-spec.md`](learningfoundry-dependency-spec.md). Phase K is part of a multi-phase UC-3 effort:

| Phase | Scope |
|-------|-------|
| **K (this plan)** | Python library API: `compile_assessment`, `validate_assessment`, `ValidationError`; shared compile core; `schemaVersion` field; PyPI release of `quizazz` |
| L (future) | SvelteKit `<QuizBlock>` component; npm release of `@pointmatic/quizazz` |
| M (future) | UC-1 `quizazz build --standalone <name>`; legacy CLI removal; SPDX-header retrofit |

---

## Gap Analysis

### What exists

- `quizazz` compiles quiz directories to JSON manifests via the `quizazz` CLI.
- Validation lives in `quizazz.validator` and raises `QuizValidationError` (a plain `Exception` subclass with a message string).
- Compilation lives in `quizazz.compiler.compile_quiz(validated, quiz_name, output_dir)` — writes a JSON file to disk.
- All entry points today are CLI-driven. There is no public library API.
- Pydantic models enforce the YAML schema; the compiled manifest shape is the same one consumed by the SvelteKit app's `QuizManifest` type.
- Published to PyPI: not yet. The repo is installable only from source (`pip install -e ./builder[dev]`).

### What's needed for learningfoundry

From [`learningfoundry-dependency-spec.md`](learningfoundry-dependency-spec.md):

1. **`compile_assessment(yaml_path, base_dir) -> dict`** — single-file compile returning a manifest dict (not writing to disk).
2. **`validate_assessment(yaml_path, base_dir) -> list[str]`** — validate without compiling, return error strings.
3. **`quizazz.ValidationError`** — specific exception type with structured attributes: `file_path`, `message`, `detail`.
4. **Importable public API**: `from quizazz import compile_assessment, validate_assessment, ValidationError`.
5. **Synchronous, side-effect-free**: no disk writes, no server startup, no subprocess.
6. **Path-escape guard**: `yaml_path` joined under `base_dir` must resolve strictly inside `base_dir`.
7. **`schemaVersion` in manifest**: the cross-package versioning boundary requires the emitted manifest to carry a schema version so consumers can detect breakage.
8. **PyPI release**: learningfoundry pins `quizazz >= <version>` as an optional extra. The package has to actually exist on PyPI.

### Delta

| Need | Current | Phase K change |
|------|---------|----------------|
| Structured exception | `QuizValidationError(Exception)` with string message | Rename to `ValidationError`; add `file_path: Path`, `message: str`, `detail: dict \| None` attributes |
| Library API | None | New `quizazz.api` module; public exports in `__init__.py` |
| In-memory compile | `compile_quiz` writes to disk | Extract shared core `compile_quiz_to_dict`; CLI wraps it for disk write; API calls it directly |
| Schema version | Absent from manifest | Add top-level `schemaVersion: "1.0"` to emitted manifest |
| Path-escape guard | None | Enforce in `compile_assessment` / `validate_assessment` entry |
| PyPI artifact | Source-only install | First PyPI release of `quizazz` |

---

## Feature Requirements (mini-features)

### FK-1: Structured `ValidationError`

`quizazz.ValidationError` is an `Exception` with three attributes:

- `file_path: Path` — the offending YAML file
- `message: str` — human-readable description of the violation
- `detail: dict | None` — optional structured context (e.g., `{"question_index": 2, "field": "answers"}`)

`str(err)` returns a concatenated human-readable form combining file path + message + detail. Raised anywhere current `QuizValidationError` is raised today.

### FK-2: Public Library API

Importable from the top-level package:

```python
from quizazz import compile_assessment, validate_assessment, ValidationError

manifest = compile_assessment("module-4-pre.yaml", base_dir=Path("content"))
errors = validate_assessment("module-4-pre.yaml", base_dir=Path("content"))
```

Behavior:

- `compile_assessment(yaml_path, base_dir) -> dict`: returns a manifest dict matching the same shape produced by the CLI for a single-file quiz. Raises `ValidationError` on any schema violation.
- `validate_assessment(yaml_path, base_dir) -> list[str]`: returns `[]` on success, or a list of human-readable error strings (one per violation).
- Both functions accept `Path | str` for path arguments.
- Both are synchronous and perform no disk writes, no subprocesses, and no network.

### FK-3: Schema-version field in manifest

Every manifest emitted by `compile_quiz_to_dict` (and therefore by both the CLI and `compile_assessment`) includes a top-level `schemaVersion` field set to the current schema version string (initial value `"1.0"`). The TypeScript `QuizManifest` type gains a matching optional field (kept optional in Phase K so existing consumers don't break; Phase L's component can treat it as required).

### FK-4: Path-escape guard

`compile_assessment` and `validate_assessment` resolve `base_dir` to an absolute path, join `yaml_path`, and verify the result is strictly under `base_dir`. Attempts to escape (via `..` segments, absolute `yaml_path`, or symlink-through) raise `ValidationError` with a clear message. This is defensive against hosts that compose paths from user-authored curriculum YAML.

### FK-5: PyPI release of `quizazz`

`quizazz` is published to PyPI with:

- Complete `pyproject.toml` metadata: description, long_description (from README), homepage, repository, authors, license, classifiers, `requires-python >= 3.12`, keywords.
- A PyPI-appropriate README (either the repo README or a builder-specific one) rendered on the package page.
- Version `1.0.0` as the first release (semantic versioning keyed to manifest `schemaVersion`).
- Release process documented (private note or the builder's README) for reproducibility, but automation via CI is **out of scope**.

---

## Technical Changes (mini-tech-spec)

### New modules

| File | Purpose |
|------|---------|
| `python/src/quizazz/api.py` | `compile_assessment`, `validate_assessment`, path-escape helper |
| `python/tests/test_api.py` | Unit + integration tests for the public API |

### Modified modules

| File | Change |
|------|--------|
| `python/src/quizazz/validator.py` | Rename `QuizValidationError` → `ValidationError`; add `file_path`, `message`, `detail` attributes; update all `raise` sites to populate them |
| `python/src/quizazz/compiler.py` | Extract `compile_quiz_to_dict(validated, quiz_name) -> dict`; refactor `compile_quiz` to call it and serialize to disk; inject `schemaVersion` field |
| `python/src/quizazz/__init__.py` | Export public API: `compile_assessment`, `validate_assessment`, `ValidationError`, `__version__` |
| `python/src/quizazz/cli.py` | Update import from `QuizValidationError` → `ValidationError`; no behavior change |
| `python/tests/test_validator.py` | Update to new exception class + attributes |
| `python/tests/test_compiler.py` | Cover `compile_quiz_to_dict` directly; verify `schemaVersion` in output |
| `app/src/lib/types/index.ts` | Add optional `schemaVersion?: string` to `QuizManifest` (no runtime use yet; reserved for Phase L) |
| `python/pyproject.toml` | Enrich metadata for PyPI: description, readme, keywords, classifiers, urls, authors |

### Data model change

Compiled manifest gains one top-level field:

```json
{
  "schemaVersion": "1.0",
  "quizName": "...",
  "tree": [...],
  "questions": [...]
}
```

No other manifest fields change. Additive change → consumer-compatible.

### Manifest schema constant

A shared constant defines the current schema version in one place:

```python
# quizazz/__init__.py (or a dedicated schema.py)
MANIFEST_SCHEMA_VERSION = "1.0"
```

Bumped on breaking changes in lockstep with PyPI major version and (future) npm major version.

### Public API contract (reference implementation)

```python
# quizazz/api.py
from pathlib import Path
from .validator import ValidationError, validate_file
from .compiler import compile_quiz_to_dict

def compile_assessment(yaml_path: Path | str, base_dir: Path | str) -> dict:
    full = _resolve_under_base(yaml_path, base_dir)
    quiz_file = validate_file(full)
    return compile_quiz_to_dict([(Path(yaml_path), quiz_file)], Path(yaml_path).stem)

def validate_assessment(yaml_path: Path | str, base_dir: Path | str) -> list[str]:
    try:
        full = _resolve_under_base(yaml_path, base_dir)
        validate_file(full)
    except ValidationError as exc:
        return [str(exc)]
    return []

def _resolve_under_base(yaml_path: Path | str, base_dir: Path | str) -> Path:
    base = Path(base_dir).resolve()
    full = (base / yaml_path).resolve()
    if base not in full.parents and full != base:
        raise ValidationError(
            file_path=Path(yaml_path),
            message=f"yaml_path must resolve under base_dir ({base}); got {full}",
            detail={"yaml_path": str(yaml_path), "base_dir": str(base)},
        )
    return full
```

### Test coverage additions (`test_api.py`)

- `compile_assessment` happy path: valid YAML → manifest dict with `schemaVersion`, `tree`, `questions`.
- `compile_assessment` raises `ValidationError` with populated `file_path`, `message`, `detail` for: missing required field, too few answers, empty question text, empty menu_name, malformed YAML.
- `compile_assessment` path-escape guard: rejects `../escape.yaml`, absolute paths outside base_dir, and post-symlink-resolution escape.
- `validate_assessment`: returns `[]` for valid; returns one error string per violation.
- No disk writes during any API call (assert via tmpdir).
- Synchronous: no `asyncio.run` or coroutines anywhere in the contract.

### PyPI release polish

Updates to `python/pyproject.toml`:

```toml
[project]
name = "quizazz"
version = "1.0.0"
description = "YAML question bank validator, compiler, and CLI for Quizazz quizzes."
readme = "README.md"  # or "python/README.md" if separate
license = "Apache-2.0"
requires-python = ">=3.12"
authors = [{ name = "Pointmatic" }]
keywords = ["quiz", "assessment", "education", "yaml", "sveltekit"]
classifiers = [
    "Development Status :: 5 - Production/Stable",
    "License :: OSI Approved :: Apache Software License",
    "Programming Language :: Python :: 3.12",
    "Topic :: Education",
    "Topic :: Education :: Testing",
]
[project.urls]
Homepage = "https://github.com/pointmatic/quizazz"
Repository = "https://github.com/pointmatic/quizazz"
```

(Exact URL slugs to be confirmed during story K.e.)

---

## Out of Scope (deferred to later phases)

- **`<QuizBlock>` SvelteKit component** — Phase L.
- **npm package `@pointmatic/quizazz`** — Phase L.
- **UC-1 `quizazz build --standalone <name>`** — Phase M.
- **Legacy CLI script removal** (`quizazz`, `quizazz` console entries) — Phase M, bundled with other housekeeping.
- **SPDX header retrofit** — Phase M.
- **CI-based PyPI publication** — manual release is sufficient for v1.0.0. CI automation can come later if warranted.
- **Runtime schema validation in `<QuizBlock>`** — Phase L concern; Phase K only adds the optional TypeScript field.
- **Schema-version mismatch handling** — both producer and consumer agree on `"1.0"` at this point; mismatch logic is a future concern when a 2.x is introduced.

---

## Constraints

- **No UC-1 / UC-2 regression.** All existing `quizazz` CLI behaviors (`generate`, `build`, `run`) must continue to work unchanged. The rename to `ValidationError` is internal; CLI output formats stay the same.
- **Pydantic 2 only.** No downgrade or dual-support.
- **No changes to the YAML schema itself.** Phase K does not add or remove fields learners author. The only new field is `schemaVersion` in the *compiled* output.
- **Test suite stays green.** The existing builder tests (99 as of v0.38) and app tests (115 as of v0.38) must all pass after Phase K lands. New tests add to that count.
