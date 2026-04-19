# Copyright (c) 2026 Pointmatic
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""YAML question file validation.

Provides validation for both the new QuizFile format (with metadata and
optional subtopic groups) and backward-compatible directory validation.
"""

from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import ValidationError as _PydanticValidationError

from quizazz.models import Question, QuizFile, SubtopicGroup


class ValidationError(Exception):
    """Raised when a quiz YAML file or directory fails validation.

    Structured attributes for programmatic inspection by library consumers:
    - ``file_path``: the offending path
    - ``message``: human-readable violation summary
    - ``detail``: optional structured context (e.g. per-field Pydantic errors)
    """

    def __init__(
        self,
        file_path: Path,
        message: str,
        detail: dict | None = None,
    ) -> None:
        self.file_path = file_path
        self.message = message
        self.detail = detail
        super().__init__(self._format())

    def _format(self) -> str:
        sep = ":\n" if "\n" in self.message else ": "
        text = f"{self.file_path}{sep}{self.message}"
        extras = {k: v for k, v in (self.detail or {}).items() if k != "errors"}
        if extras:
            text += f"\n  detail: {extras}"
        return text


def _clean_loc(loc: tuple) -> str:
    """Convert a Pydantic error location tuple to a human-readable path.

    Strips internal union discriminator noise like
    'function-after[check_has_questions(), SubtopicGroup]' down to 'subtopic'.
    """
    parts: list[str] = []
    for segment in loc:
        s = str(segment)
        # Skip Pydantic union discriminator internals
        if s.startswith("function-after[") or s.startswith("function-before["):
            continue
        if s in ("Question", "SubtopicGroup"):
            continue
        parts.append(s)
    return ".".join(parts)


def _cleaned_pydantic_errors(exc: _PydanticValidationError) -> list[dict]:
    """Return deduplicated Pydantic errors with cleaned `loc` strings."""
    seen: set[str] = set()
    out: list[dict] = []
    for e in exc.errors():
        loc = _clean_loc(e["loc"])
        msg = e["msg"]
        key = f"{loc}: {msg}"
        if key in seen:
            continue
        seen.add(key)
        out.append({"loc": loc, "msg": msg})
    return out


def _format_validation_errors(errors: list[dict]) -> str:
    """Render a cleaned error list as indented one-per-line text."""
    return "\n".join(f"  {e['loc']}: {e['msg']}" for e in errors)


def validate_file(path: Path) -> QuizFile:
    """Parse and validate a single YAML file in QuizFile format.

    Returns a validated QuizFile object.
    Raises ValidationError with file path and specific violation details.
    """
    if not path.exists():
        raise ValidationError(path, "File not found")

    if not path.is_file():
        raise ValidationError(path, "Not a file")

    text = path.read_text(encoding="utf-8")
    if not text.strip():
        raise ValidationError(path, "File is empty")

    try:
        raw = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        raise ValidationError(path, f"YAML syntax error: {exc}") from exc

    if not isinstance(raw, dict):
        raise ValidationError(
            path,
            f"Expected a YAML mapping with menu_name and questions, got {type(raw).__name__}",
        )

    try:
        quiz_file = QuizFile.model_validate(raw)
    except _PydanticValidationError as exc:
        errors = _cleaned_pydantic_errors(exc)
        raise ValidationError(
            path,
            _format_validation_errors(errors),
            detail={"errors": errors},
        ) from exc

    return quiz_file


def _extract_questions(quiz_file: QuizFile) -> list[Question]:
    """Extract all Question objects from a QuizFile, flattening subtopic groups."""
    questions: list[Question] = []
    for item in quiz_file.questions:
        if isinstance(item, SubtopicGroup):
            questions.extend(item.questions)
        else:
            questions.append(item)
    return questions


def validate_quiz_directory(
    quiz_dir: Path,
) -> list[tuple[Path, QuizFile]]:
    """Recursively validate all .yaml files in a quiz directory.

    Returns a list of (relative_path, QuizFile) tuples preserving the
    directory hierarchy.  Relative paths are computed from *quiz_dir*.
    Raises ValidationError on the first file that fails validation.
    """
    if not quiz_dir.exists():
        raise ValidationError(quiz_dir, "Directory not found")

    if not quiz_dir.is_dir():
        raise ValidationError(quiz_dir, "Not a directory")

    yaml_files = sorted(quiz_dir.rglob("*.yaml"))
    if not yaml_files:
        raise ValidationError(quiz_dir, "No .yaml files found")

    results: list[tuple[Path, QuizFile]] = []
    for yaml_file in yaml_files:
        quiz_file = validate_file(yaml_file)
        relative = yaml_file.relative_to(quiz_dir)
        results.append((relative, quiz_file))

    return results


def validate_directory(directory: Path) -> list[Question]:
    """Validate all .yaml files in a directory (backward-compatible).

    Returns the merged list of validated questions from all files.
    Raises ValidationError on the first file that fails validation.

    .. deprecated::
        Use :func:`validate_quiz_directory` for new code.
    """
    validated = validate_quiz_directory(directory)

    questions: list[Question] = []
    for _rel_path, quiz_file in validated:
        questions.extend(_extract_questions(quiz_file))

    return questions
