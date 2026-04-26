// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

/**
 * Fisher-Yates shuffle. Returns a new array; does not mutate the original.
 */
export function shuffle<T>(array: T[]): T[] {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

/**
 * Pick a random index proportional to the given weights.
 * All weights must be positive.
 */
export function weightedRandomIndex(weights: number[]): number {
	const total = weights.reduce((sum, w) => sum + w, 0);
	let r = Math.random() * total;
	for (let i = 0; i < weights.length; i++) {
		r -= weights[i];
		if (r <= 0) return i;
	}
	return weights.length - 1;
}
