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

"""Tests for quizazz_builder.validator."""

from pathlib import Path

import pytest

from quizazz_builder.models import QuizFile, SubtopicGroup
from quizazz_builder.validator import (
    ValidationError,
    validate_directory,
    validate_file,
    validate_quiz_directory,
)

VALID_QUESTION_YAML = """\
menu_name: "Test Topic"
questions:
  - question: "Test question?"
    answers:
      correct:
        - text: "Right"
          explanation: "This is correct."
      partially_correct:
        - text: "Almost"
          explanation: "This is partially correct."
      incorrect:
        - text: "Wrong"
          explanation: "This is incorrect."
      ridiculous:
        - text: "Absurd 1"
          explanation: "This is ridiculous."
        - text: "Absurd 2"
          explanation: "This is also ridiculous."
"""

VALID_SUBTOPIC_YAML = """\
menu_name: "Subtopic Topic"
menu_description: "A topic with subtopics"
questions:
  - subtopic: "Group A"
    questions:
      - question: "Subtopic question?"
        answers:
          correct:
            - text: "Right"
              explanation: "Correct."
          partially_correct:
            - text: "Almost"
              explanation: "Partial."
          incorrect:
            - text: "Wrong"
              explanation: "Incorrect."
          ridiculous:
            - text: "Absurd 1"
              explanation: "Ridiculous."
            - text: "Absurd 2"
              explanation: "Ridiculous."
"""

VALID_MIXED_YAML = """\
menu_name: "Mixed Topic"
quiz_description: "Has both bare and subtopic questions"
questions:
  - question: "Bare question?"
    answers:
      correct:
        - text: "Right"
          explanation: "Correct."
      partially_correct:
        - text: "Almost"
          explanation: "Partial."
      incorrect:
        - text: "Wrong"
          explanation: "Incorrect."
      ridiculous:
        - text: "Absurd 1"
          explanation: "Ridiculous."
        - text: "Absurd 2"
          explanation: "Ridiculous."
  - subtopic: "Group B"
    questions:
      - question: "Grouped question?"
        answers:
          correct:
            - text: "Right"
              explanation: "Correct."
          partially_correct:
            - text: "Almost"
              explanation: "Partial."
          incorrect:
            - text: "Wrong"
              explanation: "Incorrect."
          ridiculous:
            - text: "Absurd 1"
              explanation: "Ridiculous."
            - text: "Absurd 2"
              explanation: "Ridiculous."
"""

OLD_BARE_LIST_YAML = """\
- question: "Old format question?"
  answers:
    correct:
      - text: "Right"
        explanation: "Correct."
    partially_correct:
      - text: "Almost"
        explanation: "Partial."
    incorrect:
      - text: "Wrong"
        explanation: "Incorrect."
    ridiculous:
      - text: "Absurd 1"
        explanation: "Ridiculous."
      - text: "Absurd 2"
        explanation: "Ridiculous."
"""


class TestValidateFile:
    def test_valid_quiz_file(self, tmp_path):
        f = tmp_path / "valid.yaml"
        f.write_text(VALID_QUESTION_YAML)
        quiz_file = validate_file(f)
        assert isinstance(quiz_file, QuizFile)
        assert quiz_file.menu_name == "Test Topic"
        assert len(quiz_file.questions) == 1
        assert quiz_file.questions[0].question == "Test question?"

    def test_valid_with_subtopic_groups(self, tmp_path):
        f = tmp_path / "subtopic.yaml"
        f.write_text(VALID_SUBTOPIC_YAML)
        quiz_file = validate_file(f)
        assert quiz_file.menu_name == "Subtopic Topic"
        assert quiz_file.menu_description == "A topic with subtopics"
        assert len(quiz_file.questions) == 1
        assert isinstance(quiz_file.questions[0], SubtopicGroup)
        assert quiz_file.questions[0].subtopic == "Group A"

    def test_valid_with_mixed_questions(self, tmp_path):
        f = tmp_path / "mixed.yaml"
        f.write_text(VALID_MIXED_YAML)
        quiz_file = validate_file(f)
        assert quiz_file.menu_name == "Mixed Topic"
        assert quiz_file.quiz_description == "Has both bare and subtopic questions"
        assert len(quiz_file.questions) == 2

    def test_missing_menu_name_fails(self, tmp_path):
        yaml_content = """\
questions:
  - question: "Q?"
    answers:
      correct:
        - text: "R"
          explanation: "E"
      partially_correct:
        - text: "P"
          explanation: "E"
      incorrect:
        - text: "W"
          explanation: "E"
      ridiculous:
        - text: "A1"
          explanation: "E"
        - text: "A2"
          explanation: "E"
"""
        f = tmp_path / "no_name.yaml"
        f.write_text(yaml_content)
        with pytest.raises(ValidationError, match="menu_name"):
            validate_file(f)

    def test_old_bare_list_format_fails(self, tmp_path):
        f = tmp_path / "old.yaml"
        f.write_text(OLD_BARE_LIST_YAML)
        with pytest.raises(ValidationError, match="Expected a YAML mapping"):
            validate_file(f)

    def test_missing_file(self, tmp_path):
        f = tmp_path / "missing.yaml"
        with pytest.raises(ValidationError, match="File not found"):
            validate_file(f)

    def test_empty_file(self, tmp_path):
        f = tmp_path / "empty.yaml"
        f.write_text("")
        with pytest.raises(ValidationError, match="File is empty"):
            validate_file(f)

    def test_blank_file(self, tmp_path):
        f = tmp_path / "blank.yaml"
        f.write_text("   \n  \n")
        with pytest.raises(ValidationError, match="File is empty"):
            validate_file(f)

    def test_malformed_yaml(self, tmp_path):
        f = tmp_path / "bad.yaml"
        f.write_text(":\n  - :\n    - : [invalid")
        with pytest.raises(ValidationError, match="YAML syntax error"):
            validate_file(f)

    def test_validation_error_includes_path(self, tmp_path):
        yaml_content = """\
menu_name: "Topic"
questions:
  - question: ""
    answers:
      correct:
        - text: "R"
          explanation: "E"
      partially_correct:
        - text: "P"
          explanation: "E"
      incorrect:
        - text: "W"
          explanation: "E"
      ridiculous:
        - text: "A1"
          explanation: "E"
        - text: "A2"
          explanation: "E"
"""
        f = tmp_path / "bad_q.yaml"
        f.write_text(yaml_content)
        with pytest.raises(ValidationError, match="bad_q.yaml"):
            validate_file(f)


class TestValidateQuizDirectory:
    def test_single_file(self, tmp_path):
        (tmp_path / "topic.yaml").write_text(VALID_QUESTION_YAML)
        results = validate_quiz_directory(tmp_path)
        assert len(results) == 1
        rel_path, quiz_file = results[0]
        assert str(rel_path) == "topic.yaml"
        assert quiz_file.menu_name == "Test Topic"

    def test_multiple_files(self, tmp_path):
        (tmp_path / "a.yaml").write_text(VALID_QUESTION_YAML)
        (tmp_path / "b.yaml").write_text(VALID_SUBTOPIC_YAML)
        results = validate_quiz_directory(tmp_path)
        assert len(results) == 2
        paths = [str(r[0]) for r in results]
        assert "a.yaml" in paths
        assert "b.yaml" in paths

    def test_recursive_traversal(self, tmp_path):
        sub = tmp_path / "subdir"
        sub.mkdir()
        (tmp_path / "root.yaml").write_text(VALID_QUESTION_YAML)
        (sub / "nested.yaml").write_text(VALID_SUBTOPIC_YAML)
        results = validate_quiz_directory(tmp_path)
        assert len(results) == 2
        paths = [str(r[0]) for r in results]
        assert "root.yaml" in paths
        assert str(Path("subdir") / "nested.yaml") in paths

    def test_nested_subdirectories(self, tmp_path):
        deep = tmp_path / "a" / "b"
        deep.mkdir(parents=True)
        (deep / "deep.yaml").write_text(VALID_QUESTION_YAML)
        results = validate_quiz_directory(tmp_path)
        assert len(results) == 1
        assert str(results[0][0]) == str(Path("a") / "b" / "deep.yaml")

    def test_missing_directory(self, tmp_path):
        d = tmp_path / "nonexistent"
        with pytest.raises(ValidationError, match="Directory not found"):
            validate_quiz_directory(d)

    def test_empty_directory(self, tmp_path):
        d = tmp_path / "empty"
        d.mkdir()
        with pytest.raises(ValidationError, match="No .yaml files found"):
            validate_quiz_directory(d)

    def test_ignores_non_yaml_files(self, tmp_path):
        (tmp_path / "notes.txt").write_text("not yaml")
        (tmp_path / "q.yaml").write_text(VALID_QUESTION_YAML)
        results = validate_quiz_directory(tmp_path)
        assert len(results) == 1


class TestValidateDirectoryBackwardCompat:
    def test_returns_flat_question_list(self, tmp_path):
        (tmp_path / "q.yaml").write_text(VALID_QUESTION_YAML)
        questions = validate_directory(tmp_path)
        assert len(questions) == 1
        assert questions[0].question == "Test question?"

    def test_flattens_subtopic_groups(self, tmp_path):
        (tmp_path / "q.yaml").write_text(VALID_MIXED_YAML)
        questions = validate_directory(tmp_path)
        assert len(questions) == 2
        texts = [q.question for q in questions]
        assert "Bare question?" in texts
        assert "Grouped question?" in texts

    def test_multiple_files_merged(self, tmp_path):
        (tmp_path / "a.yaml").write_text(VALID_QUESTION_YAML)
        (tmp_path / "b.yaml").write_text(VALID_SUBTOPIC_YAML)
        questions = validate_directory(tmp_path)
        assert len(questions) == 2


BAD_QUESTION_YAML = """\
menu_name: "Topic"
questions:
  - question: ""
    answers:
      correct:
        - text: "R"
          explanation: "E"
      partially_correct:
        - text: "P"
          explanation: "E"
      incorrect:
        - text: "W"
          explanation: "E"
      ridiculous:
        - text: "A1"
          explanation: "E"
        - text: "A2"
          explanation: "E"
"""


class TestValidationErrorAttributes:
    """ValidationError exposes structured `file_path`, `message`, `detail` attributes."""

    def test_direct_construction_defaults_detail_to_none(self):
        exc = ValidationError(file_path=Path("/tmp/x.yaml"), message="oops")
        assert exc.file_path == Path("/tmp/x.yaml")
        assert exc.message == "oops"
        assert exc.detail is None

    def test_direct_construction_with_detail(self):
        detail = {"question_index": 2, "field": "answers"}
        exc = ValidationError(
            file_path=Path("/tmp/x.yaml"),
            message="oops",
            detail=detail,
        )
        assert exc.detail == detail

    def test_str_includes_file_path_and_message(self):
        exc = ValidationError(file_path=Path("/tmp/x.yaml"), message="File not found")
        s = str(exc)
        assert "/tmp/x.yaml" in s
        assert "File not found" in s

    def test_str_preserves_multi_line_message(self):
        exc = ValidationError(
            file_path=Path("/tmp/x.yaml"),
            message="  loc1: msg1\n  loc2: msg2",
        )
        s = str(exc)
        assert "loc1: msg1" in s
        assert "loc2: msg2" in s

    def test_missing_file_violation(self, tmp_path):
        f = tmp_path / "missing.yaml"
        with pytest.raises(ValidationError) as ei:
            validate_file(f)
        assert ei.value.file_path == f
        assert ei.value.message == "File not found"

    def test_empty_file_violation(self, tmp_path):
        f = tmp_path / "empty.yaml"
        f.write_text("")
        with pytest.raises(ValidationError) as ei:
            validate_file(f)
        assert ei.value.file_path == f
        assert ei.value.message == "File is empty"

    def test_malformed_yaml_violation(self, tmp_path):
        f = tmp_path / "bad.yaml"
        f.write_text(":\n  - :\n    - : [invalid")
        with pytest.raises(ValidationError) as ei:
            validate_file(f)
        assert ei.value.file_path == f
        assert "YAML syntax error" in ei.value.message

    def test_non_mapping_violation(self, tmp_path):
        f = tmp_path / "list.yaml"
        f.write_text("- a\n- b\n")
        with pytest.raises(ValidationError) as ei:
            validate_file(f)
        assert ei.value.file_path == f
        assert "YAML mapping" in ei.value.message

    def test_pydantic_violation_populates_structured_detail(self, tmp_path):
        f = tmp_path / "bad_q.yaml"
        f.write_text(BAD_QUESTION_YAML)
        with pytest.raises(ValidationError) as ei:
            validate_file(f)
        assert ei.value.file_path == f
        assert ei.value.message
        assert ei.value.detail is not None
        assert "errors" in ei.value.detail
        errors = ei.value.detail["errors"]
        assert isinstance(errors, list) and len(errors) >= 1
        first = errors[0]
        assert "loc" in first and "msg" in first

    def test_directory_not_found_violation(self, tmp_path):
        missing = tmp_path / "nope"
        with pytest.raises(ValidationError) as ei:
            validate_quiz_directory(missing)
        assert ei.value.file_path == missing
        assert ei.value.message == "Directory not found"

    def test_empty_directory_violation(self, tmp_path):
        d = tmp_path / "empty_dir"
        d.mkdir()
        with pytest.raises(ValidationError) as ei:
            validate_quiz_directory(d)
        assert ei.value.file_path == d
        assert ei.value.message == "No .yaml files found"
