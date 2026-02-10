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
from quizazz_builder.compiler import compile_questions
from quizazz_builder.validator import QuizValidationError, validate_directory, validate_file


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="quizazz-builder",
        description="Validate and compile YAML question banks for Quizazz.",
    )
    parser.add_argument(
        "--version", action="version", version=f"%(prog)s {__version__}"
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to a YAML file or directory of YAML files.",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Path for the compiled JSON output.",
    )

    args = parser.parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    try:
        if input_path.is_file():
            questions = validate_file(input_path)
        else:
            questions = validate_directory(input_path)
    except QuizValidationError as exc:
        print(f"Validation error: {exc}", file=sys.stderr)
        sys.exit(1)

    compile_questions(questions, output_path)
    print(f"Compiled {len(questions)} questions to {output_path}")


if __name__ == "__main__":
    main()
