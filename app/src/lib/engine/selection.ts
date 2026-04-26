// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import type { Question, QuestionScore } from '$lib/types';
import { weightedRandomIndex } from '$lib/utils/random';

/**
 * Select questions using weighted random sampling without replacement.
 *
 * Weight formula: max_score - score + 1
 * This ensures all weights are positive (minimum weight = 1) and
 * lower-scored questions are more likely to be drawn.
 */
export function selectQuestions(
	questions: Question[],
	scores: QuestionScore[],
	count: number,
	selectedTags: string[] = []
): Question[] {
	const filtered =
		selectedTags.length > 0
			? questions.filter((q) => q.tags.some((t) => selectedTags.includes(t)))
			: questions;

	const scoreMap = new Map(scores.map((s) => [s.questionId, s.cumulativeScore]));
	const maxScore = scores.length > 0 ? Math.max(...scores.map((s) => s.cumulativeScore)) : 0;

	const pool = filtered.map((q) => ({
		question: q,
		weight: maxScore - (scoreMap.get(q.id) ?? 0) + 1
	}));

	const selected: Question[] = [];
	const actualCount = Math.min(count, pool.length);

	for (let i = 0; i < actualCount; i++) {
		const weights = pool.map((item) => item.weight);
		const idx = weightedRandomIndex(weights);
		selected.push(pool[idx].question);
		pool.splice(idx, 1);
	}

	return selected;
}
