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

import pytest

from quizazz_builder.validator import (
    QuizValidationError,
    validate_directory,
    validate_file,
)

VALID_QUESTION_YAML = """\
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


class TestValidateFile:
    def test_valid_file(self, tmp_path):
        f = tmp_path / "valid.yaml"
        f.write_text(VALID_QUESTION_YAML)
        questions = validate_file(f)
        assert len(questions) == 1
        assert questions[0].question == "Test question?"

    def test_missing_file(self, tmp_path):
        f = tmp_path / "missing.yaml"
        with pytest.raises(QuizValidationError, match="File not found"):
            validate_file(f)

    def test_empty_file(self, tmp_path):
        f = tmp_path / "empty.yaml"
        f.write_text("")
        with pytest.raises(QuizValidationError, match="File is empty"):
            validate_file(f)

    def test_blank_file(self, tmp_path):
        f = tmp_path / "blank.yaml"
        f.write_text("   \n  \n")
        with pytest.raises(QuizValidationError, match="File is empty"):
            validate_file(f)

    def test_malformed_yaml(self, tmp_path):
        f = tmp_path / "bad.yaml"
        f.write_text(":\n  - :\n    - : [invalid")
        with pytest.raises(QuizValidationError, match="YAML syntax error"):
            validate_file(f)

    def test_not_a_list(self, tmp_path):
        f = tmp_path / "notlist.yaml"
        f.write_text("question: 'hello'\n")
        with pytest.raises(QuizValidationError, match="Expected a YAML list"):
            validate_file(f)

    def test_invalid_question_reports_index(self, tmp_path):
        yaml_content = """\
- question: "Valid question?"
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
- question: ""
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
        f = tmp_path / "bad_q2.yaml"
        f.write_text(yaml_content)
        with pytest.raises(QuizValidationError, match="Question 2"):
            validate_file(f)

    def test_multiple_valid_questions(self, tmp_path):
        yaml_content = VALID_QUESTION_YAML + """\
- question: "Second question?"
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
        f = tmp_path / "multi.yaml"
        f.write_text(yaml_content)
        questions = validate_file(f)
        assert len(questions) == 2


class TestValidateDirectory:
    def test_valid_directory(self, tmp_path):
        f = tmp_path / "q1.yaml"
        f.write_text(VALID_QUESTION_YAML)
        questions = validate_directory(tmp_path)
        assert len(questions) == 1

    def test_multiple_files(self, tmp_path):
        for name in ["a.yaml", "b.yaml"]:
            f = tmp_path / name
            f.write_text(VALID_QUESTION_YAML)
        questions = validate_directory(tmp_path)
        assert len(questions) == 2

    def test_missing_directory(self, tmp_path):
        d = tmp_path / "nonexistent"
        with pytest.raises(QuizValidationError, match="Directory not found"):
            validate_directory(d)

    def test_empty_directory(self, tmp_path):
        d = tmp_path / "empty"
        d.mkdir()
        with pytest.raises(QuizValidationError, match="No .yaml files found"):
            validate_directory(d)

    def test_ignores_non_yaml_files(self, tmp_path):
        (tmp_path / "notes.txt").write_text("not yaml")
        (tmp_path / "q.yaml").write_text(VALID_QUESTION_YAML)
        questions = validate_directory(tmp_path)
        assert len(questions) == 1
