// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import type { QuestionScore } from '$lib/types';

export interface MasteryScore {
	total: number;
	positive: number;
	percent: number;
}

export function computeMastery(questionIds: string[], scores: QuestionScore[]): MasteryScore {
	if (questionIds.length === 0) {
		return { total: 0, positive: 0, percent: 0 };
	}

	const scoreMap = new Map(scores.map((s) => [s.questionId, s.cumulativeScore]));
	const total = questionIds.length;
	let positive = 0;

	for (const id of questionIds) {
		const score = scoreMap.get(id) ?? 0;
		if (score > 0) {
			positive++;
		}
	}

	const percent = Math.round((positive / total) * 100);
	return { total, positive, percent };
}
