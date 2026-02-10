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

"""Tests for quizazz_builder.models."""

import pytest
from pydantic import ValidationError

from quizazz_builder.models import Answer, AnswerSet, Question, QuestionBank


def _make_answer(text: str = "Some answer", explanation: str = "Some explanation") -> dict:
    return {"text": text, "explanation": explanation}


def _make_answer_set(**overrides) -> dict:
    defaults = {
        "correct": [_make_answer("Correct", "Why correct")],
        "partially_correct": [_make_answer("Partial", "Why partial")],
        "incorrect": [_make_answer("Wrong", "Why wrong")],
        "ridiculous": [
            _make_answer("Absurd 1", "Why absurd 1"),
            _make_answer("Absurd 2", "Why absurd 2"),
        ],
    }
    defaults.update(overrides)
    return defaults


def _make_question(**overrides) -> dict:
    defaults = {
        "question": "What is the meaning of life?",
        "answers": _make_answer_set(),
    }
    defaults.update(overrides)
    return defaults


class TestAnswer:
    def test_valid_answer(self):
        a = Answer(**_make_answer())
        assert a.text == "Some answer"
        assert a.explanation == "Some explanation"

    def test_empty_text_raises(self):
        with pytest.raises(ValidationError, match="text must not be empty"):
            Answer(**_make_answer(text=""))

    def test_blank_text_raises(self):
        with pytest.raises(ValidationError, match="text must not be empty"):
            Answer(**_make_answer(text="   "))

    def test_empty_explanation_raises(self):
        with pytest.raises(ValidationError, match="explanation must not be empty"):
            Answer(**_make_answer(explanation=""))

    def test_blank_explanation_raises(self):
        with pytest.raises(ValidationError, match="explanation must not be empty"):
            Answer(**_make_answer(explanation="   "))


class TestAnswerSet:
    def test_valid_answer_set(self):
        aset = AnswerSet(**_make_answer_set())
        assert len(aset.correct) == 1
        assert len(aset.partially_correct) == 1
        assert len(aset.incorrect) == 1
        assert len(aset.ridiculous) == 2

    def test_missing_correct_raises(self):
        with pytest.raises(ValidationError, match="at least 1 correct"):
            AnswerSet(**_make_answer_set(correct=[]))

    def test_missing_partially_correct_raises(self):
        with pytest.raises(ValidationError, match="at least 1 partially_correct"):
            AnswerSet(**_make_answer_set(partially_correct=[]))

    def test_missing_incorrect_raises(self):
        with pytest.raises(ValidationError, match="at least 1 incorrect"):
            AnswerSet(**_make_answer_set(incorrect=[]))

    def test_missing_ridiculous_raises(self):
        with pytest.raises(ValidationError, match="at least 1 ridiculous"):
            AnswerSet(**_make_answer_set(ridiculous=[]))

    def test_fewer_than_5_total_raises(self):
        with pytest.raises(ValidationError, match="at least 5 answers total"):
            AnswerSet(**_make_answer_set(ridiculous=[_make_answer("Absurd", "Why absurd")]))

    def test_extra_answers_passes(self):
        aset = AnswerSet(
            **_make_answer_set(
                correct=[
                    _make_answer("Correct 1", "Why 1"),
                    _make_answer("Correct 2", "Why 2"),
                ],
                ridiculous=[
                    _make_answer("Absurd 1", "Why 1"),
                    _make_answer("Absurd 2", "Why 2"),
                    _make_answer("Absurd 3", "Why 3"),
                ],
            )
        )
        total = (
            len(aset.correct)
            + len(aset.partially_correct)
            + len(aset.incorrect)
            + len(aset.ridiculous)
        )
        assert total == 7


class TestQuestion:
    def test_valid_question(self):
        q = Question(**_make_question())
        assert q.question == "What is the meaning of life?"
        assert len(q.answers.correct) == 1

    def test_empty_question_text_raises(self):
        with pytest.raises(ValidationError, match="question must not be empty"):
            Question(**_make_question(question=""))

    def test_blank_question_text_raises(self):
        with pytest.raises(ValidationError, match="question must not be empty"):
            Question(**_make_question(question="   "))

    def test_empty_answer_text_in_question_raises(self):
        with pytest.raises(ValidationError, match="text must not be empty"):
            Question(
                **_make_question(
                    answers=_make_answer_set(
                        correct=[_make_answer(text="")]
                    )
                )
            )

    def test_empty_explanation_in_question_raises(self):
        with pytest.raises(ValidationError, match="explanation must not be empty"):
            Question(
                **_make_question(
                    answers=_make_answer_set(
                        correct=[_make_answer(explanation="")]
                    )
                )
            )


class TestQuestionTags:
    def test_question_with_tags(self):
        q = Question(**_make_question(tags=["geography", "europe"]))
        assert q.tags == ["geography", "europe"]

    def test_question_without_tags(self):
        q = Question(**_make_question())
        assert q.tags is None

    def test_tags_normalized_to_lowercase(self):
        q = Question(**_make_question(tags=["Geography", "EUROPE", "Science"]))
        assert q.tags == ["geography", "europe", "science"]

    def test_empty_string_tag_raises(self):
        with pytest.raises(ValidationError, match="tags must be non-empty strings"):
            Question(**_make_question(tags=["valid", ""]))

    def test_blank_string_tag_raises(self):
        with pytest.raises(ValidationError, match="tags must be non-empty strings"):
            Question(**_make_question(tags=["valid", "   "]))

    def test_empty_tags_list_is_valid(self):
        q = Question(**_make_question(tags=[]))
        assert q.tags == []


class TestQuestionBank:
    def test_valid_bank(self):
        bank = QuestionBank.model_validate([_make_question()])
        assert len(bank.root) == 1

    def test_multiple_questions(self):
        bank = QuestionBank.model_validate([
            _make_question(question="Q1?"),
            _make_question(question="Q2?"),
        ])
        assert len(bank.root) == 2

    def test_empty_bank(self):
        bank = QuestionBank.model_validate([])
        assert len(bank.root) == 0
