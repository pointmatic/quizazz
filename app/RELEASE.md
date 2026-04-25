# Releasing `@pointmatic/quizazz`

Manual release process for the npm side of Quizazz. CI automation is
deliberately out of scope for 1.1.0 — the cadence is infrequent and the
publish credential lives with the maintainer.

Phase L releases Python and npm packages together in lockstep — see
[`project-essentials.md`](../docs/specs/project-essentials.md) §"One project
version". Bump `python/pyproject.toml`, `python/src/quizazz/__init__.py`,
and `app/package.json` to the same version; stage them in a single commit.

## Preflight

Run from the repo root (the `--dir app` flag targets the app workspace):

```bash
pnpm --dir app exec vitest run              # 168+ tests should pass
pnpm --dir app check                         # 0 errors
pnpm --dir app package                       # builds dist/
pnpm --dir app publint                       # "All good!" expected
```

`pnpm --dir app package` runs `svelte-package -i src/lib -o dist` followed by
`scripts/clean-dist.mjs`, which removes the non-library surface
(`components/QuizChooser.svelte`, `components/ManifestUpload.svelte`,
`components/NavigationTree.svelte`, `components/ConfigView.svelte`,
`utils/validate-manifest.ts`, and `data/`) from `dist/`.

Expected `dist/` shape after a clean build:

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
├── types/         # index.ts
└── utils/         # format.ts, random.ts (note: validate-manifest.ts is excluded)
```

## Dry-run before publishing

```bash
pnpm --dir app publish --dry-run
```

This runs `prepack` hooks (none, currently) and prints the exact tarball that
would be uploaded. Confirm the file list matches the shape above and that the
version number is correct. For a staged release, use
`pnpm --dir app publish --dry-run --tag next` to model publishing under the
`next` dist-tag instead of `latest`.

## Publishing

```bash
# from the repo root, authenticated to npm as a maintainer of @pointmatic
pnpm --dir app publish --access public
```

The `publishConfig.access = "public"` field on `app/package.json` is
defensive — `--access public` on the CLI is still required on the first
publish of a scoped package to an organization that doesn't default to
public.

## Post-publish verification

1. `pnpm view @pointmatic/quizazz version` should print the version you just
   published.
2. In a fresh SvelteKit scratch app: `pnpm add @pointmatic/quizazz` should
   resolve the published version, install `sql.js` as a dependency, and make
   `import { QuizBlock } from '@pointmatic/quizazz'` work. Copy `sql-wasm.wasm`
   to `static/`, render `<QuizBlock>` with a test manifest, and observe that
   the `complete` event fires end-to-end.
3. Tag the release commit in git: `git tag -a npm-v1.1.0 -m "@pointmatic/quizazz 1.1.0"`
   and push. (The PyPI side already drives publishing from bare `v*` tags;
   the `npm-v*` prefix keeps the two channels distinct.)
