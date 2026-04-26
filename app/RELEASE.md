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
   reviewers and/or a branch filter (`main` only) so a stray tag from a
   feature branch can't trigger a publish.
2. **Register the trusted publisher on npmjs.com.** Sign in as a maintainer
   of the `@pointmatic` org → *Account → Trusted Publishers* (or, on the
   `@pointmatic/quizazz` package page, *Settings → Trusted Publishers*) →
   add a publisher with:
   - Owner: `pointmatic`
   - Repository: `quizazz`
   - Workflow filename: `publish-npm.yml`
   - Environment: `npm`

After these one-time steps, the workflow can mint short-lived publish
tokens via OIDC — there is no need to store an `NPM_TOKEN` secret.

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
2. Sets up Node 22 + pnpm 10 with `pnpm install --frozen-lockfile`.
3. Runs `pnpm exec vitest run` (full app suite).
4. Runs `pnpm exec svelte-check --fail-on-warnings` (treats warnings as
   errors — see [story M.a](../docs/specs/stories.md#L287) for why this
   stays warning-clean).
5. Builds the publishable bundle: `pnpm package` (runs `svelte-package` →
   `scripts/build-styles.mjs` → `scripts/clean-dist.mjs`).
6. Validates the package layout: `pnpm publint`.
7. Publishes with `pnpm publish --access public --provenance
   --no-git-checks`. Auth is negotiated via the GitHub OIDC token against
   the npm trusted-publisher config; npm attaches a provenance attestation
   that displays as "Built and signed on GitHub Actions" on the package
   page.

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
