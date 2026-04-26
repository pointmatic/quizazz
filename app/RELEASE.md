# Releasing `@pointmatic/quizazz`

The npm side of Quizazz publishes via a tag-driven GitHub Actions workflow
([`.github/workflows/publish-npm.yml`](../.github/workflows/publish-npm.yml))
that mirrors the existing PyPI flow. Pushing an `npm-v*` tag triggers a
preflight + build + publish pipeline that uses npm's OIDC trusted
publishing — no long-lived `NPM_TOKEN` is stored anywhere.

Phase L+ releases Python and npm packages together in lockstep — see
[`project-essentials.md`](../docs/specs/project-essentials.md) §"One project
version". Bump `python/pyproject.toml`, `python/src/quizazz/__init__.py`,
and `app/package.json` to the same version; stage them in a single commit
before tagging.

## One-time setup (developer, before the first CI publish)

These steps are required **once per repository** to enable the OIDC
trusted-publisher relationship. They happen outside the repo (GitHub repo
settings + npmjs.com web UI) and are not version-controlled:

1. **Create the GitHub environment.** In the repo's *Settings → Environments*,
   add an environment named `npm`. Optional but recommended: configure
   reviewers so a publish requires explicit approval.
2. **Allow the tag pattern in the environment's deployment rules.** This is
   the easy-to-miss step. In the same `npm` environment settings, find
   *"Deployment branches and tags"* and switch to **"Selected branches
   and tags"**. Add **two** entries:
   - **Branch**: `main` (lets you trigger ad-hoc workflow runs from `main`
     if you ever add a `workflow_dispatch` trigger).
   - **Tag**: `npm-v*` (this is the one that matters — the publish workflow
     fires on tag push, and the deployment ref is `refs/tags/npm-v*`, not a
     branch ref).

   If you only list `main` (the GitHub UI's first suggestion), the
   workflow will run all the preflight steps successfully but the
   `Publish to npm` step will be blocked at the environment gate with:

   > Tag "npm-vX.Y.Z" is not allowed to deploy to npm due to environment
   > protection rules.

   That rejection happens *before* `pnpm publish` runs, so the npm version
   is still claimable — fix the rule, then re-run the workflow from the
   Actions UI (top-right → *"Re-run all jobs"*). GitHub re-evaluates the
   protection rule at re-run time, so no tag delete-and-re-push is needed.
3. **Register the trusted publisher on npmjs.com.** Sign in as a maintainer
   of the `@pointmatic` org → *Account → Trusted Publishers* (or, on the
   `@pointmatic/quizazz` package page, *Settings → Trusted Publishers*) →
   add a publisher with:
   - Owner: `pointmatic`
   - Repository: `quizazz`
   - Workflow filename: `publish-npm.yml`
   - Environment: `npm`

After these one-time steps, the workflow can mint short-lived publish
tokens via OIDC — there is no need to store an `NPM_TOKEN` secret.

> **PyPI parallels.** The PyPI side has the same trio of one-time
> requirements against the `pypi` environment and the
> [`publish-pypi.yml`](../.github/workflows/publish-pypi.yml) workflow,
> with the deployment-tag pattern set to `v*` (bare, no `npm-` prefix).
> If `pypi` was first set up before tag-based deployment protection
> rules were tightened, double-check it has a `Tag: v*` entry too —
> otherwise the next `vX.Y.Z` push will hit the same rejection.

## Publishing (CI flow — primary)

```bash
# 1. Bump the version in three places (lockstep) and commit.
#    See project-essentials.md §"One project version".
$EDITOR python/pyproject.toml          # [project].version = "X.Y.Z"
$EDITOR python/src/quizazz/__init__.py # __version__ = "X.Y.Z"
$EDITOR app/package.json               # "version": "X.Y.Z"
git add -p
git commit -m "Release X.Y.Z"

# 2. Push the bump.
git push

# 3. Tag and push for npm.
git tag -a npm-vX.Y.Z -m "@pointmatic/quizazz X.Y.Z"
git push origin npm-vX.Y.Z

# 4. (Optional, separate from npm) Tag for PyPI.
git tag -a vX.Y.Z -m "quizazz X.Y.Z"
git push origin vX.Y.Z
```

The `npm-vX.Y.Z` tag triggers
[`publish-npm.yml`](../.github/workflows/publish-npm.yml), which:

1. Checks out the tag.
2. Sets up Node 24 + pnpm 10 with `pnpm install --frozen-lockfile`. (The
   project supports Node 22+ at runtime; Node 24 is used in CI because
   it ships npm 11.x natively, which is where trusted-publishing OIDC
   support is robust. Trying to upgrade in place from Node 22's bundled
   npm 10.x via `npm install -g npm@latest` fails on certain Node 22
   patch releases.)
3. Runs `pnpm exec vitest run` (full app suite).
4. Runs `pnpm exec svelte-check --fail-on-warnings` (treats warnings as
   errors — see [story M.a](../docs/specs/stories.md#L287) for why this
   stays warning-clean).
5. Builds the publishable bundle: `pnpm package` (runs `svelte-package` →
   `scripts/build-styles.mjs` → `scripts/clean-dist.mjs`).
6. Validates the package layout: `pnpm publint`.
7. Publishes with `npm publish --access public --provenance`. Auth is
   negotiated via the GitHub OIDC token against the npm trusted-publisher
   config; npm attaches a provenance attestation that displays as "Built
   and signed on GitHub Actions" on the package page.

> **Why `npm publish` and not `pnpm publish`** for the final step: as of
> pnpm 10.x, `pnpm publish` forwards `--provenance` (which produces the
> sigstore signature) but doesn't fully implement npm's OIDC
> trusted-publishing handshake — it falls through expecting a stored
> `NPM_TOKEN` and hits a 404 on the actual registry PUT. The build,
> install, validate, and test steps still use pnpm so the rest of the
> workflow shape matches local dev.

The `v*` tag (without `npm-` prefix) drives the existing PyPI publish
workflow ([`.github/workflows/publish-pypi.yml`](../.github/workflows/publish-pypi.yml)).
The two channels are deliberately distinct so a Python-only or npm-only
hotfix can ship without dragging the other along — though both packages
are version-locked, so in practice tags are usually pushed in pairs.

### Expected `dist/` shape after a clean build

```
dist/
├── components/
│   ├── AnsweredQuestionsView.svelte(.d.ts)
│   ├── ProgressBar.svelte(.d.ts)
│   ├── QuizView.svelte(.d.ts)
│   ├── ReviewView.svelte(.d.ts)
│   └── SummaryView.svelte(.d.ts)
├── db/            # database.ts, scores.ts, index.ts
├── embed/         # QuizBlock.svelte, index.{js,d.ts}, schema-version.{js,d.ts}, README.md
├── engine/        # lifecycle.ts, selection.ts, presentation.ts, scoring.ts, mastery.ts
├── stores/        # manifest.ts, quiz.ts
├── styles.css     # precompiled Tailwind bundle (~13 KB minified, no preflight)
├── types/         # index.ts
└── utils/         # format.ts, random.ts (note: validate-manifest.ts is excluded)
```

## Publishing (manual flow — fallback)

Reserved for emergency / offline use, or if the CI workflow is broken. The
manual flow does **not** produce a provenance attestation (the npm web UI
will show the package as unsigned), so the CI flow is preferred whenever
it works.

### Preflight (run from the repo root)

```bash
pnpm --dir app exec vitest run               # full app suite should pass
pnpm --dir app check                          # 0 errors, 0 warnings
pnpm --dir app package                        # builds dist/ (incl. styles.css)
pnpm --dir app publint                        # "All good!" expected
```

### Dry-run

```bash
pnpm --dir app publish --dry-run
```

This runs `prepack` hooks (none, currently) and prints the exact tarball
that would be uploaded. Confirm the file list matches the shape above and
that the version number is correct. For a staged release, use
`pnpm --dir app publish --dry-run --tag next` to model publishing under
the `next` dist-tag instead of `latest`.

### Publish

```bash
# from the repo root, authenticated to npm as a maintainer of @pointmatic
pnpm --dir app publish --access public
```

The `publishConfig.access = "public"` field on `app/package.json` is
defensive — `--access public` on the CLI is still required on the first
publish of a scoped package to an organization that doesn't default to
public. After a manual publish, still tag the release commit with
`npm-vX.Y.Z` so the git history matches the published version.

## Post-publish verification

Same for both flows:

1. `pnpm view @pointmatic/quizazz version` should print the version you
   just published.
2. (CI flow only) Confirm the package page on npmjs.com shows the
   "Built and signed on GitHub Actions" provenance attestation.
3. In a fresh SvelteKit scratch app: `pnpm add @pointmatic/quizazz` should
   resolve the published version, install `sql.js` as a dependency, and
   make `import { QuizBlock } from '@pointmatic/quizazz'` work. Add the
   one-line styles import (`import '@pointmatic/quizazz/styles.css'`),
   copy the sql.js WASM into `static/`, disable SSR on the embedding
   route, render `<QuizBlock>` with a test manifest, and observe that the
   `complete` event fires end-to-end.
