// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { shuffle, weightedRandomIndex } from '$lib/utils/random';

describe('shuffle', () => {
	it('returns all elements', () => {
		const input = [1, 2, 3, 4, 5];
		const result = shuffle(input);
		expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
	});

	it('does not mutate the original array', () => {
		const input = [1, 2, 3, 4, 5];
		const copy = [...input];
		shuffle(input);
		expect(input).toEqual(copy);
	});

	it('returns same length', () => {
		const input = [1, 2, 3];
		expect(shuffle(input)).toHaveLength(3);
	});

	it('handles empty array', () => {
		expect(shuffle([])).toEqual([]);
	});

	it('handles single element', () => {
		expect(shuffle([42])).toEqual([42]);
	});
});

describe('weightedRandomIndex', () => {
	it('returns 0 for single-element weights', () => {
		expect(weightedRandomIndex([1])).toBe(0);
	});

	it('respects weights over many iterations', () => {
		const weights = [10, 1];
		const counts = [0, 0];
		const N = 10000;

		for (let i = 0; i < N; i++) {
			counts[weightedRandomIndex(weights)]++;
		}

		// Index 0 should be picked ~10x more than index 1
		const ratio = counts[0] / counts[1];
		expect(ratio).toBeGreaterThan(5);
		expect(ratio).toBeLessThan(20);
	});

	it('never returns out-of-bounds index', () => {
		const weights = [1, 1, 1];
		for (let i = 0; i < 1000; i++) {
			const idx = weightedRandomIndex(weights);
			expect(idx).toBeGreaterThanOrEqual(0);
			expect(idx).toBeLessThan(3);
		}
	});
});
