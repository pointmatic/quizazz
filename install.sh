#!/usr/bin/env bash
# Install the Quizazz builder in editable mode with dev dependencies.
set -euo pipefail

pip install -e "builder[dev]"
