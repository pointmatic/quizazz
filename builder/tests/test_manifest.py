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

"""Tests for quizazz_builder.manifest."""

from pathlib import Path

from quizazz_builder.compiler import question_id
from quizazz_builder.manifest import build_navigation_tree
from quizazz_builder.models import (
    Answer,
    AnswerSet,
    Question,
    QuizFile,
    SubtopicGroup,
)


def _make_answer_set() -> AnswerSet:
    return AnswerSet(
        correct=[Answer(text="Right", explanation="Correct.")],
        partially_correct=[Answer(text="Almost", explanation="Partial.")],
        incorrect=[Answer(text="Wrong", explanation="Incorrect.")],
        ridiculous=[
            Answer(text="Absurd 1", explanation="Ridiculous."),
            Answer(text="Absurd 2", explanation="Ridiculous."),
        ],
    )


def _make_question(text: str = "What is 2+2?") -> Question:
    return Question(question=text, answers=_make_answer_set())


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


class TestSingleFileAtRoot:
    def test_single_topic_node(self):
        q = _make_question("Q1?")
        qf = _make_quiz_file(menu_name="Basics", questions=[q])
        tree = build_navigation_tree([(Path("basics.yaml"), qf)])

        assert len(tree) == 1
        node = tree[0]
        assert node["type"] == "topic"
        assert node["id"] == "basics"
        assert node["label"] == "Basics"
        assert node["questionIds"] == [question_id("Q1?")]
        assert node["children"] == []

    def test_no_directory_nodes(self):
        qf = _make_quiz_file()
        tree = build_navigation_tree([(Path("topic.yaml"), qf)])
        types = [n["type"] for n in tree]
        assert "directory" not in types


class TestFileWithSubtopics:
    def test_topic_with_subtopic_children(self):
        q1 = _make_question("Sub Q1?")
        q2 = _make_question("Sub Q2?")
        sg = SubtopicGroup(subtopic="Group A", questions=[q1, q2])
        qf = _make_quiz_file(menu_name="Advanced", questions=[sg])
        tree = build_navigation_tree([(Path("advanced.yaml"), qf)])

        assert len(tree) == 1
        topic = tree[0]
        assert topic["type"] == "topic"
        assert topic["id"] == "advanced"
        assert len(topic["children"]) == 1

        subtopic = topic["children"][0]
        assert subtopic["type"] == "subtopic"
        assert subtopic["id"] == "advanced/group-a"
        assert subtopic["label"] == "Group A"
        assert subtopic["questionIds"] == [
            question_id("Sub Q1?"),
            question_id("Sub Q2?"),
        ]

    def test_topic_question_ids_include_subtopic_questions(self):
        q1 = _make_question("Bare Q?")
        sg = SubtopicGroup(
            subtopic="Grouped",
            questions=[_make_question("Grouped Q?")],
        )
        qf = _make_quiz_file(questions=[q1, sg])
        tree = build_navigation_tree([(Path("mixed.yaml"), qf)])

        topic = tree[0]
        assert question_id("Bare Q?") in topic["questionIds"]
        assert question_id("Grouped Q?") in topic["questionIds"]
        assert len(topic["questionIds"]) == 2


class TestFilesInSubdirectory:
    def test_directory_node_wraps_topics(self):
        qf1 = _make_quiz_file(menu_name="Topic A", questions=[_make_question("A?")])
        qf2 = _make_quiz_file(menu_name="Topic B", questions=[_make_question("B?")])
        tree = build_navigation_tree([
            (Path("subdir/a.yaml"), qf1),
            (Path("subdir/b.yaml"), qf2),
        ])

        assert len(tree) == 1
        dir_node = tree[0]
        assert dir_node["type"] == "directory"
        assert dir_node["id"] == "subdir"
        assert dir_node["label"] == "subdir"
        assert len(dir_node["children"]) == 2

        child_types = [c["type"] for c in dir_node["children"]]
        assert all(t == "topic" for t in child_types)

    def test_directory_aggregates_question_ids(self):
        qf1 = _make_quiz_file(questions=[_make_question("A?")])
        qf2 = _make_quiz_file(questions=[_make_question("B?")])
        tree = build_navigation_tree([
            (Path("subdir/a.yaml"), qf1),
            (Path("subdir/b.yaml"), qf2),
        ])

        dir_node = tree[0]
        assert question_id("A?") in dir_node["questionIds"]
        assert question_id("B?") in dir_node["questionIds"]
        assert len(dir_node["questionIds"]) == 2


class TestNestedSubdirectories:
    def test_nested_directory_nodes(self):
        qf = _make_quiz_file(menu_name="Deep", questions=[_make_question("Deep Q?")])
        tree = build_navigation_tree([(Path("a/b/deep.yaml"), qf)])

        assert len(tree) == 1
        outer = tree[0]
        assert outer["type"] == "directory"
        assert outer["id"] == "a"
        assert outer["label"] == "a"

        assert len(outer["children"]) == 1
        inner = outer["children"][0]
        assert inner["type"] == "directory"
        assert inner["id"] == "b"
        assert inner["label"] == "b"

        assert len(inner["children"]) == 1
        topic = inner["children"][0]
        assert topic["type"] == "topic"
        assert topic["id"] == "a/b/deep"

    def test_nested_aggregation(self):
        qf = _make_quiz_file(questions=[_make_question("Deep Q?")])
        tree = build_navigation_tree([(Path("a/b/deep.yaml"), qf)])

        outer = tree[0]
        inner = outer["children"][0]
        topic = inner["children"][0]

        expected_id = question_id("Deep Q?")
        assert topic["questionIds"] == [expected_id]
        assert inner["questionIds"] == [expected_id]
        assert outer["questionIds"] == [expected_id]


class TestMixedBareAndSubtopicQuestions:
    def test_mixed_file_structure(self):
        bare = _make_question("Bare?")
        grouped = _make_question("Grouped?")
        sg = SubtopicGroup(subtopic="My Group", questions=[grouped])
        qf = _make_quiz_file(
            menu_name="Mixed",
            menu_description="A mixed topic",
            questions=[bare, sg],
        )
        tree = build_navigation_tree([(Path("mixed.yaml"), qf)])

        topic = tree[0]
        assert topic["type"] == "topic"
        assert topic["label"] == "Mixed"
        assert topic["description"] == "A mixed topic"
        assert len(topic["questionIds"]) == 2
        assert question_id("Bare?") in topic["questionIds"]
        assert question_id("Grouped?") in topic["questionIds"]

        assert len(topic["children"]) == 1
        sub = topic["children"][0]
        assert sub["type"] == "subtopic"
        assert sub["id"] == "mixed/my-group"
        assert sub["questionIds"] == [question_id("Grouped?")]
