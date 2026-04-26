# Copyright (c) 2026 Pointmatic
# SPDX-License-Identifier: Apache-2.0

"""Tests for the unified quizazz CLI."""

import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from quizazz.cli import _stage_standalone, cmd_build, cmd_generate, cmd_run, main

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


class TestStageStandalone:
    """Direct tests for the staging contextmanager."""

    def test_moves_others_and_restores(self, tmp_path):
        # Set up: target.json + two siblings
        (tmp_path / "target.json").write_text("{}")
        (tmp_path / "other-a.json").write_text("{}")
        (tmp_path / "other-b.json").write_text("{}")

        with _stage_standalone(tmp_path, "target"):
            # Inside the context: only the target should remain
            present = sorted(p.name for p in tmp_path.glob("*.json"))
            assert present == ["target.json"]

        # After the context: all three must be back
        present = sorted(p.name for p in tmp_path.glob("*.json"))
        assert present == ["other-a.json", "other-b.json", "target.json"]

    def test_missing_target_exits_without_moving(self, tmp_path, capsys):
        (tmp_path / "other.json").write_text("{}")

        with pytest.raises(SystemExit) as exc_info:
            with _stage_standalone(tmp_path, "missing"):
                pytest.fail("body should not execute when target is missing")

        assert exc_info.value.code == 1
        captured = capsys.readouterr()
        assert "missing" in captured.err
        # Other files untouched
        assert (tmp_path / "other.json").exists()

    def test_only_target_present_skips_temp_dir(self, tmp_path):
        (tmp_path / "lonely.json").write_text("{}")

        with patch("tempfile.TemporaryDirectory") as tmp_mock:
            with _stage_standalone(tmp_path, "lonely"):
                pass
            # Temp dir is overhead we want to avoid when there's nothing to stage
            tmp_mock.assert_not_called()

        assert (tmp_path / "lonely.json").exists()

    def test_restores_on_exception(self, tmp_path):
        (tmp_path / "target.json").write_text("{}")
        (tmp_path / "other.json").write_text("{}")

        with pytest.raises(RuntimeError):
            with _stage_standalone(tmp_path, "target"):
                raise RuntimeError("simulated build failure")

        # Both manifests must be back at their original paths
        assert (tmp_path / "target.json").exists()
        assert (tmp_path / "other.json").exists()

    def test_restores_on_keyboard_interrupt(self, tmp_path):
        (tmp_path / "target.json").write_text("{}")
        (tmp_path / "other.json").write_text("{}")

        with pytest.raises(KeyboardInterrupt):
            with _stage_standalone(tmp_path, "target"):
                raise KeyboardInterrupt()

        assert (tmp_path / "target.json").exists()
        assert (tmp_path / "other.json").exists()


class TestCmdBuildStandalone:
    """End-to-end behavior of `cmd_build` with the --standalone flag."""

    def _make_app_tree(self, tmp_path: Path, manifests: list[str]) -> Path:
        """Build a fake app/ tree at tmp_path and seed the manifest dir."""
        data_dir = tmp_path / "app" / "src" / "lib" / "data"
        data_dir.mkdir(parents=True)
        for name in manifests:
            (data_dir / f"{name}.json").write_text("{}")
        return data_dir

    def test_standalone_runs_pnpm_with_env_and_restores_others(
        self, tmp_path, monkeypatch
    ):
        monkeypatch.chdir(tmp_path)
        data_dir = self._make_app_tree(tmp_path, ["primary", "other-a", "other-b"])

        captured: dict = {}

        def fake_run(cmd, *args, **kwargs):
            captured["cmd"] = cmd
            captured["env"] = kwargs.get("env")
            # Inside the build, only the target manifest should be present
            present = sorted(p.name for p in data_dir.glob("*.json"))
            captured["present_during_build"] = present
            return MagicMock(returncode=0)

        with (
            patch("shutil.which", return_value="/usr/bin/pnpm"),
            patch("subprocess.run", side_effect=fake_run),
        ):
            args = _make_args(output="app/build/", standalone="primary")
            cmd_build(args)

        assert captured["cmd"] == ["pnpm", "--dir", "app", "build"]
        assert captured["env"] is not None
        assert captured["env"]["QUIZAZZ_STANDALONE"] == "primary"
        assert captured["env"]["VITE_QUIZAZZ_STANDALONE"] == "primary"
        assert captured["present_during_build"] == ["primary.json"]

        # All three manifests are back after the build
        present_after = sorted(p.name for p in data_dir.glob("*.json"))
        assert present_after == ["other-a.json", "other-b.json", "primary.json"]

    def test_standalone_missing_target_exits_one(self, tmp_path, monkeypatch, capsys):
        monkeypatch.chdir(tmp_path)
        data_dir = self._make_app_tree(tmp_path, ["only"])

        # subprocess.run must NOT be called if staging failed
        with (
            patch("shutil.which", return_value="/usr/bin/pnpm"),
            patch("subprocess.run") as run_mock,
            pytest.raises(SystemExit) as exc_info,
        ):
            args = _make_args(output="app/build/", standalone="missing")
            cmd_build(args)

        assert exc_info.value.code == 1
        run_mock.assert_not_called()
        captured = capsys.readouterr()
        assert "missing" in captured.err
        # Existing manifests untouched
        assert (data_dir / "only.json").exists()

    def test_standalone_only_target_present_no_staging(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        self._make_app_tree(tmp_path, ["lonely"])

        with (
            patch("shutil.which", return_value="/usr/bin/pnpm"),
            patch("subprocess.run", return_value=MagicMock(returncode=0)) as run_mock,
            patch("tempfile.TemporaryDirectory") as tmp_mock,
        ):
            args = _make_args(output="app/build/", standalone="lonely")
            cmd_build(args)

        run_mock.assert_called_once()
        env = run_mock.call_args.kwargs.get("env")
        assert env is not None
        assert env["VITE_QUIZAZZ_STANDALONE"] == "lonely"
        # No temp dir should have been created — there was nothing to stage
        tmp_mock.assert_not_called()

    def test_standalone_pnpm_failure_exits_one_and_restores(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        data_dir = self._make_app_tree(tmp_path, ["primary", "other"])

        with (
            patch("shutil.which", return_value="/usr/bin/pnpm"),
            patch("subprocess.run", return_value=MagicMock(returncode=1)),
            pytest.raises(SystemExit) as exc_info,
        ):
            args = _make_args(output="app/build/", standalone="primary")
            cmd_build(args)

        assert exc_info.value.code == 1
        # Both manifests must be back even on pnpm failure
        present_after = sorted(p.name for p in data_dir.glob("*.json"))
        assert present_after == ["other.json", "primary.json"]

    def test_standalone_keyboard_interrupt_restores(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        data_dir = self._make_app_tree(tmp_path, ["primary", "other"])

        def raise_interrupt(*_args, **_kwargs):
            raise KeyboardInterrupt()

        with (
            patch("shutil.which", return_value="/usr/bin/pnpm"),
            patch("subprocess.run", side_effect=raise_interrupt),
            pytest.raises(KeyboardInterrupt),
        ):
            args = _make_args(output="app/build/", standalone="primary")
            cmd_build(args)

        # finally clause must have restored the moved manifest
        present_after = sorted(p.name for p in data_dir.glob("*.json"))
        assert present_after == ["other.json", "primary.json"]

    def test_non_standalone_build_unchanged(self, tmp_path, monkeypatch):
        """Regression: --standalone unset must not pass any QUIZAZZ_STANDALONE env vars
        and must not stage anything."""
        monkeypatch.chdir(tmp_path)
        self._make_app_tree(tmp_path, ["a", "b"])

        captured: dict = {}

        def fake_run(cmd, *args, **kwargs):
            captured["cmd"] = cmd
            captured["env"] = kwargs.get("env")
            return MagicMock(returncode=0)

        with (
            patch("shutil.which", return_value="/usr/bin/pnpm"),
            patch("subprocess.run", side_effect=fake_run),
        ):
            args = _make_args(output="app/build/", standalone=None)
            cmd_build(args)

        assert captured["cmd"] == ["pnpm", "--dir", "app", "build"]
        # Default build path must not pass an env kwarg (or, if it does, it must
        # not contain the standalone vars)
        env = captured.get("env")
        if env is not None:
            assert "QUIZAZZ_STANDALONE" not in env
            assert "VITE_QUIZAZZ_STANDALONE" not in env


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
