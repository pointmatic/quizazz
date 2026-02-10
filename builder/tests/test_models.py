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

from quizazz_builder.models import (
    Answer,
    AnswerSet,
    Question,
    QuestionBank,
    QuizFile,
    SubtopicGroup,
)


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


class TestSubtopicGroup:
    def test_valid_subtopic_group(self):
        sg = SubtopicGroup(
            subtopic="MapReduce",
            questions=[Question(**_make_question())],
        )
        assert sg.subtopic == "MapReduce"
        assert len(sg.questions) == 1

    def test_empty_subtopic_raises(self):
        with pytest.raises(ValidationError, match="subtopic must not be empty"):
            SubtopicGroup(
                subtopic="",
                questions=[Question(**_make_question())],
            )

    def test_blank_subtopic_raises(self):
        with pytest.raises(ValidationError, match="subtopic must not be empty"):
            SubtopicGroup(
                subtopic="   ",
                questions=[Question(**_make_question())],
            )

    def test_empty_questions_list_raises(self):
        with pytest.raises(ValidationError, match="at least 1 question"):
            SubtopicGroup(
                subtopic="MapReduce",
                questions=[],
            )

    def test_multiple_questions(self):
        sg = SubtopicGroup(
            subtopic="Spark",
            questions=[
                Question(**_make_question(question="Q1?")),
                Question(**_make_question(question="Q2?")),
            ],
        )
        assert len(sg.questions) == 2


def _make_subtopic_group(**overrides) -> dict:
    defaults = {
        "subtopic": "Test Subtopic",
        "questions": [_make_question()],
    }
    defaults.update(overrides)
    return defaults


def _make_quiz_file(**overrides) -> dict:
    defaults = {
        "menu_name": "Test Topic",
        "questions": [_make_question()],
    }
    defaults.update(overrides)
    return defaults


class TestQuizFile:
    def test_valid_with_bare_questions(self):
        qf = QuizFile(**_make_quiz_file())
        assert qf.menu_name == "Test Topic"
        assert qf.menu_description == ""
        assert qf.quiz_description == ""
        assert len(qf.questions) == 1

    def test_valid_with_subtopic_groups(self):
        qf = QuizFile(**_make_quiz_file(
            questions=[_make_subtopic_group()],
        ))
        assert len(qf.questions) == 1
        assert isinstance(qf.questions[0], SubtopicGroup)

    def test_valid_with_mixed_questions_and_subtopics(self):
        qf = QuizFile(**_make_quiz_file(
            questions=[
                _make_question(question="Bare Q?"),
                _make_subtopic_group(subtopic="Group A"),
            ],
        ))
        assert len(qf.questions) == 2
        assert isinstance(qf.questions[0], Question)
        assert isinstance(qf.questions[1], SubtopicGroup)

    def test_empty_menu_name_raises(self):
        with pytest.raises(ValidationError, match="menu_name must not be empty"):
            QuizFile(**_make_quiz_file(menu_name=""))

    def test_blank_menu_name_raises(self):
        with pytest.raises(ValidationError, match="menu_name must not be empty"):
            QuizFile(**_make_quiz_file(menu_name="   "))

    def test_no_questions_raises(self):
        with pytest.raises(ValidationError, match="at least 1 question"):
            QuizFile(**_make_quiz_file(questions=[]))

    def test_menu_description_defaults_to_empty(self):
        qf = QuizFile(**_make_quiz_file())
        assert qf.menu_description == ""

    def test_quiz_description_defaults_to_empty(self):
        qf = QuizFile(**_make_quiz_file())
        assert qf.quiz_description == ""

    def test_optional_metadata_fields(self):
        qf = QuizFile(**_make_quiz_file(
            menu_description="Short blurb",
            quiz_description="Longer description",
        ))
        assert qf.menu_description == "Short blurb"
        assert qf.quiz_description == "Longer description"
