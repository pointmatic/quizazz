// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import type { AnswerCategory } from '$lib/types';

export const SCORE_MAP: Record<AnswerCategory, number> = {
	correct: 1,
	partially_correct: -2,
	incorrect: -5,
	ridiculous: -10
};

export function scoreAnswer(category: AnswerCategory): number {
	return SCORE_MAP[category];
}
