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

import { describe, it, expect } from 'vitest';
import { presentAnswers } from '$lib/engine/presentation';
import type { Question } from '$lib/types';

const question: Question = {
	id: 'test-q',
	question: 'Test question?',
	tags: [],
	answers: [
		{ text: 'Correct 1', explanation: 'E', category: 'correct' },
		{ text: 'Correct 2', explanation: 'E', category: 'correct' },
		{ text: 'Partial', explanation: 'E', category: 'partially_correct' },
		{ text: 'Wrong', explanation: 'E', category: 'incorrect' },
		{ text: 'Absurd 1', explanation: 'E', category: 'ridiculous' },
		{ text: 'Absurd 2', explanation: 'E', category: 'ridiculous' }
	],
	topicId: 'test',
	subtopic: null
};

const minQuestion: Question = {
	id: 'min-q',
	question: 'Minimal question?',
	tags: [],
	answers: [
		{ text: 'Correct', explanation: 'E', category: 'correct' },
		{ text: 'Partial', explanation: 'E', category: 'partially_correct' },
		{ text: 'Wrong', explanation: 'E', category: 'incorrect' },
		{ text: 'Absurd 1', explanation: 'E', category: 'ridiculous' },
		{ text: 'Absurd 2', explanation: 'E', category: 'ridiculous' }
	],
	topicId: 'test',
	subtopic: null
};

describe('presentAnswers', () => {
	it('returns exactly 1 correct answer for answerCount=3', () => {
		for (let i = 0; i < 100; i++) {
			const answers = presentAnswers(question, 3);
			const correctCount = answers.filter((a) => a.category === 'correct').length;
			expect(correctCount).toBe(1);
		}
	});

	it('returns exactly 1 correct answer for answerCount=5', () => {
		for (let i = 0; i < 100; i++) {
			const answers = presentAnswers(question, 5);
			const correctCount = answers.filter((a) => a.category === 'correct').length;
			expect(correctCount).toBe(1);
		}
	});

	it('returns correct total count for answerCount=3', () => {
		const answers = presentAnswers(question, 3);
		expect(answers).toHaveLength(3);
	});

	it('returns correct total count for answerCount=4', () => {
		const answers = presentAnswers(question, 4);
		expect(answers).toHaveLength(4);
	});

	it('returns correct total count for answerCount=5', () => {
		const answers = presentAnswers(question, 5);
		expect(answers).toHaveLength(5);
	});

	it('assigns sequential labels', () => {
		const answers3 = presentAnswers(question, 3);
		expect(answers3.map((a) => a.label)).toEqual(['a', 'b', 'c']);

		const answers4 = presentAnswers(question, 4);
		expect(answers4.map((a) => a.label)).toEqual(['a', 'b', 'c', 'd']);

		const answers5 = presentAnswers(question, 5);
		expect(answers5.map((a) => a.label)).toEqual(['a', 'b', 'c', 'd', 'e']);
	});

	it('shuffles answer order (correct not always first)', () => {
		let correctFirstCount = 0;
		const N = 100;

		for (let i = 0; i < N; i++) {
			const answers = presentAnswers(question, 4);
			if (answers[0].category === 'correct') correctFirstCount++;
		}

		// If always first, count would be 100. With shuffling, should be ~25%
		expect(correctFirstCount).toBeLessThan(60);
	});

	it('handles question with exactly 5 answers and answerCount=5', () => {
		const answers = presentAnswers(minQuestion, 5);
		expect(answers).toHaveLength(5);
		const correctCount = answers.filter((a) => a.category === 'correct').length;
		expect(correctCount).toBe(1);
	});
});
