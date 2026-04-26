// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { computeMastery } from '$lib/engine/mastery';
import type { QuestionScore } from '$lib/types';

describe('computeMastery', () => {
	it('returns 0% when all scores are zero', () => {
		const questionIds = ['q1', 'q2', 'q3'];
		const scores: QuestionScore[] = [
			{ questionId: 'q1', cumulativeScore: 0 },
			{ questionId: 'q2', cumulativeScore: 0 },
			{ questionId: 'q3', cumulativeScore: 0 }
		];
		const result = computeMastery(questionIds, scores);
		expect(result).toEqual({ total: 3, positive: 0, percent: 0 });
	});

	it('returns 100% when all scores are positive', () => {
		const questionIds = ['q1', 'q2', 'q3'];
		const scores: QuestionScore[] = [
			{ questionId: 'q1', cumulativeScore: 5 },
			{ questionId: 'q2', cumulativeScore: 1 },
			{ questionId: 'q3', cumulativeScore: 10 }
		];
		const result = computeMastery(questionIds, scores);
		expect(result).toEqual({ total: 3, positive: 3, percent: 100 });
	});

	it('returns correct percentage for mixed scores', () => {
		const questionIds = ['q1', 'q2', 'q3', 'q4'];
		const scores: QuestionScore[] = [
			{ questionId: 'q1', cumulativeScore: 5 },
			{ questionId: 'q2', cumulativeScore: 0 },
			{ questionId: 'q3', cumulativeScore: 3 },
			{ questionId: 'q4', cumulativeScore: 0 }
		];
		const result = computeMastery(questionIds, scores);
		expect(result).toEqual({ total: 4, positive: 2, percent: 50 });
	});

	it('returns 0 total and 0% for empty questionIds', () => {
		const scores: QuestionScore[] = [{ questionId: 'q1', cumulativeScore: 5 }];
		const result = computeMastery([], scores);
		expect(result).toEqual({ total: 0, positive: 0, percent: 0 });
	});

	it('treats negative scores as not mastered', () => {
		const questionIds = ['q1', 'q2', 'q3'];
		const scores: QuestionScore[] = [
			{ questionId: 'q1', cumulativeScore: -5 },
			{ questionId: 'q2', cumulativeScore: 3 },
			{ questionId: 'q3', cumulativeScore: -1 }
		];
		const result = computeMastery(questionIds, scores);
		expect(result).toEqual({ total: 3, positive: 1, percent: 33 });
	});

	it('treats missing scores as zero (not mastered)', () => {
		const questionIds = ['q1', 'q2'];
		const scores: QuestionScore[] = [{ questionId: 'q1', cumulativeScore: 5 }];
		const result = computeMastery(questionIds, scores);
		expect(result).toEqual({ total: 2, positive: 1, percent: 50 });
	});

	it('rounds percentage correctly', () => {
		const questionIds = ['q1', 'q2', 'q3'];
		const scores: QuestionScore[] = [
			{ questionId: 'q1', cumulativeScore: 1 },
			{ questionId: 'q2', cumulativeScore: 0 },
			{ questionId: 'q3', cumulativeScore: 0 }
		];
		const result = computeMastery(questionIds, scores);
		// 1/3 = 33.33... → rounds to 33
		expect(result).toEqual({ total: 3, positive: 1, percent: 33 });
	});
});
