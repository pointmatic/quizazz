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
import { quizSession, viewMode, reviewIndex, currentQuestion, progress } from '$lib/stores/quiz';
import {
	startQuiz,
	submitAnswer,
	retakeQuiz,
	newQuiz,
	quitQuiz,
	reviewQuestion,
	backToSummary,
	reviewPrev,
	reviewNext,
	showAnsweredQuestions,
	reviewAnsweredQuestion,
	backToQuiz
} from '$lib/engine/lifecycle';
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
	return { id, question: `Question ${id}?`, tags: [], answers };
}

function makeQuestions(count: number, answersPerQuestion: number = 5): Question[] {
	return Array.from({ length: count }, (_, i) => makeQuestion(`q${i + 1}`, answersPerQuestion));
}

let db: Database;
let questions: Question[];
let scores: QuestionScore[];

function resetStores() {
	quizSession.set(null);
	viewMode.set('config');
	reviewIndex.set(null);
}

function setupDb(questionList: Question[]) {
	seedScores(db, questionList.map((q) => q.id));
	return getScores(db);
}

async function answerAllQuestions() {
	const session = get(quizSession);
	if (!session) throw new Error('No session');
	for (let i = 0; i < session.questions.length; i++) {
		const s = get(quizSession)!;
		const q = s.questions[s.currentIndex];
		await submitAnswer(q.presentedAnswers[0].label, db);
	}
}

// --- Tests ---

beforeEach(async () => {
	const SQL = await initSqlJs();
	db = new SQL.Database();
	createSchema(db);
	resetStores();
});

describe('quiz lifecycle: full flow', () => {
	it('config → start → answer all → summary → review → back', async () => {
		questions = makeQuestions(3);
		scores = setupDb(questions);

		// Start
		expect(get(viewMode)).toBe('config');
		startQuiz({ questionCount: 3, answerCount: 4, selectedTags: [] }, questions, scores, db);
		expect(get(viewMode)).toBe('quiz');
		expect(get(quizSession)!.questions).toHaveLength(3);
		expect(get(quizSession)!.currentIndex).toBe(0);
		expect(get(quizSession)!.completed).toBe(false);

		// Answer all
		await answerAllQuestions();
		expect(get(viewMode)).toBe('summary');
		expect(get(quizSession)!.completed).toBe(true);

		// All questions have submittedLabel set
		for (const q of get(quizSession)!.questions) {
			expect(q.submittedLabel).not.toBeNull();
		}

		// Review first question
		reviewQuestion(0);
		expect(get(viewMode)).toBe('review');
		expect(get(reviewIndex)).toBe(0);

		// Back to summary
		backToSummary();
		expect(get(viewMode)).toBe('summary');
		expect(get(reviewIndex)).toBeNull();
	});

	it('config → start → answer all → retake → answer all → summary', async () => {
		questions = makeQuestions(2);
		scores = setupDb(questions);

		startQuiz({ questionCount: 2, answerCount: 4, selectedTags: [] }, questions, scores, db);
		await answerAllQuestions();
		expect(get(viewMode)).toBe('summary');

		// Retake
		scores = getScores(db);
		retakeQuiz(db, questions, scores);
		expect(get(viewMode)).toBe('quiz');
		expect(get(quizSession)!.currentIndex).toBe(0);
		expect(get(quizSession)!.completed).toBe(false);

		// All questions should be reset
		for (const q of get(quizSession)!.questions) {
			expect(q.submittedLabel).toBeNull();
			expect(q.selectedLabel).toBeNull();
		}

		// Answer all again
		await answerAllQuestions();
		expect(get(viewMode)).toBe('summary');
		expect(get(quizSession)!.completed).toBe(true);
	});

	it('config → start → answer all → start new → config', async () => {
		questions = makeQuestions(2);
		scores = setupDb(questions);

		startQuiz({ questionCount: 2, answerCount: 4, selectedTags: [] }, questions, scores, db);
		await answerAllQuestions();
		expect(get(viewMode)).toBe('summary');

		newQuiz();
		expect(get(viewMode)).toBe('config');
		expect(get(quizSession)).toBeNull();
		expect(get(reviewIndex)).toBeNull();
	});
});

describe('derived stores', () => {
	it('currentQuestion tracks current index', async () => {
		questions = makeQuestions(3);
		scores = setupDb(questions);

		expect(get(currentQuestion)).toBeNull();

		startQuiz({ questionCount: 3, answerCount: 4, selectedTags: [] }, questions, scores, db);
		const first = get(currentQuestion);
		expect(first).not.toBeNull();

		// Submit first answer — should advance
		await submitAnswer(first!.presentedAnswers[0].label, db);
		const second = get(currentQuestion);
		expect(second).not.toBeNull();
		expect(second!.question.id).not.toBe(first!.question.id);
	});

	it('progress updates as answers are submitted', async () => {
		questions = makeQuestions(3);
		scores = setupDb(questions);

		startQuiz({ questionCount: 3, answerCount: 4, selectedTags: [] }, questions, scores, db);
		expect(get(progress)).toEqual({ current: 0, total: 3, percent: 0 });

		const s1 = get(quizSession)!;
		await submitAnswer(s1.questions[0].presentedAnswers[0].label, db);
		expect(get(progress)).toEqual({ current: 1, total: 3, percent: 33 });

		const s2 = get(quizSession)!;
		await submitAnswer(s2.questions[s2.currentIndex].presentedAnswers[0].label, db);
		expect(get(progress)).toEqual({ current: 2, total: 3, percent: 67 });

		const s3 = get(quizSession)!;
		await submitAnswer(s3.questions[s3.currentIndex].presentedAnswers[0].label, db);
		expect(get(progress)).toEqual({ current: 3, total: 3, percent: 100 });
	});
});

describe('quitQuiz', () => {
	it('returns to config and clears session', async () => {
		questions = makeQuestions(2);
		scores = setupDb(questions);

		startQuiz({ questionCount: 2, answerCount: 4, selectedTags: [] }, questions, scores, db);
		quitQuiz();
		expect(get(viewMode)).toBe('config');
		expect(get(quizSession)).toBeNull();
	});
});

describe('submitAnswer edge cases', () => {
	it('does nothing if no session', async () => {
		await submitAnswer('a', db);
		expect(get(quizSession)).toBeNull();
	});

	it('does nothing if already submitted', async () => {
		questions = makeQuestions(2);
		scores = setupDb(questions);

		startQuiz({ questionCount: 2, answerCount: 4, selectedTags: [] }, questions, scores, db);
		const s = get(quizSession)!;
		const label = s.questions[0].presentedAnswers[0].label;
		await submitAnswer(label, db);

		// Try submitting again for the same question (index already advanced)
		const indexBefore = get(quizSession)!.currentIndex;
		await submitAnswer(label, db);
		// Should have advanced to next, not re-submitted
		expect(get(quizSession)!.currentIndex).toBe(indexBefore);
	});

	it('does nothing for invalid label', async () => {
		questions = makeQuestions(2);
		scores = setupDb(questions);

		startQuiz({ questionCount: 2, answerCount: 4, selectedTags: [] }, questions, scores, db);
		await submitAnswer('z', db);
		expect(get(quizSession)!.currentIndex).toBe(0);
		expect(get(quizSession)!.questions[0].submittedLabel).toBeNull();
	});
});

describe('review carousel navigation', () => {
	it('reviewNext increments reviewIndex', async () => {
		questions = makeQuestions(3);
		scores = setupDb(questions);

		startQuiz({ questionCount: 3, answerCount: 4, selectedTags: [] }, questions, scores, db);
		await answerAllQuestions();

		reviewQuestion(0);
		expect(get(reviewIndex)).toBe(0);

		reviewNext();
		expect(get(reviewIndex)).toBe(1);

		reviewNext();
		expect(get(reviewIndex)).toBe(2);
	});

	it('reviewNext clamps at last question', async () => {
		questions = makeQuestions(3);
		scores = setupDb(questions);

		startQuiz({ questionCount: 3, answerCount: 4, selectedTags: [] }, questions, scores, db);
		await answerAllQuestions();

		reviewQuestion(2);
		reviewNext();
		expect(get(reviewIndex)).toBe(2);
	});

	it('reviewPrev decrements reviewIndex', async () => {
		questions = makeQuestions(3);
		scores = setupDb(questions);

		startQuiz({ questionCount: 3, answerCount: 4, selectedTags: [] }, questions, scores, db);
		await answerAllQuestions();

		reviewQuestion(2);
		reviewPrev();
		expect(get(reviewIndex)).toBe(1);

		reviewPrev();
		expect(get(reviewIndex)).toBe(0);
	});

	it('reviewPrev clamps at first question', async () => {
		questions = makeQuestions(3);
		scores = setupDb(questions);

		startQuiz({ questionCount: 3, answerCount: 4, selectedTags: [] }, questions, scores, db);
		await answerAllQuestions();

		reviewQuestion(0);
		reviewPrev();
		expect(get(reviewIndex)).toBe(0);
	});
});

describe('mid-quiz navigation', () => {
	it('showAnsweredQuestions sets view mode to quiz-answered', async () => {
		questions = makeQuestions(3);
		scores = setupDb(questions);

		startQuiz({ questionCount: 3, answerCount: 4, selectedTags: [] }, questions, scores, db);
		await submitAnswer(get(quizSession)!.questions[0].presentedAnswers[0].label, db);

		showAnsweredQuestions();
		expect(get(viewMode)).toBe('quiz-answered');
	});

	it('showAnsweredQuestions does nothing on first question', () => {
		questions = makeQuestions(3);
		scores = setupDb(questions);

		startQuiz({ questionCount: 3, answerCount: 4, selectedTags: [] }, questions, scores, db);
		showAnsweredQuestions();
		expect(get(viewMode)).toBe('quiz');
	});

	it('reviewAnsweredQuestion sets quiz-review mode and reviewIndex', async () => {
		questions = makeQuestions(3);
		scores = setupDb(questions);

		startQuiz({ questionCount: 3, answerCount: 4, selectedTags: [] }, questions, scores, db);
		await submitAnswer(get(quizSession)!.questions[0].presentedAnswers[0].label, db);
		await submitAnswer(get(quizSession)!.questions[1].presentedAnswers[0].label, db);

		reviewAnsweredQuestion(0);
		expect(get(viewMode)).toBe('quiz-review');
		expect(get(reviewIndex)).toBe(0);
	});

	it('reviewAnsweredQuestion guards against unanswered questions', async () => {
		questions = makeQuestions(3);
		scores = setupDb(questions);

		startQuiz({ questionCount: 3, answerCount: 4, selectedTags: [] }, questions, scores, db);
		await submitAnswer(get(quizSession)!.questions[0].presentedAnswers[0].label, db);

		// currentIndex is 1, so index 1 (current unanswered) should be blocked
		reviewAnsweredQuestion(1);
		expect(get(viewMode)).toBe('quiz');
		expect(get(reviewIndex)).toBeNull();
	});

	it('backToQuiz restores quiz view mode', async () => {
		questions = makeQuestions(3);
		scores = setupDb(questions);

		startQuiz({ questionCount: 3, answerCount: 4, selectedTags: [] }, questions, scores, db);
		await submitAnswer(get(quizSession)!.questions[0].presentedAnswers[0].label, db);

		showAnsweredQuestions();
		expect(get(viewMode)).toBe('quiz-answered');

		backToQuiz();
		expect(get(viewMode)).toBe('quiz');
		expect(get(reviewIndex)).toBeNull();
	});

	it('Escape from quiz-review returns to quiz-answered via showAnsweredQuestions', async () => {
		questions = makeQuestions(3);
		scores = setupDb(questions);

		startQuiz({ questionCount: 3, answerCount: 4, selectedTags: [] }, questions, scores, db);
		await submitAnswer(get(quizSession)!.questions[0].presentedAnswers[0].label, db);
		await submitAnswer(get(quizSession)!.questions[1].presentedAnswers[0].label, db);

		reviewAnsweredQuestion(0);
		expect(get(viewMode)).toBe('quiz-review');

		// Simulate what Escape does in quiz-review: calls showAnsweredQuestions
		showAnsweredQuestions();
		expect(get(viewMode)).toBe('quiz-answered');
	});

	it('reviewNext in quiz-review clamps to answered questions only', async () => {
		questions = makeQuestions(4);
		scores = setupDb(questions);

		startQuiz({ questionCount: 4, answerCount: 4, selectedTags: [] }, questions, scores, db);
		// Answer 2 questions, so currentIndex = 2
		await submitAnswer(get(quizSession)!.questions[0].presentedAnswers[0].label, db);
		await submitAnswer(get(quizSession)!.questions[1].presentedAnswers[0].label, db);

		reviewAnsweredQuestion(0);
		expect(get(viewMode)).toBe('quiz-review');

		reviewNext();
		expect(get(reviewIndex)).toBe(1);

		// Should clamp — can't go to index 2 (unanswered)
		reviewNext();
		expect(get(reviewIndex)).toBe(1);
	});
});

describe('full navigation flow: mid-quiz review and continue', () => {
	it('answer → go back → review answered → return → continue → summary', async () => {
		questions = makeQuestions(4);
		scores = setupDb(questions);

		startQuiz({ questionCount: 4, answerCount: 4, selectedTags: [] }, questions, scores, db);
		expect(get(viewMode)).toBe('quiz');
		expect(get(quizSession)!.currentIndex).toBe(0);

		// Answer first 2 questions
		await submitAnswer(get(quizSession)!.questions[0].presentedAnswers[0].label, db);
		await submitAnswer(get(quizSession)!.questions[1].presentedAnswers[0].label, db);
		expect(get(quizSession)!.currentIndex).toBe(2);

		// Go to answered questions list
		showAnsweredQuestions();
		expect(get(viewMode)).toBe('quiz-answered');

		// Review first answered question
		reviewAnsweredQuestion(0);
		expect(get(viewMode)).toBe('quiz-review');
		expect(get(reviewIndex)).toBe(0);

		// Navigate to second answered question via carousel
		reviewNext();
		expect(get(reviewIndex)).toBe(1);

		// Can't go further (only 2 answered)
		reviewNext();
		expect(get(reviewIndex)).toBe(1);

		// Go back to answered list
		showAnsweredQuestions();
		expect(get(viewMode)).toBe('quiz-answered');

		// Return to quiz
		backToQuiz();
		expect(get(viewMode)).toBe('quiz');
		expect(get(quizSession)!.currentIndex).toBe(2);

		// Continue answering remaining questions
		await submitAnswer(get(quizSession)!.questions[2].presentedAnswers[0].label, db);
		await submitAnswer(get(quizSession)!.questions[3].presentedAnswers[0].label, db);

		// Quiz completes → summary
		expect(get(viewMode)).toBe('summary');
		expect(get(quizSession)!.completed).toBe(true);

		// Post-quiz review with full carousel
		reviewQuestion(0);
		expect(get(viewMode)).toBe('review');
		reviewNext();
		expect(get(reviewIndex)).toBe(1);
		reviewNext();
		expect(get(reviewIndex)).toBe(2);
		reviewNext();
		expect(get(reviewIndex)).toBe(3);

		// Back to summary
		backToSummary();
		expect(get(viewMode)).toBe('summary');
	});
});

describe('database integration', () => {
	it('scores are updated in DB after answering', async () => {
		questions = makeQuestions(2);
		scores = setupDb(questions);

		startQuiz({ questionCount: 2, answerCount: 4, selectedTags: [] }, questions, scores, db);
		await answerAllQuestions();

		const updatedScores = getScores(db);
		// At least one score should have changed from 0
		const changed = updatedScores.some((s) => s.cumulativeScore !== 0);
		expect(changed).toBe(true);
	});

	it('session answers are recorded in DB', async () => {
		questions = makeQuestions(2);
		scores = setupDb(questions);

		startQuiz({ questionCount: 2, answerCount: 4, selectedTags: [] }, questions, scores, db);
		await answerAllQuestions();

		const results = db.exec('SELECT COUNT(*) FROM session_answers');
		const count = results[0].values[0][0] as number;
		expect(count).toBe(2);
	});
});
