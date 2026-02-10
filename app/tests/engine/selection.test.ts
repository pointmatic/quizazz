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
import { selectQuestions } from '$lib/engine/selection';
import type { Question, QuestionScore } from '$lib/types';

function makeQuestion(id: string, tags: string[] = []): Question {
	return {
		id,
		question: `Question ${id}?`,
		tags,
		answers: [
			{ text: 'A', explanation: 'E', category: 'correct' },
			{ text: 'B', explanation: 'E', category: 'partially_correct' },
			{ text: 'C', explanation: 'E', category: 'incorrect' },
			{ text: 'D', explanation: 'E', category: 'ridiculous' },
			{ text: 'E', explanation: 'E', category: 'ridiculous' }
		],
		topicId: 'test',
		subtopic: null
	};
}

const questions = [makeQuestion('q1'), makeQuestion('q2'), makeQuestion('q3')];

describe('selectQuestions', () => {
	it('selects the correct count', () => {
		const scores: QuestionScore[] = questions.map((q) => ({
			questionId: q.id,
			cumulativeScore: 0
		}));
		const result = selectQuestions(questions, scores, 2);
		expect(result).toHaveLength(2);
	});

	it('handles count > pool size (returns all)', () => {
		const scores: QuestionScore[] = questions.map((q) => ({
			questionId: q.id,
			cumulativeScore: 0
		}));
		const result = selectQuestions(questions, scores, 10);
		expect(result).toHaveLength(3);
	});

	it('returns unique questions (no duplicates)', () => {
		const scores: QuestionScore[] = questions.map((q) => ({
			questionId: q.id,
			cumulativeScore: 0
		}));
		const result = selectQuestions(questions, scores, 3);
		const ids = result.map((q) => q.id);
		expect(new Set(ids).size).toBe(3);
	});

	it('lower-scored questions are selected more often', () => {
		const scores: QuestionScore[] = [
			{ questionId: 'q1', cumulativeScore: -20 },
			{ questionId: 'q2', cumulativeScore: 0 },
			{ questionId: 'q3', cumulativeScore: 20 }
		];

		const counts: Record<string, number> = { q1: 0, q2: 0, q3: 0 };
		const N = 10000;

		for (let i = 0; i < N; i++) {
			const result = selectQuestions(questions, scores, 1);
			counts[result[0].id]++;
		}

		// q1 (score -20) should be picked most often
		expect(counts['q1']).toBeGreaterThan(counts['q2']);
		expect(counts['q2']).toBeGreaterThan(counts['q3']);
	});

	it('all questions have nonzero selection probability', () => {
		const scores: QuestionScore[] = [
			{ questionId: 'q1', cumulativeScore: -100 },
			{ questionId: 'q2', cumulativeScore: 0 },
			{ questionId: 'q3', cumulativeScore: 100 }
		];

		const seen = new Set<string>();
		const N = 10000;

		for (let i = 0; i < N; i++) {
			const result = selectQuestions(questions, scores, 1);
			seen.add(result[0].id);
			if (seen.size === 3) break;
		}

		expect(seen.size).toBe(3);
	});
});

describe('selectQuestions with tag filtering', () => {
	const tagged = [
		makeQuestion('q1', ['math', 'science']),
		makeQuestion('q2', ['history']),
		makeQuestion('q3', ['math']),
		makeQuestion('q4', []),
		makeQuestion('q5', ['science', 'history'])
	];

	const scores: QuestionScore[] = tagged.map((q) => ({
		questionId: q.id,
		cumulativeScore: 0
	}));

	it('returns only questions matching the selected tag', () => {
		const result = selectQuestions(tagged, scores, 10, ['history']);
		const ids = result.map((q) => q.id);
		expect(ids.sort()).toEqual(['q2', 'q5']);
	});

	it('empty tag filter returns all questions', () => {
		const result = selectQuestions(tagged, scores, 10, []);
		expect(result).toHaveLength(5);
	});

	it('OR logic: question matching any selected tag is included', () => {
		const result = selectQuestions(tagged, scores, 10, ['math', 'history']);
		const ids = result.map((q) => q.id).sort();
		expect(ids).toEqual(['q1', 'q2', 'q3', 'q5']);
	});

	it('question with no tags is excluded when tags are active', () => {
		const result = selectQuestions(tagged, scores, 10, ['math']);
		const ids = result.map((q) => q.id);
		expect(ids).not.toContain('q4');
	});
});
