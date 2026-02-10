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
import { get } from 'svelte/store';
import initSqlJs, { type Database } from 'sql.js';
import type { NavNode, Question, QuestionScore } from '$lib/types';
import { createSchema } from '$lib/db/database';
import { seedScores, getScores } from '$lib/db/scores';
import { startQuiz, newQuiz, quitQuiz, submitAnswer, setNavNodes } from '$lib/engine/lifecycle';
import { quizSession, viewMode, reviewIndex } from '$lib/stores/quiz';

// Mock persistDatabase to avoid IndexedDB in tests
vi.mock('$lib/db', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/db')>();
	return {
		...actual,
		persistDatabase: vi.fn().mockResolvedValue(undefined)
	};
});

// --- Test fixtures ---

function makeQuestion(id: string, topicId: string, subtopic: string | null): Question {
	return {
		id,
		question: `Question ${id}?`,
		tags: [],
		answers: [
			{ text: 'Correct', explanation: 'E', category: 'correct' },
			{ text: 'Partial', explanation: 'E', category: 'partially_correct' },
			{ text: 'Wrong', explanation: 'E', category: 'incorrect' },
			{ text: 'Absurd 1', explanation: 'E', category: 'ridiculous' },
			{ text: 'Absurd 2', explanation: 'E', category: 'ridiculous' }
		],
		topicId,
		subtopic
	};
}

// Tree:
//   dir-a/
//     topic-a1 (subtopic-a1s1: q1, q2) (subtopic-a1s2: q3)
//   topic-b (q4, q5)
const questions: Question[] = [
	makeQuestion('q1', 'topic-a1', 'Sub A1S1'),
	makeQuestion('q2', 'topic-a1', 'Sub A1S1'),
	makeQuestion('q3', 'topic-a1', 'Sub A1S2'),
	makeQuestion('q4', 'topic-b', null),
	makeQuestion('q5', 'topic-b', null)
];

const navTree: NavNode[] = [
	{
		type: 'directory',
		id: 'dir-a',
		label: 'Directory A',
		description: '',
		questionIds: ['q1', 'q2', 'q3'],
		children: [
			{
				type: 'topic',
				id: 'topic-a1',
				label: 'Topic A1',
				description: 'First topic',
				questionIds: ['q1', 'q2', 'q3'],
				children: [
					{
						type: 'subtopic',
						id: 'subtopic-a1s1',
						label: 'Sub A1S1',
						description: '',
						questionIds: ['q1', 'q2'],
						children: []
					},
					{
						type: 'subtopic',
						id: 'subtopic-a1s2',
						label: 'Sub A1S2',
						description: '',
						questionIds: ['q3'],
						children: []
					}
				]
			}
		]
	},
	{
		type: 'topic',
		id: 'topic-b',
		label: 'Topic B',
		description: 'Second topic',
		questionIds: ['q4', 'q5'],
		children: []
	}
];

let db: Database;
let scores: QuestionScore[];

function resetStores() {
	quizSession.set(null);
	viewMode.set('config');
	reviewIndex.set(null);
}

beforeEach(async () => {
	const SQL = await initSqlJs();
	db = new SQL.Database();
	createSchema(db);
	seedScores(db, questions.map((q) => q.id));
	scores = getScores(db);
	setNavNodes(navTree);
	resetStores();
});

describe('navigation node selection scoping', () => {
	it('selecting a topic scopes questions to that topic', () => {
		startQuiz(
			{ questionCount: 10, answerCount: 4, selectedTags: [], selectedNodeIds: ['topic-b'] },
			questions,
			scores,
			db
		);
		const session = get(quizSession)!;
		const ids = session.questions.map((q) => q.question.id).sort();
		expect(ids).toEqual(['q4', 'q5']);
	});

	it('selecting a subtopic scopes questions to that subtopic', () => {
		startQuiz(
			{ questionCount: 10, answerCount: 4, selectedTags: [], selectedNodeIds: ['subtopic-a1s1'] },
			questions,
			scores,
			db
		);
		const session = get(quizSession)!;
		const ids = session.questions.map((q) => q.question.id).sort();
		expect(ids).toEqual(['q1', 'q2']);
	});

	it('selecting a directory selects all children', () => {
		startQuiz(
			{ questionCount: 10, answerCount: 4, selectedTags: [], selectedNodeIds: ['dir-a'] },
			questions,
			scores,
			db
		);
		const session = get(quizSession)!;
		const ids = session.questions.map((q) => q.question.id).sort();
		expect(ids).toEqual(['q1', 'q2', 'q3']);
	});

	it('selecting all nodes includes all questions', () => {
		startQuiz(
			{
				questionCount: 10,
				answerCount: 4,
				selectedTags: [],
				selectedNodeIds: ['dir-a', 'topic-a1', 'subtopic-a1s1', 'subtopic-a1s2', 'topic-b']
			},
			questions,
			scores,
			db
		);
		const session = get(quizSession)!;
		expect(session.questions).toHaveLength(5);
	});

	it('selecting no nodes uses all questions (empty selectedNodeIds)', () => {
		startQuiz(
			{ questionCount: 10, answerCount: 4, selectedTags: [], selectedNodeIds: [] },
			questions,
			scores,
			db
		);
		const session = get(quizSession)!;
		expect(session.questions).toHaveLength(5);
	});

	it('selecting multiple non-overlapping nodes combines their questions', () => {
		startQuiz(
			{
				questionCount: 10,
				answerCount: 4,
				selectedTags: [],
				selectedNodeIds: ['subtopic-a1s2', 'topic-b']
			},
			questions,
			scores,
			db
		);
		const session = get(quizSession)!;
		const ids = session.questions.map((q) => q.question.id).sort();
		expect(ids).toEqual(['q3', 'q4', 'q5']);
	});
});

describe('nav → config → quiz → summary → nav flow', () => {
	it('completes the full navigation lifecycle', async () => {
		// Start from config (simulating post-nav continue)
		expect(get(viewMode)).toBe('config');

		// Start quiz with topic-b selected
		startQuiz(
			{ questionCount: 2, answerCount: 4, selectedTags: [], selectedNodeIds: ['topic-b'] },
			questions,
			scores,
			db
		);
		expect(get(viewMode)).toBe('quiz');
		expect(get(quizSession)!.questions).toHaveLength(2);

		// Answer all questions
		for (let i = 0; i < 2; i++) {
			const session = get(quizSession)!;
			const q = session.questions[session.currentIndex];
			await submitAnswer(q.presentedAnswers[0].label, db);
		}
		expect(get(viewMode)).toBe('summary');

		// New quiz returns to nav
		newQuiz();
		expect(get(viewMode)).toBe('nav');
		expect(get(quizSession)).toBeNull();
	});

	it('quitQuiz returns to nav', () => {
		startQuiz(
			{ questionCount: 2, answerCount: 4, selectedTags: [], selectedNodeIds: ['topic-b'] },
			questions,
			scores,
			db
		);
		expect(get(viewMode)).toBe('quiz');

		quitQuiz();
		expect(get(viewMode)).toBe('nav');
		expect(get(quizSession)).toBeNull();
	});
});
