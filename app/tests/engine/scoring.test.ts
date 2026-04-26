// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { scoreAnswer, SCORE_MAP } from '$lib/engine/scoring';

describe('scoreAnswer', () => {
	it('correct → +1', () => {
		expect(scoreAnswer('correct')).toBe(1);
	});

	it('partially_correct → -2', () => {
		expect(scoreAnswer('partially_correct')).toBe(-2);
	});

	it('incorrect → -5', () => {
		expect(scoreAnswer('incorrect')).toBe(-5);
	});

	it('ridiculous → -10', () => {
		expect(scoreAnswer('ridiculous')).toBe(-10);
	});
});

describe('SCORE_MAP', () => {
	it('has all four categories', () => {
		expect(Object.keys(SCORE_MAP).sort()).toEqual([
			'correct',
			'incorrect',
			'partially_correct',
			'ridiculous'
		]);
	});
});
