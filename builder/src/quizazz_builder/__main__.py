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

"""CLI entry point for quizazz-builder."""

import argparse
import sys
from pathlib import Path

from quizazz_builder import __version__
from quizazz_builder.compiler import compile_quiz
from quizazz_builder.models import SubtopicGroup
from quizazz_builder.validator import QuizValidationError, validate_quiz_directory


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
    quiz_dirs = sorted(
        d for d in input_path.iterdir() if d.is_dir()
    )
    if not quiz_dirs:
        print(f"No quiz directories found in {input_path}", file=sys.stderr)
        sys.exit(1)

    for quiz_dir in quiz_dirs:
        yaml_files = list(quiz_dir.rglob("*.yaml"))
        if not yaml_files:
            continue
        quiz_output = output_path / quiz_dir.name
        _build_single_quiz(quiz_dir, quiz_output)


def main() -> None:
    print(
        "WARNING: 'quizazz-builder' is deprecated. Use 'quizazz generate' instead.",
        file=sys.stderr,
    )
    parser = argparse.ArgumentParser(
        prog="quizazz-builder",
        description="[Deprecated] Validate and compile YAML question banks for Quizazz. Use 'quizazz generate' instead.",
    )
    parser.add_argument(
        "--version", action="version", version=f"%(prog)s {__version__}"
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to a quiz directory (single mode) or parent directory (batch mode).",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output directory for manifest.json (single mode) or parent output directory (batch mode).",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        dest="build_all",
        help="Batch mode: treat each subdirectory of --input as a separate quiz.",
    )

    args = parser.parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if args.build_all:
        if not input_path.is_dir():
            print(
                f"Error: --all requires --input to be a directory, got {input_path}",
                file=sys.stderr,
            )
            sys.exit(1)
        try:
            _build_all_quizzes(input_path, output_path)
        except QuizValidationError as exc:
            print(f"Validation error: {exc}", file=sys.stderr)
            sys.exit(1)
    else:
        if not input_path.is_dir():
            print(
                f"Error: --input must be a quiz directory, got {input_path}",
                file=sys.stderr,
            )
            sys.exit(1)
        try:
            _build_single_quiz(input_path, output_path)
        except QuizValidationError as exc:
            print(f"Validation error: {exc}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
