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

"""Unified CLI entry point for Quizazz."""

import argparse
import http.server
import os
import shutil
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

from quizazz_builder import __version__
from quizazz_builder.compiler import compile_quiz
from quizazz_builder.models import SubtopicGroup
from quizazz_builder.validator import QuizValidationError, validate_quiz_directory

DEFAULT_INPUT = "data/quiz/"
DEFAULT_GENERATE_OUTPUT = "app/src/lib/data/"
DEFAULT_BUILD_OUTPUT = "app/build/"
DEFAULT_PORT = 8000


def _count_questions(validated_files: list) -> int:
    """Count total questions across all validated files."""
    total = 0
    for _path, quiz_file in validated_files:
        for item in quiz_file.questions:
            if isinstance(item, SubtopicGroup):
                total += len(item.questions)
            else:
                total += 1
    return total


def _build_single_quiz(input_path: Path, output_path: Path) -> None:
    """Build a single quiz from a directory of YAML files."""
    validated = validate_quiz_directory(input_path)
    quiz_name = input_path.name
    compile_quiz(validated, quiz_name, output_path)
    n_questions = _count_questions(validated)
    n_topics = len(validated)
    print(
        f"Compiled {n_questions} questions in {n_topics} topics "
        f"for quiz '{quiz_name}' to {output_path}"
    )


def _build_all_quizzes(input_path: Path, output_path: Path) -> None:
    """Build all quizzes found as immediate subdirectories of input_path."""
    quiz_dirs = sorted(d for d in input_path.iterdir() if d.is_dir())
    if not quiz_dirs:
        print(f"No quiz directories found in {input_path}", file=sys.stderr)
        sys.exit(1)

    for quiz_dir in quiz_dirs:
        yaml_files = list(quiz_dir.rglob("*.yaml"))
        if not yaml_files:
            continue
        quiz_output = output_path / quiz_dir.name
        _build_single_quiz(quiz_dir, quiz_output)


def cmd_generate(args: argparse.Namespace) -> None:
    """Handle the 'generate' subcommand."""
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.is_dir():
        print(f"Error: --input must be a directory, got {input_path}", file=sys.stderr)
        sys.exit(1)

    try:
        if args.build_all:
            _build_all_quizzes(input_path, output_path)
        else:
            _build_single_quiz(input_path, output_path)
    except QuizValidationError as exc:
        print(f"Validation error: {exc}", file=sys.stderr)
        sys.exit(1)


def cmd_build(args: argparse.Namespace) -> None:
    """Handle the 'build' subcommand."""
    if not shutil.which("pnpm"):
        print(
            "Error: pnpm is not installed or not in PATH.\n"
            "Install it with: npm install -g pnpm",
            file=sys.stderr,
        )
        sys.exit(1)

    app_dir = Path("app")
    if not app_dir.is_dir():
        print(
            "Error: 'app/' directory not found. Run this from the repo root.",
            file=sys.stderr,
        )
        sys.exit(1)

    cmd = ["pnpm", "--dir", "app", "build"]
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print("Build failed.", file=sys.stderr)
        sys.exit(1)

    print(f"Built successfully. Output: {args.output}")


def cmd_run(args: argparse.Namespace) -> None:
    """Handle the 'run' subcommand."""
    build_dir = Path(args.output)

    if not (build_dir / "index.html").exists():
        print("Build not found. Building app first...")
        if not shutil.which("pnpm"):
            print(
                "Error: pnpm is not installed or not in PATH.\n"
                "Install it with: npm install -g pnpm",
                file=sys.stderr,
            )
            sys.exit(1)
        result = subprocess.run(["pnpm", "--dir", "app", "build"])
        if result.returncode != 0:
            print("Build failed.", file=sys.stderr)
            sys.exit(1)

    port = args.port
    os.chdir(build_dir)
    handler = http.server.SimpleHTTPRequestHandler
    server = http.server.HTTPServer(("localhost", port), handler)

    url = f"http://localhost:{port}"
    print(f"Serving Quizazz at {url}")
    print("Press Ctrl+C to stop.\n")

    threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.server_close()


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="quizazz",
        description="Quizazz — generate, build, and run quiz applications.",
    )
    parser.add_argument(
        "--version", action="version", version=f"%(prog)s {__version__}"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # --- generate ---
    gen_parser = subparsers.add_parser(
        "generate",
        help="Compile YAML question banks into a quiz manifest.",
    )
    gen_parser.add_argument(
        "--input",
        default=DEFAULT_INPUT,
        help=f"Path to a quiz directory (default: {DEFAULT_INPUT}).",
    )
    gen_parser.add_argument(
        "--output",
        default=DEFAULT_GENERATE_OUTPUT,
        help=f"Output directory for the compiled manifest (default: {DEFAULT_GENERATE_OUTPUT}).",
    )
    gen_parser.add_argument(
        "--all",
        action="store_true",
        dest="build_all",
        help="Batch mode: treat each subdirectory of --input as a separate quiz.",
    )
    gen_parser.set_defaults(func=cmd_generate)

    # --- build ---
    build_parser = subparsers.add_parser(
        "build",
        help="Build the Svelte application for production.",
    )
    build_parser.add_argument(
        "--output",
        default=DEFAULT_BUILD_OUTPUT,
        help=f"Output directory for the built app (default: {DEFAULT_BUILD_OUTPUT}).",
    )
    build_parser.set_defaults(func=cmd_build)

    # --- run ---
    run_parser = subparsers.add_parser(
        "run",
        help="Launch a local web server and open the app in a browser.",
    )
    run_parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"Port to serve on (default: {DEFAULT_PORT}).",
    )
    run_parser.add_argument(
        "--output",
        default=DEFAULT_BUILD_OUTPUT,
        help=f"Path to the built app directory (default: {DEFAULT_BUILD_OUTPUT}).",
    )
    run_parser.set_defaults(func=cmd_run)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
