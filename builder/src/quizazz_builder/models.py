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

"""Pydantic models for the Quizazz YAML question bank schema."""

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
    answers: AnswerSet

    @field_validator("question")
    @classmethod
    def question_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("question must not be empty or blank")
        return v


class QuestionBank(RootModel[list[Question]]):
    """Top-level model representing a list of questions (one YAML file)."""

    pass
