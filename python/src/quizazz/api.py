# Copyright (c) 2026 Pointmatic
# SPDX-License-Identifier: Apache-2.0

"""Public library API for host frameworks (UC-3).

Importable entry points that compile a single YAML assessment file into a
manifest dict (or list its validation errors) without writing to disk.
"""

from __future__ import annotations

from pathlib import Path

from quizazz.compiler import compile_quiz_to_dict
from quizazz.validator import ValidationError, validate_file


def compile_assessment(
    yaml_path: Path | str,
    base_dir: Path | str,
) -> dict:
    """Compile a single assessment YAML file into a manifest dict.

    ``yaml_path`` is joined under ``base_dir`` and must resolve strictly
    inside it (defence against traversal in host-supplied paths). No disk
    writes, no subprocess, no network.

    Raises :class:`ValidationError` on any schema or path violation.
    """
    full = _resolve_under_base(yaml_path, base_dir)
    quiz_file = validate_file(full)
    quiz_name = Path(yaml_path).stem
    return compile_quiz_to_dict([(Path(yaml_path), quiz_file)], quiz_name)


def validate_assessment(
    yaml_path: Path | str,
    base_dir: Path | str,
) -> list[str]:
    """Validate a single assessment YAML without compiling.

    Returns ``[]`` on success, or a list of human-readable error strings
    (one per violation) on failure. Never raises.
    """
    try:
        full = _resolve_under_base(yaml_path, base_dir)
        validate_file(full)
    except ValidationError as exc:
        return _expand_errors(exc)
    return []


def _resolve_under_base(
    yaml_path: Path | str,
    base_dir: Path | str,
) -> Path:
    """Resolve ``yaml_path`` under ``base_dir`` and reject any escape.

    Rejects absolute paths outside ``base_dir``, ``..`` traversal, and
    post-symlink escape. Raises :class:`ValidationError` with
    ``detail={"base_dir": ..., "resolved": ...}``.
    """
    base = Path(base_dir).resolve()
    full = (base / yaml_path).resolve()
    if full != base and base not in full.parents:
        raise ValidationError(
            file_path=Path(yaml_path),
            message=(
                f"yaml_path must resolve under base_dir ({base}); "
                f"got {full}"
            ),
            detail={"base_dir": str(base), "resolved": str(full)},
        )
    return full


def _expand_errors(exc: ValidationError) -> list[str]:
    """Render a ValidationError as one string per underlying violation."""
    if exc.detail and exc.detail.get("errors"):
        return [
            f"{exc.file_path}: {e.get('loc', '')}: {e.get('msg', '')}".rstrip(": ")
            for e in exc.detail["errors"]
        ]
    return [str(exc)]
