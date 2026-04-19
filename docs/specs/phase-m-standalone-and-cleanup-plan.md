# Phase M Plan — Standalone SPA Packaging and Housekeeping

Combined mini-concept / features / tech-spec for Phase M.

For full specifications see [`concept.md`](concept.md), [`features.md`](features.md), [`tech-spec.md`](tech-spec.md). Phase M is the third and final phase in the UC-3-era plan and cleans up two items deliberately deferred from Phases K and L:

| Phase | Scope |
|-------|-------|
| K (planned) | Python library API + PyPI release |
| L (planned) | `<QuizBlock>` component + npm release |
| **M (this plan)** | UC-1 `quizazz build --standalone <name>`; legacy CLI removal; SPDX-header retrofit |

Phase M has no learningfoundry dependency. It is pure project-internal: finish the features.md surface (UC-1 proper), remove dead code paths (legacy CLI scripts), and normalize source-file headers (SPDX-only).

---

## Gap Analysis

### UC-1 standalone build

**What exists:** The app already auto-selects a single manifest when `manifests.length === 1` (the `import.meta.glob` pattern in `app/src/lib/data/index.ts` emergently makes standalone-mode "work" by convention). But there's no CLI affordance to *produce* a single-manifest build from a repo that has many quizzes, and the `ManifestUpload` chooser UI remains visible when a user does happen to have only one manifest. Features.md FR-17 and the tech-spec's "Standalone build mechanics" section both call for a dedicated `--standalone` flag.

**What's needed:**
- `quizazz build --standalone <quiz-name>` subcommand flag.
- Staging of only the named manifest during the Vite build; other manifests temporarily moved aside and restored after.
- Environment variable contract: `QUIZAZZ_STANDALONE=<name>` plus the `VITE_`-prefixed variant `VITE_QUIZAZZ_STANDALONE=<name>` (Vite only exposes the latter to `import.meta.env`).
- `+page.svelte` reads `import.meta.env.VITE_QUIZAZZ_STANDALONE`; when set, hides `ManifestUpload`, auto-selects the single manifest, bypasses the chooser even if runtime upload had added other manifests (defensive: standalone means one quiz, period).
- Robust cleanup on success, failure, or interruption — the source tree must not end up with manifests stashed in a temp directory after a failed build.

### Legacy CLI script removal

**What exists:** `builder/pyproject.toml` still lists two legacy console scripts alongside the canonical one:

```toml
[project.scripts]
quizazz = "quizazz_builder.cli:main"
quizazz-builder = "quizazz_builder.__main__:main"
quizazz_builder = "quizazz_builder.__main__:main"
```

These were carried as backward-compat shims that print a deprecation notice. The user's Phase-K-era decision was to nuke them; the tech-spec has already been updated to reflect a single `quizazz` entry point. Phase M makes the code match.

**What's needed:**
- Drop the `quizazz-builder` and `quizazz_builder` entries from `[project.scripts]`.
- Simplify `__main__.py` to a thin delegator to `cli.main` (retain `python -m quizazz_builder` as a standard Python invocation path).
- Remove any deprecation-notice code in `__main__.py`.
- Note: this is a breaking change at the shell level for anyone who invoked `quizazz-builder` or `quizazz_builder` directly. Shipped in the next PyPI patch release of `quizazz-builder` (1.0.1 or similar) — document in the release notes.

### SPDX header retrofit

**What exists:** Every source file in the repo currently carries the full 14-line Apache-2.0 boilerplate (copyright + license recital + disclaimer paragraph). Project-essentials was updated in Phase K to require SPDX-only for new files; existing files are untouched by design.

**What's needed:** Replace the full boilerplate in every existing source file with the 2-line SPDX variant defined in project-essentials:

```
// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0
```

(With appropriate comment syntax per file type.)

Scope covers: every `.py` in `builder/src/` and `builder/tests/`, every `.ts` / `.svelte` / `.css` in `app/src/`, `install.sh`, and any other source file that currently carries the full boilerplate. Excluded: generated artifacts (`app/src/lib/data/*.json`, `app/static/sql-wasm.wasm`), third-party-vendored files (none currently), the `LICENSE` file itself, and config files that don't normally carry license headers (`pyproject.toml`, `svelte.config.js`, etc.) if they don't already have them.

---

## Feature Requirements (mini-features)

### FM-1: `quizazz build --standalone <quiz-name>` flag

Extends `cli.cmd_build`:

- Accepts `--standalone <quiz-name>` (optional). When absent, behavior is unchanged from today.
- When present:
  1. Validates that `<quiz-name>.json` exists in `app/src/lib/data/` (or wherever `--output` points). Fails with a clear error if not.
  2. Moves every other `*.json` file in that directory to a `TemporaryDirectory`.
  3. Sets `QUIZAZZ_STANDALONE=<quiz-name>` and `VITE_QUIZAZZ_STANDALONE=<quiz-name>` in the environment passed to the `pnpm --dir app build` subprocess.
  4. Runs the pnpm build.
  5. **Unconditionally** restores the moved manifests — on success, on pnpm failure, on exception, and on SIGINT. Uses a `try/finally` block with signal handling.
  6. Exits 0 on pnpm success, 1 otherwise.
- Staging is a no-op when only the target manifest exists; no temp dir is created.

### FM-2: App standalone-mode behavior

`+page.svelte` gains a module-level read of `import.meta.env.VITE_QUIZAZZ_STANDALONE`:

- When **unset** (UC-2 mode, current default): existing behavior. Chooser shown for multiple manifests; upload UI visible; single manifest auto-selected.
- When **set to `<name>`** (UC-1 standalone mode):
  - Expect `manifests` to contain exactly one entry matching `<name>`. If zero or mismatch, render a build-misconfiguration error state (explicit, not a blank screen).
  - Do **not** render `ManifestUpload` — runtime upload is disabled in standalone builds.
  - Do not enter the `chooser` view. Auto-advance directly to `nav`.
  - Even if `uploadedManifests` somehow gains entries (defensive), ignore them.

### FM-3: Legacy CLI console scripts removed

`builder/pyproject.toml`:

```toml
[project.scripts]
quizazz = "quizazz_builder.cli:main"
```

`builder/src/quizazz_builder/__main__.py`:

```python
# Copyright (c) 2026 Pointmatic
# SPDX-License-Identifier: Apache-2.0

"""Module entry point for `python -m quizazz_builder`."""
from quizazz_builder.cli import main

if __name__ == "__main__":
    main()
```

Any deprecation-notice code is removed. After this change, `quizazz-builder` and `quizazz_builder` shell commands no longer exist; users must use `quizazz` or `python -m quizazz_builder`.

### FM-4: SPDX-only headers across the repo

Every existing source file currently carrying the full Apache-2.0 boilerplate is rewritten to the 2-line SPDX variant using the comment syntax for its file type (per project-essentials):

- Python, YAML, shell: `#`
- TypeScript, JavaScript: `//`
- Svelte, HTML: `<!-- -->`
- CSS, SCSS: `/* */`

Copyright line stays year `2026` (the project's current copyright year); if a file has an older year, leave the older year in place (conventions vary; this project uses single-year, not ranges). If a file was authored in an earlier year that's been retained, preserve it.

No behavior change. Pure mechanical refactor verifiable by diff: every changed file has its boilerplate block replaced by two lines; nothing else changes.

---

## Technical Changes (mini-tech-spec)

### Modified modules (FM-1, FM-2)

| File | Change |
|------|--------|
| `builder/src/quizazz_builder/cli.py` | Add `--standalone <quiz-name>` to the `build` subparser. Implement the staging logic (move out → set env → run pnpm → restore in `finally`). Handle SIGINT via `signal.signal(SIGINT, …)` to ensure restore runs on Ctrl+C. |
| `app/src/routes/+page.svelte` | Read `import.meta.env.VITE_QUIZAZZ_STANDALONE`. When set: filter `manifests` to the named one, refuse to render `ManifestUpload`, skip the chooser, render a build-misconfiguration error if the named manifest is absent. |
| `builder/tests/test_cli.py` | Add tests for standalone staging: named manifest exists → stages + runs; named manifest missing → fails with message; multi-manifest scenario → others moved out + restored; interrupt simulation → restore happens. |
| `app/tests/integration/` (new test file or existing) | Test `+page.svelte` standalone-mode branches via env-var mocking. |

### Modified modules (FM-3)

| File | Change |
|------|--------|
| `builder/pyproject.toml` | Remove `quizazz-builder` and `quizazz_builder` from `[project.scripts]`. |
| `builder/src/quizazz_builder/__main__.py` | Simplify to delegator. Drop deprecation-notice code. |
| Any test that invoked the legacy commands | Update to `quizazz` or `python -m quizazz_builder`. |

### Modified modules (FM-4)

Repo-wide header substitution. No logic change. Automatable via a sed/ruff script (the substitution is deterministic: replace the full boilerplate block with the SPDX two-liner, preserving the copyright year and owner).

Files touched (non-exhaustive, to be verified during the story):
- `builder/src/quizazz_builder/**/*.py`
- `builder/tests/**/*.py`
- `app/src/**/*.ts`
- `app/src/**/*.svelte`
- `app/src/app.css`
- `install.sh`

Config files without existing headers (`pyproject.toml`, `svelte.config.js`, `vite.config.ts`, etc.) do not gain headers in Phase M — follow project-essentials' convention that config files carry no per-file license header.

### Staging implementation sketch (FM-1)

```python
# builder/src/quizazz_builder/cli.py (sketch)
import signal
import tempfile
from contextlib import contextmanager

@contextmanager
def _stage_standalone(data_dir: Path, target_name: str):
    target = data_dir / f"{target_name}.json"
    if not target.is_file():
        print(f"Error: manifest {target} not found. Run `quizazz generate` first.", file=sys.stderr)
        sys.exit(1)

    others = [p for p in data_dir.glob("*.json") if p.name != target.name]
    with tempfile.TemporaryDirectory() as stash:
        moved: list[tuple[Path, Path]] = []
        try:
            for p in others:
                dest = Path(stash) / p.name
                shutil.move(str(p), str(dest))
                moved.append((p, dest))
            yield
        finally:
            for orig, dest in moved:
                shutil.move(str(dest), str(orig))

def cmd_build(args):
    data_dir = Path("app/src/lib/data")
    if args.standalone:
        with _stage_standalone(data_dir, args.standalone):
            env = {**os.environ,
                   "QUIZAZZ_STANDALONE": args.standalone,
                   "VITE_QUIZAZZ_STANDALONE": args.standalone}
            result = subprocess.run(["pnpm", "--dir", "app", "build"], env=env)
            sys.exit(result.returncode)
    else:
        # existing behavior
        ...
```

SIGINT handling: Python's default SIGINT behavior (KeyboardInterrupt) will unwind the `with` block, running the `finally`. No extra signal handler is strictly required, but the story should verify this by simulating interrupt in tests.

### Data model changes

None.

### New dependencies

None.

---

## Out of Scope

- **Multi-standalone builds** (e.g., `--standalone quiz-a,quiz-b`). v1 supports exactly one standalone quiz per build. Multi-quiz is UC-2.
- **Host-side custom WASM paths** in `<QuizBlock>` — Future Vision, not Phase M.
- **Config-file per-file license headers** (for `pyproject.toml`, `svelte.config.js`, etc.) — these don't conventionally carry headers and are left untouched.
- **CI-based SPDX lint enforcement** — the retrofit is one-shot; enforcement for new files relies on the project-essentials convention and code review.
- **`app/package.json` rename of the repo-level package** — Phase L changed `name` to `@pointmatic/quizazz` for publishing; if that was done by changing the repo's root app package name, no further rename is needed in Phase M.

---

## Constraints

- **Phase L must be landed first.** FM-2 and Phase L share `+page.svelte` edits; resolving them serially avoids a merge headache.
- **No UC-2 regression.** Builds without `--standalone` must behave exactly as they do today.
- **No legacy-CLI silent break.** The removal of `quizazz-builder` and `quizazz_builder` should be flagged in the PyPI release notes; users who had been relying on them get a clean "command not found" rather than a surprise behavior change.
- **SPDX retrofit is verify-only.** No file's semantic content may change in the retrofit PR; the diff is purely header replacement. If a diff shows anything else, reject and redo.
- **Test suite stays green.** All existing tests pass; new staging/standalone tests add to the count.
