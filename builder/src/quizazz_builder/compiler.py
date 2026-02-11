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

"""Compile validated questions to JSON for the SvelteKit app.

Provides both the new :func:`compile_quiz` (manifest.json output) and the
deprecated :func:`compile_questions` (flat JSON list output).
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath

from quizazz_builder.models import Question, QuizFile, SubtopicGroup


def question_id(question_text: str) -> str:
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
        "id": question_id(question.question),
        "question": question.question,
        "tags": question.tags or [],
        "answers": answers,
    }


def _flatten_quiz_question(
    question: Question, topic_id: str, subtopic: str | None
) -> dict:
    """Convert a Question into the manifest JSON format with topic context."""
    base = _flatten_question(question)
    base["topicId"] = topic_id
    base["subtopic"] = subtopic
    return base


def _topic_id_from_path(relative_path: Path) -> str:
    """Derive a topic ID from a relative file path (without extension)."""
    return str(PurePosixPath(relative_path.with_suffix("")))


def compile_quiz(
    validated_files: list[tuple[Path, QuizFile]],
    quiz_name: str,
    output_dir: Path,
) -> None:
    """Compile validated quiz files into a manifest.json.

    The manifest contains:
    - ``quizName``: the quiz identifier
    - ``tree``: navigation tree (from :func:`build_navigation_tree`)
    - ``questions``: flat list of all questions with ``topicId`` and ``subtopic``

    Creates parent directories if they don't exist.
    """
    from quizazz_builder.manifest import build_navigation_tree

    tree = build_navigation_tree(validated_files)

    questions: list[dict] = []
    for relative_path, quiz_file in validated_files:
        tid = _topic_id_from_path(relative_path)
        for item in quiz_file.questions:
            if isinstance(item, SubtopicGroup):
                for q in item.questions:
                    questions.append(
                        _flatten_quiz_question(q, tid, item.subtopic)
                    )
            else:
                questions.append(_flatten_quiz_question(item, tid, None))

    manifest = {
        "quizName": quiz_name,
        "tree": tree,
        "questions": questions,
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{quiz_name}.json"
    output_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def compile_questions(questions: list[Question], output_path: Path) -> None:
    """Serialize validated questions to JSON.

    Creates parent directories if they don't exist.

    .. deprecated::
        Use :func:`compile_quiz` for new code.
    """
    compiled = [_flatten_question(q) for q in questions]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(compiled, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
