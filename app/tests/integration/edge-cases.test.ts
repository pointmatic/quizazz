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

import { describe, it, expect, beforeEach, vi } from 'vitest';
import initSqlJs, { type Database } from 'sql.js';
import { get } from 'svelte/store';
import { createSchema } from '$lib/db/database';
import { seedScores, getScores, updateScore } from '$lib/db/scores';
import { quizSession, viewMode, reviewIndex } from '$lib/stores/quiz';
import { startQuiz, submitAnswer } from '$lib/engine/lifecycle';
import { selectQuestions } from '$lib/engine/selection';
import { presentAnswers } from '$lib/engine/presentation';
import type { Question, QuestionScore } from '$lib/types';

// Mock persistDatabase to avoid IndexedDB in tests
vi.mock('$lib/db', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/db')>();
	return {
		...actual,
		persistDatabase: vi.fn().mockResolvedValue(undefined)
	};
});

// --- Test fixtures ---

function makeQuestion(id: string, numAnswers: number = 5): Question {
	const answers: Question['answers'] = [
		{ text: `Correct for ${id}`, explanation: 'This is correct', category: 'correct' }
	];
	const categories: Array<'partially_correct' | 'incorrect' | 'ridiculous'> = [
		'partially_correct',
		'incorrect',
		'ridiculous'
	];
	for (let i = 1; i < numAnswers; i++) {
		const cat = categories[(i - 1) % categories.length];
		answers.push({
			text: `Answer ${i} for ${id}`,
			explanation: `Explanation ${i}`,
			category: cat
		});
	}
	return { id, question: `Question ${id}?`, tags: [], answers, topicId: 'test', subtopic: null };
}

function makeQuestions(count: number, answersPerQuestion: number = 5): Question[] {
	return Array.from({ length: count }, (_, i) => makeQuestion(`q${i + 1}`, answersPerQuestion));
}

let db: Database;

function resetStores() {
	quizSession.set(null);
	viewMode.set('config');
	reviewIndex.set(null);
}

beforeEach(async () => {
	const SQL = await initSqlJs();
	db = new SQL.Database();
	createSchema(db);
	resetStores();
});

describe('quiz with 1 question', () => {
	it('starts and completes with a single question', async () => {
		const questions = makeQuestions(1);
		seedScores(db, questions.map((q) => q.id));
		const scores = getScores(db);

		startQuiz({ questionCount: 1, answerCount: 4, selectedTags: [], selectedNodeIds: [] }, questions, scores, db);
		expect(get(quizSession)!.questions).toHaveLength(1);

		const s = get(quizSession)!;
		await submitAnswer(s.questions[0].presentedAnswers[0].label, db);
		expect(get(viewMode)).toBe('summary');
		expect(get(quizSession)!.completed).toBe(true);
	});
});

describe('quiz with max questions (all in bank)', () => {
	it('selects all questions when count equals pool size', () => {
		const questions = makeQuestions(6);
		seedScores(db, questions.map((q) => q.id));
		const scores = getScores(db);

		startQuiz({ questionCount: 6, answerCount: 4, selectedTags: [], selectedNodeIds: [] }, questions, scores, db);
		expect(get(quizSession)!.questions).toHaveLength(6);

		const selectedIds = get(quizSession)!.questions.map((q) => q.question.id);
		const uniqueIds = new Set(selectedIds);
		expect(uniqueIds.size).toBe(6);
	});

	it('handles count > pool size gracefully', () => {
		const questions = makeQuestions(3);
		seedScores(db, questions.map((q) => q.id));
		const scores = getScores(db);

		startQuiz({ questionCount: 10, answerCount: 4, selectedTags: [], selectedNodeIds: [] }, questions, scores, db);
		expect(get(quizSession)!.questions).toHaveLength(3);
	});
});

describe('answer choice counts', () => {
	it('presents 3 answer choices', () => {
		const questions = makeQuestions(1, 6);
		seedScores(db, questions.map((q) => q.id));
		const scores = getScores(db);

		startQuiz({ questionCount: 1, answerCount: 3, selectedTags: [], selectedNodeIds: [] }, questions, scores, db);
		expect(get(quizSession)!.questions[0].presentedAnswers).toHaveLength(3);
	});

	it('presents 4 answer choices', () => {
		const questions = makeQuestions(1, 6);
		seedScores(db, questions.map((q) => q.id));
		const scores = getScores(db);

		startQuiz({ questionCount: 1, answerCount: 4, selectedTags: [], selectedNodeIds: [] }, questions, scores, db);
		expect(get(quizSession)!.questions[0].presentedAnswers).toHaveLength(4);
	});

	it('presents 5 answer choices', () => {
		const questions = makeQuestions(1, 6);
		seedScores(db, questions.map((q) => q.id));
		const scores = getScores(db);

		startQuiz({ questionCount: 1, answerCount: 5, selectedTags: [], selectedNodeIds: [] }, questions, scores, db);
		expect(get(quizSession)!.questions[0].presentedAnswers).toHaveLength(5);
	});
});

describe('question with exactly 5 answers (minimum)', () => {
	it('presents all 5 answers when answerCount is 5', () => {
		const q = makeQuestion('q-min', 5);
		const presented = presentAnswers(q, 5);
		expect(presented).toHaveLength(5);

		const hasCorrect = presented.some((a) => a.category === 'correct');
		expect(hasCorrect).toBe(true);
	});

	it('presents 4 of 5 answers when answerCount is 4', () => {
		const q = makeQuestion('q-min', 5);
		const presented = presentAnswers(q, 4);
		expect(presented).toHaveLength(4);

		const hasCorrect = presented.some((a) => a.category === 'correct');
		expect(hasCorrect).toBe(true);
	});

	it('presents 3 of 5 answers when answerCount is 3', () => {
		const q = makeQuestion('q-min', 5);
		const presented = presentAnswers(q, 3);
		expect(presented).toHaveLength(3);

		const hasCorrect = presented.some((a) => a.category === 'correct');
		expect(hasCorrect).toBe(true);
	});
});

describe('question with many answers (10+)', () => {
	it('handles question with 12 answers', () => {
		const q = makeQuestion('q-many', 12);
		expect(q.answers).toHaveLength(12);

		for (const count of [3, 4, 5] as const) {
			const presented = presentAnswers(q, count);
			expect(presented).toHaveLength(count);
			const hasCorrect = presented.some((a) => a.category === 'correct');
			expect(hasCorrect).toBe(true);
		}
	});

	it('selects from large question bank correctly', () => {
		const questions = makeQuestions(20, 8);
		seedScores(db, questions.map((q) => q.id));
		const scores = getScores(db);

		startQuiz({ questionCount: 5, answerCount: 4, selectedTags: [], selectedNodeIds: [] }, questions, scores, db);
		expect(get(quizSession)!.questions).toHaveLength(5);

		const ids = get(quizSession)!.questions.map((q) => q.question.id);
		expect(new Set(ids).size).toBe(5);
	});
});

describe('fresh database (no prior scores)', () => {
	it('works with all scores at 0', () => {
		const questions = makeQuestions(5);
		seedScores(db, questions.map((q) => q.id));
		const scores = getScores(db);

		// All scores should be 0
		for (const s of scores) {
			expect(s.cumulativeScore).toBe(0);
		}

		startQuiz({ questionCount: 3, answerCount: 4, selectedTags: [], selectedNodeIds: [] }, questions, scores, db);
		expect(get(quizSession)!.questions).toHaveLength(3);
	});

	it('works with empty scores array', () => {
		const questions = makeQuestions(3);
		const scores: QuestionScore[] = [];

		startQuiz({ questionCount: 2, answerCount: 4, selectedTags: [], selectedNodeIds: [] }, questions, scores, db);
		expect(get(quizSession)!.questions).toHaveLength(2);
	});
});

describe('uniform scores (all same)', () => {
	it('selects questions when all have identical scores', () => {
		const questions = makeQuestions(6);
		seedScores(db, questions.map((q) => q.id));
		// Set all to score 5
		for (const q of questions) {
			updateScore(db, q.id, 5);
		}
		const scores = getScores(db);

		// All weights should be equal → uniform selection
		const selected = selectQuestions(questions, scores, 3);
		expect(selected).toHaveLength(3);

		const ids = selected.map((q) => q.id);
		expect(new Set(ids).size).toBe(3);
	});
});

describe('very negative score (should be selected frequently)', () => {
	it('heavily negative-scored question is selected more often', () => {
		const questions = makeQuestions(5);
		seedScores(db, questions.map((q) => q.id));

		// Give q1 a very negative score, others positive
		updateScore(db, 'q1', -50);
		for (let i = 2; i <= 5; i++) {
			updateScore(db, `q${i}`, 10);
		}

		const scores = getScores(db);
		const N = 1000;
		let q1Count = 0;

		for (let i = 0; i < N; i++) {
			const selected = selectQuestions(questions, scores, 1);
			if (selected[0].id === 'q1') q1Count++;
		}

		// q1 weight = max(10) - (-50) + 1 = 61
		// others weight = max(10) - 10 + 1 = 1 each
		// q1 should be selected ~61/65 ≈ 93.8% of the time
		// Use a generous threshold to avoid flaky tests
		expect(q1Count / N).toBeGreaterThan(0.8);
	});
});
