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
from pydantic import ValidationError

from quizazz_builder.models import Question, QuizFile, SubtopicGroup


class QuizValidationError(Exception):
    """Raised when a question file fails validation."""

    def __init__(self, path: Path, message: str) -> None:
        self.path = path
        super().__init__(f"{path}: {message}")


def validate_file(path: Path) -> QuizFile:
    """Parse and validate a single YAML file in QuizFile format.

    Returns a validated QuizFile object.
    Raises QuizValidationError with file path and specific violation details.
    """
    if not path.exists():
        raise QuizValidationError(path, "File not found")

    if not path.is_file():
        raise QuizValidationError(path, "Not a file")

    text = path.read_text(encoding="utf-8")
    if not text.strip():
        raise QuizValidationError(path, "File is empty")

    try:
        raw = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        raise QuizValidationError(path, f"YAML syntax error: {exc}") from exc

    if not isinstance(raw, dict):
        raise QuizValidationError(
            path,
            f"Expected a YAML mapping with menu_name and questions, got {type(raw).__name__}",
        )

    try:
        quiz_file = QuizFile.model_validate(raw)
    except ValidationError as exc:
        errors = "; ".join(
            f"{'.'.join(str(loc) for loc in e['loc'])}: {e['msg']}"
            for e in exc.errors()
        )
        raise QuizValidationError(path, errors) from exc

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
    Raises QuizValidationError on the first file that fails validation.
    """
    if not quiz_dir.exists():
        raise QuizValidationError(quiz_dir, "Directory not found")

    if not quiz_dir.is_dir():
        raise QuizValidationError(quiz_dir, "Not a directory")

    yaml_files = sorted(quiz_dir.rglob("*.yaml"))
    if not yaml_files:
        raise QuizValidationError(quiz_dir, "No .yaml files found")

    results: list[tuple[Path, QuizFile]] = []
    for yaml_file in yaml_files:
        quiz_file = validate_file(yaml_file)
        relative = yaml_file.relative_to(quiz_dir)
        results.append((relative, quiz_file))

    return results


def validate_directory(directory: Path) -> list[Question]:
    """Validate all .yaml files in a directory (backward-compatible).

    Returns the merged list of validated questions from all files.
    Raises QuizValidationError on the first file that fails validation.

    .. deprecated::
        Use :func:`validate_quiz_directory` for new code.
    """
    validated = validate_quiz_directory(directory)

    questions: list[Question] = []
    for _rel_path, quiz_file in validated:
        questions.extend(_extract_questions(quiz_file))

    return questions
