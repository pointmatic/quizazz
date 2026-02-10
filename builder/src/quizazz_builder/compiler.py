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

"""Compile validated questions to JSON for the SvelteKit app."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from quizazz_builder.models import Question


def _question_id(question_text: str) -> str:
    """Generate a stable ID from the question text (SHA-256 hex digest)."""
    return hashlib.sha256(question_text.encode("utf-8")).hexdigest()


def _flatten_question(question: Question) -> dict:
    """Convert a Question into the flat JSON format consumed by the app."""
    answers = []
    for category, answer_list in [
        ("correct", question.answers.correct),
        ("partially_correct", question.answers.partially_correct),
        ("incorrect", question.answers.incorrect),
        ("ridiculous", question.answers.ridiculous),
    ]:
        for answer in answer_list:
            answers.append(
                {
                    "text": answer.text,
                    "explanation": answer.explanation,
                    "category": category,
                }
            )

    return {
        "id": _question_id(question.question),
        "question": question.question,
        "tags": question.tags or [],
        "answers": answers,
    }


def compile_questions(questions: list[Question], output_path: Path) -> None:
    """Serialize validated questions to JSON.

    Creates parent directories if they don't exist.
    """
    compiled = [_flatten_question(q) for q in questions]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(compiled, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
