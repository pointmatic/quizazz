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

"""Tests for quizazz_builder.compiler."""

import json

from quizazz_builder.compiler import question_id, compile_questions
from quizazz_builder.models import Answer, AnswerSet, Question


def _make_question(text: str = "What is 2+2?") -> Question:
    return Question(
        question=text,
        answers=AnswerSet(
            correct=[Answer(text="4", explanation="Basic arithmetic.")],
            partially_correct=[Answer(text="3.9", explanation="Close but not exact.")],
            incorrect=[Answer(text="7", explanation="Incorrect arithmetic.")],
            ridiculous=[
                Answer(text="A banana", explanation="That is not a number."),
                Answer(text="Purple", explanation="That is a color, not a number."),
            ],
        ),
    )


class TestQuestionId:
    def test_stable_id(self):
        id1 = question_id("What is 2+2?")
        id2 = question_id("What is 2+2?")
        assert id1 == id2

    def test_different_text_different_id(self):
        id1 = question_id("What is 2+2?")
        id2 = question_id("What is 3+3?")
        assert id1 != id2

    def test_id_is_hex_string(self):
        qid = question_id("test")
        assert len(qid) == 64
        assert all(c in "0123456789abcdef" for c in qid)


class TestCompileQuestions:
    def test_output_structure(self, tmp_path):
        output = tmp_path / "out.json"
        compile_questions([_make_question()], output)

        data = json.loads(output.read_text())
        assert isinstance(data, list)
        assert len(data) == 1

        q = data[0]
        assert "id" in q
        assert q["question"] == "What is 2+2?"
        assert isinstance(q["answers"], list)

    def test_category_flattening(self, tmp_path):
        output = tmp_path / "out.json"
        compile_questions([_make_question()], output)

        data = json.loads(output.read_text())
        answers = data[0]["answers"]
        assert len(answers) == 5

        categories = [a["category"] for a in answers]
        assert "correct" in categories
        assert "partially_correct" in categories
        assert "incorrect" in categories
        assert "ridiculous" in categories

    def test_each_answer_has_fields(self, tmp_path):
        output = tmp_path / "out.json"
        compile_questions([_make_question()], output)

        data = json.loads(output.read_text())
        for answer in data[0]["answers"]:
            assert "text" in answer
            assert "explanation" in answer
            assert "category" in answer

    def test_creates_parent_directories(self, tmp_path):
        output = tmp_path / "nested" / "dir" / "out.json"
        compile_questions([_make_question()], output)
        assert output.exists()

    def test_multiple_questions(self, tmp_path):
        output = tmp_path / "out.json"
        questions = [_make_question("Q1?"), _make_question("Q2?")]
        compile_questions(questions, output)

        data = json.loads(output.read_text())
        assert len(data) == 2
        assert data[0]["id"] != data[1]["id"]

    def test_stable_ids_match(self, tmp_path):
        output = tmp_path / "out.json"
        compile_questions([_make_question("What is 2+2?")], output)

        data = json.loads(output.read_text())
        assert data[0]["id"] == question_id("What is 2+2?")

    def test_tags_included_in_output(self, tmp_path):
        output = tmp_path / "out.json"
        q = _make_question()
        q.tags = ["math", "arithmetic"]
        compile_questions([q], output)

        data = json.loads(output.read_text())
        assert data[0]["tags"] == ["math", "arithmetic"]

    def test_no_tags_outputs_empty_list(self, tmp_path):
        output = tmp_path / "out.json"
        compile_questions([_make_question()], output)

        data = json.loads(output.read_text())
        assert data[0]["tags"] == []
