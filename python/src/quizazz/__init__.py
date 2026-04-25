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

"""Quizazz Builder — YAML question bank validator, compiler, and library API."""

__version__ = "1.1.0"

# Version of the compiled manifest schema emitted by `compile_quiz_to_dict`.
# Bumped in lockstep with breaking manifest-shape changes; see the
# "Bumping the manifest schema version" note in docs/project-guide/go.md.
MANIFEST_SCHEMA_VERSION = "1.0"

from quizazz.api import compile_assessment, validate_assessment  # noqa: E402
from quizazz.validator import ValidationError  # noqa: E402

__all__ = [
    "MANIFEST_SCHEMA_VERSION",
    "ValidationError",
    "__version__",
    "compile_assessment",
    "validate_assessment",
]
