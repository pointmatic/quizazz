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
import { seedScores, getScores } from '$lib/db/scores';
import { quizSession, viewMode, reviewIndex } from '$lib/stores/quiz';
import { startQuiz } from '$lib/engine/lifecycle';
import { selectQuestions } from '$lib/engine/selection';
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

function makeTaggedQuestions(): Question[] {
	const base = {
		answers: [
			{ text: 'Correct', explanation: 'E', category: 'correct' as const },
			{ text: 'Partial', explanation: 'E', category: 'partially_correct' as const },
			{ text: 'Wrong', explanation: 'E', category: 'incorrect' as const },
			{ text: 'Absurd 1', explanation: 'E', category: 'ridiculous' as const },
			{ text: 'Absurd 2', explanation: 'E', category: 'ridiculous' as const }
		]
	};
	return [
		{ id: 'q1', question: 'Math Q1?', tags: ['math'], topicId: 'test', subtopic: null, ...base },
		{ id: 'q2', question: 'Science Q2?', tags: ['science'], topicId: 'test', subtopic: null, ...base },
		{ id: 'q3', question: 'Math+Science Q3?', tags: ['math', 'science'], topicId: 'test', subtopic: null, ...base },
		{ id: 'q4', question: 'History Q4?', tags: ['history'], topicId: 'test', subtopic: null, ...base },
		{ id: 'q5', question: 'No tags Q5?', tags: [], topicId: 'test', subtopic: null, ...base }
	];
}

let db: Database;
let questions: Question[];

function resetStores() {
	quizSession.set(null);
	viewMode.set('config');
	reviewIndex.set(null);
}

beforeEach(async () => {
	const SQL = await initSqlJs();
	db = new SQL.Database();
	createSchema(db);
	questions = makeTaggedQuestions();
	seedScores(db, questions.map((q) => q.id));
	resetStores();
});

describe('quiz with tag filter', () => {
	it('selects only questions matching the tag', () => {
		const scores = getScores(db);
		startQuiz({ questionCount: 10, answerCount: 4, selectedTags: ['math'], selectedNodeIds: [] }, questions, scores, db);

		const session = get(quizSession)!;
		const ids = session.questions.map((q) => q.question.id);
		expect(ids.sort()).toEqual(['q1', 'q3']);
	});

	it('OR logic: questions matching any selected tag are included', () => {
		const scores = getScores(db);
		startQuiz({ questionCount: 10, answerCount: 4, selectedTags: ['math', 'history'], selectedNodeIds: [] }, questions, scores, db);

		const session = get(quizSession)!;
		const ids = session.questions.map((q) => q.question.id).sort();
		expect(ids).toEqual(['q1', 'q3', 'q4']);
	});
});

describe('quiz with no tag filter', () => {
	it('selects from all questions when selectedTags is empty', () => {
		const scores = getScores(db);
		startQuiz({ questionCount: 10, answerCount: 4, selectedTags: [], selectedNodeIds: [] }, questions, scores, db);

		const session = get(quizSession)!;
		expect(session.questions).toHaveLength(5);
	});
});

describe('tag filter with no matching questions', () => {
	it('starts quiz with 0 questions when no match', () => {
		const scores = getScores(db);
		startQuiz({ questionCount: 10, answerCount: 4, selectedTags: ['nonexistent'], selectedNodeIds: [] }, questions, scores, db);

		const session = get(quizSession)!;
		expect(session.questions).toHaveLength(0);
	});
});

describe('allTags derivation', () => {
	it('produces sorted, deduplicated tags from questions', () => {
		const tags = [...new Set(questions.flatMap((q) => q.tags))].sort();
		expect(tags).toEqual(['history', 'math', 'science']);
	});

	it('excludes empty tags arrays', () => {
		const tags = [...new Set(questions.flatMap((q) => q.tags))].sort();
		expect(tags).not.toContain('');
	});
});
