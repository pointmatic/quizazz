// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

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
