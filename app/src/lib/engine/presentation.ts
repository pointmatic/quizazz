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

import type { Answer, PresentedAnswer, Question } from '$lib/types';
import { shuffle } from '$lib/utils/random';

const LABELS = ['a', 'b', 'c', 'd', 'e'];

/**
 * Select and present answers for a question.
 *
 * 1. Pick one random correct answer.
 * 2. Collect all non-correct answers into a pool.
 * 3. Randomly pick (answerCount - 1) from the pool.
 * 4. Combine, shuffle, and assign labels.
 */
export function presentAnswers(question: Question, answerCount: 3 | 4 | 5): PresentedAnswer[] {
	const correct = question.answers.filter((a) => a.category === 'correct');
	const others = question.answers.filter((a) => a.category !== 'correct');

	const chosenCorrect = correct[Math.floor(Math.random() * correct.length)];

	const shuffledOthers = shuffle(others);
	const chosenOthers = shuffledOthers.slice(0, answerCount - 1);

	const combined: Answer[] = [chosenCorrect, ...chosenOthers];
	const shuffled = shuffle(combined);

	return shuffled.map((answer, i) => ({
		...answer,
		label: LABELS[i]
	}));
}
