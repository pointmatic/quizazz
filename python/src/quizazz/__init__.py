# Copyright (c) 2026 Pointmatic
# SPDX-License-Identifier: Apache-2.0

"""Quizazz Builder — YAML question bank validator, compiler, and library API."""

__version__ = "1.2.0"

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
