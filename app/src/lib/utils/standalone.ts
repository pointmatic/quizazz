// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import type { QuizManifest } from '$lib/types';

export type StandaloneResolution =
	| { mode: 'unset' }
	| { mode: 'matched'; manifest: QuizManifest }
	| { mode: 'missing'; target: string };

/**
 * Read the standalone-build target from the Vite-exposed env var.
 * Returns `null` when the var is unset, undefined, or empty —
 * each is treated as "no standalone build".
 */
export function getStandaloneTarget(): string | null {
	const v = import.meta.env.VITE_QUIZAZZ_STANDALONE;
	return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Resolve a standalone target name against the bundled manifests.
 * Pure function — separated from `getStandaloneTarget` so tests can
 * exercise the three modes without stubbing `import.meta.env`.
 */
export function resolveStandalone(
	target: string | null | undefined,
	manifests: QuizManifest[]
): StandaloneResolution {
	if (!target) return { mode: 'unset' };
	const found = manifests.find((m) => m.quizName === target);
	if (!found) return { mode: 'missing', target };
	return { mode: 'matched', manifest: found };
}
