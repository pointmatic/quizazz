// Copyright (c) 2026 Pointmatic
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
