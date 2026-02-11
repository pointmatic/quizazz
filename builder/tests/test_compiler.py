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
from pathlib import Path

from quizazz_builder.compiler import compile_questions, compile_quiz, question_id
from quizazz_builder.models import Answer, AnswerSet, Question, QuizFile, SubtopicGroup


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


def _make_quiz_file(
    menu_name: str = "Test Topic",
    menu_description: str = "",
    questions: list | None = None,
) -> QuizFile:
    if questions is None:
        questions = [_make_question()]
    return QuizFile(
        menu_name=menu_name,
        menu_description=menu_description,
        questions=questions,
    )


class TestCompileQuiz:
    def test_manifest_structure(self, tmp_path):
        qf = _make_quiz_file()
        compile_quiz([(Path("topic.yaml"), qf)], "myquiz", tmp_path)

        manifest_path = tmp_path / "myquiz.json"
        assert manifest_path.exists()
        data = json.loads(manifest_path.read_text())
        assert data["quizName"] == "myquiz"
        assert "tree" in data
        assert "questions" in data

    def test_questions_include_topic_id_and_subtopic(self, tmp_path):
        q = _make_question("Q1?")
        qf = _make_quiz_file(questions=[q])
        compile_quiz([(Path("basics.yaml"), qf)], "quiz", tmp_path)

        data = json.loads((tmp_path / "quiz.json").read_text())
        assert len(data["questions"]) == 1
        question = data["questions"][0]
        assert question["topicId"] == "basics"
        assert question["subtopic"] is None

    def test_subtopic_questions_have_subtopic_name(self, tmp_path):
        sg = SubtopicGroup(
            subtopic="Group A",
            questions=[_make_question("Sub Q?")],
        )
        qf = _make_quiz_file(questions=[sg])
        compile_quiz([(Path("advanced.yaml"), qf)], "quiz", tmp_path)

        data = json.loads((tmp_path / "quiz.json").read_text())
        question = data["questions"][0]
        assert question["topicId"] == "advanced"
        assert question["subtopic"] == "Group A"

    def test_stable_ids_unchanged(self, tmp_path):
        qf = _make_quiz_file(questions=[_make_question("What is 2+2?")])
        compile_quiz([(Path("t.yaml"), qf)], "quiz", tmp_path)

        data = json.loads((tmp_path / "quiz.json").read_text())
        assert data["questions"][0]["id"] == question_id("What is 2+2?")

    def test_category_flattening_unchanged(self, tmp_path):
        qf = _make_quiz_file()
        compile_quiz([(Path("t.yaml"), qf)], "quiz", tmp_path)

        data = json.loads((tmp_path / "quiz.json").read_text())
        answers = data["questions"][0]["answers"]
        categories = {a["category"] for a in answers}
        assert categories == {"correct", "partially_correct", "incorrect", "ridiculous"}

    def test_tree_matches_navigation_structure(self, tmp_path):
        qf = _make_quiz_file(menu_name="Basics")
        compile_quiz([(Path("basics.yaml"), qf)], "quiz", tmp_path)

        data = json.loads((tmp_path / "quiz.json").read_text())
        tree = data["tree"]
        assert len(tree) == 1
        assert tree[0]["type"] == "topic"
        assert tree[0]["id"] == "basics"
        assert tree[0]["label"] == "Basics"

    def test_creates_output_directory(self, tmp_path):
        out = tmp_path / "nested" / "dir"
        qf = _make_quiz_file()
        compile_quiz([(Path("t.yaml"), qf)], "quiz", out)
        assert (out / "quiz.json").exists()

    def test_mixed_bare_and_subtopic(self, tmp_path):
        bare = _make_question("Bare?")
        sg = SubtopicGroup(
            subtopic="Grouped",
            questions=[_make_question("Grouped?")],
        )
        qf = _make_quiz_file(questions=[bare, sg])
        compile_quiz([(Path("mixed.yaml"), qf)], "quiz", tmp_path)

        data = json.loads((tmp_path / "quiz.json").read_text())
        questions = data["questions"]
        assert len(questions) == 2
        assert questions[0]["subtopic"] is None
        assert questions[1]["subtopic"] == "Grouped"
