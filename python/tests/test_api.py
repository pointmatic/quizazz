# Copyright (c) 2026 Pointmatic
# SPDX-License-Identifier: Apache-2.0

"""Tests for the public library API in quizazz.api."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from quizazz import (
    MANIFEST_SCHEMA_VERSION,
    ValidationError,
    compile_assessment,
    validate_assessment,
)

VALID_YAML = """\
menu_name: "Test Topic"
questions:
  - question: "What is 2+2?"
    tags: ["math"]
    answers:
      correct:
        - text: "4"
          explanation: "Basic arithmetic."
      partially_correct:
        - text: "5"
          explanation: "Off by one."
      incorrect:
        - text: "7"
          explanation: "Not close."
      ridiculous:
        - text: "A banana"
          explanation: "That's not a number."
        - text: "Purple"
          explanation: "Also not a number."
"""


def _write(base_dir: Path, name: str, content: str) -> Path:
    base_dir.mkdir(parents=True, exist_ok=True)
    path = base_dir / name
    path.write_text(content)
    return path


class TestCompileAssessmentHappyPath:
    def test_returns_manifest_dict(self, tmp_path):
        _write(tmp_path, "module-4-pre.yaml", VALID_YAML)
        manifest = compile_assessment("module-4-pre.yaml", base_dir=tmp_path)
        assert manifest["schemaVersion"] == MANIFEST_SCHEMA_VERSION
        assert manifest["quizName"] == "module-4-pre"
        assert isinstance(manifest["tree"], list)
        assert isinstance(manifest["questions"], list)
        assert len(manifest["questions"]) == 1

    def test_accepts_str_args(self, tmp_path):
        _write(tmp_path, "q.yaml", VALID_YAML)
        manifest = compile_assessment("q.yaml", base_dir=str(tmp_path))
        assert manifest["quizName"] == "q"

    def test_accepts_path_args(self, tmp_path):
        _write(tmp_path, "q.yaml", VALID_YAML)
        manifest = compile_assessment(Path("q.yaml"), base_dir=tmp_path)
        assert manifest["quizName"] == "q"

    def test_mixed_str_and_path(self, tmp_path):
        _write(tmp_path, "q.yaml", VALID_YAML)
        manifest = compile_assessment(Path("q.yaml"), base_dir=str(tmp_path))
        assert manifest["quizName"] == "q"

    def test_nested_yaml_path(self, tmp_path):
        sub = tmp_path / "modules"
        _write(sub, "m4.yaml", VALID_YAML)
        manifest = compile_assessment("modules/m4.yaml", base_dir=tmp_path)
        assert manifest["quizName"] == "m4"


# Violations ---------------------------------------------------------------

EMPTY_MENU_NAME = VALID_YAML.replace('"Test Topic"', '""')
EMPTY_QUESTION = VALID_YAML.replace('"What is 2+2?"', '""')
EMPTY_ANSWER_TEXT = VALID_YAML.replace('text: "4"', 'text: ""')
EMPTY_EXPLANATION = VALID_YAML.replace(
    'explanation: "Basic arithmetic."',
    'explanation: ""',
)
BAD_TAG = VALID_YAML.replace('tags: ["math"]', 'tags: [""]')

TOO_FEW_ANSWERS = """\
menu_name: "Topic"
questions:
  - question: "Q?"
    answers:
      correct:
        - text: "R"
          explanation: "E"
      partially_correct: []
      incorrect:
        - text: "W"
          explanation: "E"
      ridiculous:
        - text: "A"
          explanation: "E"
"""

MISSING_CATEGORY = """\
menu_name: "Topic"
questions:
  - question: "Q?"
    answers:
      correct:
        - text: "R"
          explanation: "E"
      partially_correct:
        - text: "P"
          explanation: "E"
      ridiculous:
        - text: "A1"
          explanation: "E"
        - text: "A2"
          explanation: "E"
"""


class TestCompileAssessmentViolations:
    @pytest.mark.parametrize(
        "yaml_content, match_term",
        [
            (EMPTY_MENU_NAME, "menu_name"),
            (EMPTY_QUESTION, "question"),
            (TOO_FEW_ANSWERS, "partially_correct"),
            (MISSING_CATEGORY, "incorrect"),
            (EMPTY_ANSWER_TEXT, "text"),
            (EMPTY_EXPLANATION, "explanation"),
            (BAD_TAG, "tags"),
        ],
        ids=[
            "empty_menu_name",
            "empty_question",
            "too_few_answers",
            "missing_category",
            "empty_answer_text",
            "empty_explanation",
            "bad_tag_normalization",
        ],
    )
    def test_violation_populates_structured_attrs(
        self, tmp_path, yaml_content, match_term
    ):
        path = _write(tmp_path, "bad.yaml", yaml_content)
        with pytest.raises(ValidationError) as ei:
            compile_assessment("bad.yaml", base_dir=tmp_path)
        exc = ei.value
        assert exc.file_path == path
        assert exc.message
        assert exc.detail is not None
        assert "errors" in exc.detail
        assert isinstance(exc.detail["errors"], list)
        assert any(match_term in str(e) for e in exc.detail["errors"])

    def test_malformed_yaml(self, tmp_path):
        path = _write(tmp_path, "bad.yaml", ":\n  - :\n    - : [invalid")
        with pytest.raises(ValidationError) as ei:
            compile_assessment("bad.yaml", base_dir=tmp_path)
        assert ei.value.file_path == path
        assert "YAML syntax error" in ei.value.message

    def test_missing_file(self, tmp_path):
        with pytest.raises(ValidationError) as ei:
            compile_assessment("nope.yaml", base_dir=tmp_path)
        assert ei.value.message == "File not found"


# Path-escape guard --------------------------------------------------------


class TestPathEscapeGuard:
    def test_rejects_dotdot_traversal(self, tmp_path):
        base = tmp_path / "content"
        base.mkdir()
        outside = tmp_path / "escape.yaml"
        outside.write_text(VALID_YAML)
        with pytest.raises(ValidationError) as ei:
            compile_assessment("../escape.yaml", base_dir=base)
        assert ei.value.file_path == Path("../escape.yaml")
        assert ei.value.detail is not None
        assert "base_dir" in ei.value.detail
        assert "resolved" in ei.value.detail

    def test_rejects_absolute_path_outside_base(self, tmp_path):
        base = tmp_path / "content"
        base.mkdir()
        outside = tmp_path / "elsewhere" / "x.yaml"
        outside.parent.mkdir()
        outside.write_text(VALID_YAML)
        with pytest.raises(ValidationError) as ei:
            compile_assessment(outside, base_dir=base)
        assert ei.value.detail is not None
        assert "base_dir" in ei.value.detail

    def test_rejects_symlink_escape(self, tmp_path):
        base = tmp_path / "content"
        base.mkdir()
        target = tmp_path / "outside.yaml"
        target.write_text(VALID_YAML)
        link = base / "link.yaml"
        link.symlink_to(target)
        with pytest.raises(ValidationError) as ei:
            compile_assessment("link.yaml", base_dir=base)
        assert ei.value.detail is not None
        assert "resolved" in ei.value.detail

    def test_allows_absolute_path_inside_base(self, tmp_path):
        base = tmp_path / "content"
        base.mkdir()
        inside = base / "q.yaml"
        inside.write_text(VALID_YAML)
        manifest = compile_assessment(inside, base_dir=base)
        assert manifest["quizName"] == "q"


# No disk writes + synchronous --------------------------------------------


class TestNoSideEffects:
    def test_compile_assessment_does_not_write_to_disk(self, tmp_path):
        _write(tmp_path, "q.yaml", VALID_YAML)
        snapshot = sorted(p.name for p in tmp_path.iterdir())
        compile_assessment("q.yaml", base_dir=tmp_path)
        after = sorted(p.name for p in tmp_path.iterdir())
        assert after == snapshot

    def test_compile_assessment_is_synchronous(self, tmp_path):
        assert not asyncio.iscoroutinefunction(compile_assessment)
        _write(tmp_path, "q.yaml", VALID_YAML)
        result = compile_assessment("q.yaml", base_dir=tmp_path)
        assert isinstance(result, dict)
        assert not asyncio.iscoroutine(result)

    def test_validate_assessment_is_synchronous(self):
        assert not asyncio.iscoroutinefunction(validate_assessment)


# validate_assessment ------------------------------------------------------


class TestValidateAssessment:
    def test_returns_empty_list_on_valid(self, tmp_path):
        _write(tmp_path, "q.yaml", VALID_YAML)
        assert validate_assessment("q.yaml", base_dir=tmp_path) == []

    def test_accepts_str_and_path(self, tmp_path):
        _write(tmp_path, "q.yaml", VALID_YAML)
        assert validate_assessment("q.yaml", base_dir=str(tmp_path)) == []
        assert validate_assessment(Path("q.yaml"), base_dir=tmp_path) == []

    def test_returns_error_strings_on_violation(self, tmp_path):
        _write(tmp_path, "bad.yaml", EMPTY_MENU_NAME)
        errors = validate_assessment("bad.yaml", base_dir=tmp_path)
        assert isinstance(errors, list)
        assert len(errors) >= 1
        assert all(isinstance(e, str) for e in errors)
        assert any("menu_name" in e for e in errors)

    def test_never_raises_on_violation(self, tmp_path):
        _write(tmp_path, "bad.yaml", EMPTY_MENU_NAME)
        # If it raised, this call would fail; assert it returns cleanly.
        result = validate_assessment("bad.yaml", base_dir=tmp_path)
        assert isinstance(result, list)

    def test_never_raises_on_path_escape(self, tmp_path):
        base = tmp_path / "content"
        base.mkdir()
        errors = validate_assessment("../escape.yaml", base_dir=base)
        assert isinstance(errors, list) and errors

    def test_never_raises_on_missing_file(self, tmp_path):
        errors = validate_assessment("missing.yaml", base_dir=tmp_path)
        assert errors and any("not found" in e.lower() for e in errors)

    def test_returns_one_string_per_pydantic_violation(self, tmp_path):
        _write(tmp_path, "bad.yaml", EMPTY_MENU_NAME)
        errors = validate_assessment("bad.yaml", base_dir=tmp_path)
        # Empty menu_name is a single violation
        assert len(errors) >= 1
        # Multi-violation case: empty question AND empty answer text → ≥2
        two_violations = VALID_YAML.replace(
            '"What is 2+2?"', '""'
        ).replace('text: "4"', 'text: ""')
        _write(tmp_path, "two.yaml", two_violations)
        errors2 = validate_assessment("two.yaml", base_dir=tmp_path)
        assert len(errors2) >= 2


class TestRoundTripWithCompileQuiz:
    """API output matches the CLI's disk-written JSON for the same source."""

    def test_api_dict_matches_cli_output(self, tmp_path):
        source = tmp_path / "src"
        source.mkdir()
        _write(source, "q.yaml", VALID_YAML)

        api_manifest = compile_assessment("q.yaml", base_dir=source)

        # Replicate what the CLI does: validate the directory and write JSON.
        from quizazz.compiler import compile_quiz
        from quizazz.validator import validate_quiz_directory

        out = tmp_path / "out"
        validated = validate_quiz_directory(source)
        compile_quiz(validated, "q", out)
        cli_manifest = json.loads((out / "q.json").read_text())
        assert api_manifest == cli_manifest
