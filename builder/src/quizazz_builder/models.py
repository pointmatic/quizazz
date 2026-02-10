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

"""Pydantic models for the Quizazz YAML question bank schema.

Defines the data models that enforce the YAML question file format:
- Answer / AnswerSet / Question — individual question structure
- SubtopicGroup — optional grouping of questions within a topic
- QuizFile — top-level file model with metadata and questions
- QuestionBank — deprecated, kept for backward compatibility
"""

from __future__ import annotations

from pydantic import BaseModel, RootModel, field_validator, model_validator


class Answer(BaseModel):
    """A single answer with display text and an explanation."""

    text: str
    explanation: str

    @field_validator("text", "explanation")
    @classmethod
    def must_not_be_blank(cls, v: str, info) -> str:  # noqa: ANN001
        if not v.strip():
            raise ValueError(f"{info.field_name} must not be empty or blank")
        return v


class AnswerSet(BaseModel):
    """Categorized collection of answers for a single question."""

    correct: list[Answer]
    partially_correct: list[Answer]
    incorrect: list[Answer]
    ridiculous: list[Answer]

    @model_validator(mode="after")
    def check_answer_constraints(self) -> AnswerSet:
        if len(self.correct) < 1:
            raise ValueError("Must have at least 1 correct answer")
        if len(self.partially_correct) < 1:
            raise ValueError("Must have at least 1 partially_correct answer")
        if len(self.incorrect) < 1:
            raise ValueError("Must have at least 1 incorrect answer")
        if len(self.ridiculous) < 1:
            raise ValueError("Must have at least 1 ridiculous answer")
        total = (
            len(self.correct)
            + len(self.partially_correct)
            + len(self.incorrect)
            + len(self.ridiculous)
        )
        if total < 5:
            raise ValueError(
                f"Must have at least 5 answers total, got {total}"
            )
        return self


class Question(BaseModel):
    """A single quiz question with categorized answers."""

    question: str
    tags: list[str] | None = None
    answers: AnswerSet

    @field_validator("question")
    @classmethod
    def question_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("question must not be empty or blank")
        return v

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        normalized = []
        for tag in v:
            if not isinstance(tag, str) or not tag.strip():
                raise ValueError("tags must be non-empty strings")
            normalized.append(tag.strip().lower())
        return normalized


class SubtopicGroup(BaseModel):
    """A named group of questions within a topic file."""

    subtopic: str
    questions: list[Question]

    @field_validator("subtopic")
    @classmethod
    def subtopic_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("subtopic must not be empty or blank")
        return v

    @model_validator(mode="after")
    def check_has_questions(self) -> SubtopicGroup:
        if len(self.questions) == 0:
            raise ValueError("subtopic must contain at least 1 question")
        return self


class QuizFile(BaseModel):
    """Top-level model for a quiz YAML file with metadata and questions."""

    menu_name: str
    menu_description: str = ""
    quiz_description: str = ""
    questions: list[Question | SubtopicGroup]

    @field_validator("menu_name")
    @classmethod
    def menu_name_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("menu_name must not be empty or blank")
        return v

    @model_validator(mode="after")
    def check_has_questions(self) -> QuizFile:
        if len(self.questions) == 0:
            raise ValueError("quiz file must contain at least 1 question or subtopic group")
        return self


class QuestionBank(RootModel[list[Question]]):
    """Deprecated: top-level model representing a bare list of questions.

    Kept for backward compatibility. New code should use QuizFile.
    """

    pass
