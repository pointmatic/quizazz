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

"""Tests for the unified quizazz CLI."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from quizazz_builder.cli import cmd_build, cmd_generate, cmd_run, main

# Minimal valid YAML for a quiz file
MINIMAL_YAML = """\
menu_name: Test Topic
questions:
  - question: What is 1+1?
    answers:
      correct:
        - text: "2"
          explanation: "Basic addition."
      partially_correct:
        - text: "About 2"
          explanation: "Close but not exact."
      incorrect:
        - text: "3"
          explanation: "That is wrong."
        - text: "5"
          explanation: "Also wrong."
      ridiculous:
        - text: "A banana"
          explanation: "Not a number."
"""


def _make_quiz_dir(tmp_path: Path, quiz_name: str = "myquiz") -> Path:
    """Create a minimal quiz directory with one YAML file."""
    quiz_dir = tmp_path / quiz_name
    quiz_dir.mkdir()
    (quiz_dir / "basics.yaml").write_text(MINIMAL_YAML)
    return quiz_dir


class TestCmdGenerate:
    def test_generates_named_manifest(self, tmp_path):
        quiz_dir = _make_quiz_dir(tmp_path, "myquiz")
        output_dir = tmp_path / "output"

        args = _make_args(input=str(quiz_dir), output=str(output_dir), build_all=False)
        cmd_generate(args)

        manifest_path = output_dir / "myquiz.json"
        assert manifest_path.exists()
        data = json.loads(manifest_path.read_text())
        assert data["quizName"] == "myquiz"
        assert "tree" in data
        assert "questions" in data
        assert len(data["questions"]) == 1

    def test_generates_with_default_input(self, tmp_path, monkeypatch):
        # Create the default input directory structure
        monkeypatch.chdir(tmp_path)
        quiz_dir = tmp_path / "data" / "quiz"
        quiz_dir.mkdir(parents=True)
        (quiz_dir / "topic.yaml").write_text(MINIMAL_YAML)
        output_dir = tmp_path / "output"

        args = _make_args(input="data/quiz", output=str(output_dir), build_all=False)
        cmd_generate(args)

        assert (output_dir / "quiz.json").exists()

    def test_batch_mode_generates_per_quiz(self, tmp_path):
        parent = tmp_path / "quizzes"
        parent.mkdir()
        _make_quiz_dir(parent, "quiz-a")
        _make_quiz_dir(parent, "quiz-b")
        output_dir = tmp_path / "output"

        args = _make_args(input=str(parent), output=str(output_dir), build_all=True)
        cmd_generate(args)

        assert (output_dir / "quiz-a" / "quiz-a.json").exists()
        assert (output_dir / "quiz-b" / "quiz-b.json").exists()

    def test_invalid_input_exits(self, tmp_path):
        args = _make_args(
            input=str(tmp_path / "nonexistent"), output=str(tmp_path / "out"), build_all=False
        )
        with pytest.raises(SystemExit):
            cmd_generate(args)

    def test_manifest_uses_folder_name(self, tmp_path):
        quiz_dir = _make_quiz_dir(tmp_path, "aws-ml-specialty-exam")
        output_dir = tmp_path / "output"

        args = _make_args(input=str(quiz_dir), output=str(output_dir), build_all=False)
        cmd_generate(args)

        manifest_path = output_dir / "aws-ml-specialty-exam.json"
        assert manifest_path.exists()
        data = json.loads(manifest_path.read_text())
        assert data["quizName"] == "aws-ml-specialty-exam"


class TestCmdBuild:
    def test_missing_pnpm_exits(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        (tmp_path / "app").mkdir()

        with patch("shutil.which", return_value=None):
            with pytest.raises(SystemExit):
                args = _make_args(output="app/build/")
                cmd_build(args)

    def test_missing_app_dir_exits(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        # No app/ directory
        args = _make_args(output="app/build/")
        with pytest.raises(SystemExit):
            cmd_build(args)


class TestCmdRun:
    def test_missing_build_and_no_pnpm_exits(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)

        with patch("shutil.which", return_value=None):
            args = _make_args(output=str(tmp_path / "build"), port=8000)
            with pytest.raises(SystemExit):
                cmd_run(args)


class TestMainEntryPoint:
    def test_version_flag(self, capsys):
        with pytest.raises(SystemExit) as exc_info:
            main_with_args(["--version"])
        assert exc_info.value.code == 0
        captured = capsys.readouterr()
        assert "quizazz" in captured.out

    def test_no_subcommand_exits(self):
        with pytest.raises(SystemExit) as exc_info:
            main_with_args([])
        assert exc_info.value.code != 0

    def test_generate_subcommand_works(self, tmp_path):
        quiz_dir = _make_quiz_dir(tmp_path, "testquiz")
        output_dir = tmp_path / "out"

        main_with_args([
            "generate",
            "--input", str(quiz_dir),
            "--output", str(output_dir),
        ])

        assert (output_dir / "testquiz.json").exists()


# --- Helpers ---

class _Args:
    """Simple namespace to mimic argparse.Namespace."""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


def _make_args(**kwargs) -> _Args:
    return _Args(**kwargs)


def main_with_args(argv: list[str]) -> None:
    """Call main() with the given argv, bypassing sys.argv."""
    with patch("sys.argv", ["quizazz"] + argv):
        main()
