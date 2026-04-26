// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');

const excludedPaths = [
	'data',
	'components/QuizChooser.svelte',
	'components/QuizChooser.svelte.d.ts',
	'components/ManifestUpload.svelte',
	'components/ManifestUpload.svelte.d.ts',
	'components/NavigationTree.svelte',
	'components/NavigationTree.svelte.d.ts',
	'components/ConfigView.svelte',
	'components/ConfigView.svelte.d.ts',
	'utils/validate-manifest.ts',
	'utils/validate-manifest.d.ts',
	// `embed/styles.css` is the *source* for the precompiled bundle —
	// `svelte-package` copies it verbatim, but the published artifact lives
	// at `dist/styles.css` (built by `scripts/build-styles.mjs`).
	'embed/styles.css'
];

for (const rel of excludedPaths) {
	const abs = resolve(distDir, rel);
	await rm(abs, { recursive: true, force: true });
}

console.log(`clean-dist: removed ${excludedPaths.length} paths from ${distDir}`);
