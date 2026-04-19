# Releasing `quizazz` to PyPI

Tag-driven GitHub Actions workflow with PyPI trusted publishing. See [.github/workflows/publish-pypi.yml](../.github/workflows/publish-pypi.yml).

## Versioning

Single project version, loose semver `vX.Y.Z`:

- **X** — breaking change or a big new thing (first public release, manifest-schema break, major API rework).
- **Y** — a feature (one story) or a bundle of stories once production is stable.
- **Z** — bug fixes and trivial changes.

Bump on every release, in both places:

1. [`python/pyproject.toml`](pyproject.toml) `[project].version`
2. [`python/src/quizazz/__init__.py`](src/quizazz/__init__.py) `__version__`

`MANIFEST_SCHEMA_VERSION` in [`python/src/quizazz/__init__.py`](src/quizazz/__init__.py) is a separate protocol marker embedded in every compiled manifest. Bump it only when the manifest shape actually breaks — it doesn't move with every project-version bump.

## One-time setup

Before the first tag push can actually publish, two things need to exist:

1. **GitHub environment `pypi`** — repo → Settings → Environments → New environment → `pypi`. Optional but recommended: add required reviewers or a branch filter so a rogue tag push can't publish without human approval.
2. **PyPI trusted publisher** — on PyPI:
   - If `quizazz` does *not* yet exist on PyPI: Account → Publishing → **Add a pending publisher** with:
     - PyPI Project Name: `quizazz`
     - Owner: `pointmatic`
     - Repository name: `quizazz`
     - Workflow name: `publish-pypi.yml`
     - Environment name: `pypi`
   - If it already exists: open the project → Manage → Publishing → Add a trusted publisher with the same four fields.

Trusted publishing uses GitHub OIDC — no long-lived PyPI token is stored in the repo.

## Release steps (CI path)

```bash
# 1. Commit the version bumps (pyproject.toml + __init__.py)
git commit -am "quizazz v{VERSION}"

# 2. Tag and push
git tag -a v{VERSION} -m "quizazz {VERSION}"
git push origin v{VERSION}
```

The workflow triggers on the tag, runs tests + lint + build + `twine check`, then publishes via trusted publishing. Watch it in the Actions tab.

### Tag convention

Bare `v*` tags (`v1.0.0`, `v1.0.1`, …). When Phase L adds the `@pointmatic/quizazz` npm workflow, it will listen on the same `v*` pattern — bumps to the manifest schema are the cross-package versioning boundary and will usually move both packages in lockstep. Each workflow no-ops if nothing in its tree changed since the previous tag.

## Verify the release

```bash
python -m venv /tmp/quizazz-pypi && \
  /tmp/quizazz-pypi/bin/pip install quizazz=={VERSION}
/tmp/quizazz-pypi/bin/quizazz --version
/tmp/quizazz-pypi/bin/python -c "from quizazz import compile_assessment; print('ok')"
```

## Manual release (fallback)

If the CI path is unavailable (workflow broken, PyPI trusted publishing being reconfigured, etc.):

```bash
pyve run pip install -e './builder[release]'

rm -rf python/dist/ python/build/ python/src/*.egg-info
pyve run python -m build python/
pyve run twine check python/dist/*

# TestPyPI first (needs ~/.pypirc with a [testpypi] token)
pyve run twine upload --repository testpypi python/dist/*

# Production PyPI (needs ~/.pypirc with a [pypi] token)
pyve run twine upload python/dist/*
```

## Rollback

PyPI does **not** allow re-uploading an existing version — once `1.0.0` is published it cannot be overwritten or deleted. If a release is broken:

- Yank the release on PyPI (Manage Project → Releases → Yank). Yanked releases remain installable by explicit version but are excluded from `pip install`'s default resolution.
- Bump the patch version (`1.0.1`) and re-release with the fix.
