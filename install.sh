#!/usr/bin/env bash
# Copyright (c) 2026 Pointmatic
# SPDX-License-Identifier: Apache-2.0

# Install the Quizazz builder in editable mode with dev dependencies.
set -euo pipefail

pip install -e "python[dev]"
