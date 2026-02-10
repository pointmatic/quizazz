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

"""YAML question file validation."""

from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import ValidationError

from quizazz_builder.models import Question, QuestionBank


class QuizValidationError(Exception):
    """Raised when a question file fails validation."""

    def __init__(self, path: Path, message: str) -> None:
        self.path = path
        super().__init__(f"{path}: {message}")


def validate_file(path: Path) -> list[Question]:
    """Parse and validate a single YAML file.

    Returns a list of validated Question objects.
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

    if not isinstance(raw, list):
        raise QuizValidationError(
            path, f"Expected a YAML list of questions, got {type(raw).__name__}"
        )

    questions: list[Question] = []
    for i, item in enumerate(raw):
        try:
            bank = QuestionBank.model_validate([item])
            questions.append(bank.root[0])
        except ValidationError as exc:
            errors = "; ".join(
                f"{'.'.join(str(loc) for loc in e['loc'])}: {e['msg']}"
                for e in exc.errors()
            )
            raise QuizValidationError(
                path, f"Question {i + 1}: {errors}"
            ) from exc

    return questions


def validate_directory(directory: Path) -> list[Question]:
    """Validate all .yaml files in a directory.

    Returns the merged list of validated questions from all files.
    Raises QuizValidationError on the first file that fails validation.
    """
    if not directory.exists():
        raise QuizValidationError(directory, "Directory not found")

    if not directory.is_dir():
        raise QuizValidationError(directory, "Not a directory")

    yaml_files = sorted(directory.glob("*.yaml"))
    if not yaml_files:
        raise QuizValidationError(directory, "No .yaml files found")

    questions: list[Question] = []
    for yaml_file in yaml_files:
        questions.extend(validate_file(yaml_file))

    return questions
