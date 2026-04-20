// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import initSqlJs, { type Database } from 'sql.js';
import QuizBlock from '$lib/embed/QuizBlock.svelte';
import { createSchema, getDbName } from '$lib/db/database';
import { viewMode, quizSession, reviewIndex } from '$lib/stores/quiz';
import { activeManifest } from '$lib/stores/manifest';
import {
	setNavNodes,
	submitAnswer,
	showAnsweredQuestions,
	reviewAnsweredMidQuiz,
	exitMidQuizReview,
	reviewQuestion,
	reviewNext,
	reviewPrev
} from '$lib/engine/lifecycle';
import type { QuizManifest } from '$lib/types';

vi.mock('$lib/db', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/db')>();
	return {
		...actual,
		initDatabase: vi.fn(),
		persistDatabase: vi.fn().mockResolvedValue(undefined)
	};
});

let db: Database;
let initDatabaseMock: ReturnType<typeof vi.fn>;

function makeManifest(
	quizName: string = 'test-quiz',
	schemaVersion: string | undefined = '1.0',
	questionCount: number = 2
): QuizManifest {
	const questions = Array.from({ length: questionCount }, (_, i) => ({
		id: `q${i + 1}`,
		question: `Question ${i + 1}?`,
		tags: [],
		topicId: 'topic1',
		subtopic: null,
		answers: [
			{ text: `Correct ${i + 1}`, explanation: 'right', category: 'correct' as const },
			{ text: `Wrong A ${i + 1}`, explanation: 'nope', category: 'incorrect' as const },
			{ text: `Wrong B ${i + 1}`, explanation: 'nope', category: 'incorrect' as const },
			{ text: `Wrong C ${i + 1}`, explanation: 'nope', category: 'incorrect' as const },
			{ text: `Silly ${i + 1}`, explanation: 'really?', category: 'ridiculous' as const }
		]
	}));
	return {
		schemaVersion,
		quizName,
		tree: [
			{
				id: 'topic1',
				label: 'Topic 1',
				description: '',
				type: 'topic',
				questionIds: questions.map((q) => q.id),
				children: []
			}
		],
		questions
	};
}

beforeEach(async () => {
	const SQL = await initSqlJs();
	db = new SQL.Database();
	createSchema(db);

	const dbModule = await import('$lib/db');
	initDatabaseMock = dbModule.initDatabase as unknown as ReturnType<typeof vi.fn>;
	initDatabaseMock.mockReset();
	initDatabaseMock.mockResolvedValue(db);

	activeManifest.set(null);
	quizSession.set(null);
	viewMode.set('nav');
	reviewIndex.set(null);
	setNavNodes([]);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe('QuizBlock rendering', () => {
	it('renders a root element with the supplied class', async () => {
		const manifest = makeManifest();
		const { container } = render(QuizBlock, {
			props: { manifest, quizRef: 'ref-1', class: 'my-theme' }
		});
		const root = container.querySelector('section');
		expect(root).not.toBeNull();
		expect(root!.classList.contains('my-theme')).toBe(true);
	});

	it('renders a focusable root (tabindex="0")', () => {
		const manifest = makeManifest();
		const { container } = render(QuizBlock, {
			props: { manifest, quizRef: 'ref-1' }
		});
		const root = container.querySelector('section');
		expect(root!.getAttribute('tabindex')).toBe('0');
	});

	it('renders no error aside or warning aside on a valid mount', async () => {
		const manifest = makeManifest();
		const { container } = render(QuizBlock, {
			props: { manifest, quizRef: 'ref-1' }
		});
		await vi.waitFor(() => expect(initDatabaseMock).toHaveBeenCalled());
		await tick();
		expect(container.querySelector('aside[data-quizazz-error]')).toBeNull();
		expect(container.querySelector('aside[data-quizazz-warning]')).toBeNull();
	});
});

describe('QuizBlock DB initialization', () => {
	it('initializes the per-quiz DB using the manifest quizName', async () => {
		const manifest = makeManifest('geography');
		render(QuizBlock, { props: { manifest, quizRef: 'ref-1' } });
		await vi.waitFor(() => {
			expect(initDatabaseMock).toHaveBeenCalledWith('geography');
		});
	});

	it('seeds question_scores rows for each manifest question', async () => {
		const manifest = makeManifest();
		render(QuizBlock, { props: { manifest, quizRef: 'ref-1' } });
		await vi.waitFor(() => {
			const rows = db.exec('SELECT question_id FROM question_scores ORDER BY question_id');
			expect(rows[0]?.values.map((r) => r[0])).toEqual(['q1', 'q2']);
		});
	});

	it('does not mutate the manifest prop after mount', async () => {
		const manifest = makeManifest();
		const snapshot = structuredClone(manifest);
		render(QuizBlock, { props: { manifest, quizRef: 'ref-1' } });
		await vi.waitFor(() => expect(initDatabaseMock).toHaveBeenCalled());
		expect(manifest).toEqual(snapshot);
	});

	it('uses getDbName to produce the expected per-quiz DB name', () => {
		expect(getDbName('geography')).toBe('quizazz-geography');
	});
});

describe('QuizBlock single-instance guard', () => {
	it('blocks a second instance while a first is mounted', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const manifest = makeManifest();

		const first = render(QuizBlock, {
			props: { manifest, quizRef: 'first-ref' }
		});
		await vi.waitFor(() => expect(initDatabaseMock).toHaveBeenCalledTimes(1));

		const second = render(QuizBlock, {
			props: { manifest, quizRef: 'second-ref' }
		});
		await tick();

		const blockedAside = second.container.querySelector('aside[data-quizazz-error]');
		expect(blockedAside).not.toBeNull();
		expect(initDatabaseMock).toHaveBeenCalledTimes(1);

		const errorText = errorSpy.mock.calls.map((c) => String(c[0])).join(' ');
		expect(errorText).toContain('first-ref');
		expect(errorText).toContain('second-ref');

		first.unmount();
		second.unmount();
	});

	it('allows a second instance after the first unmounts', async () => {
		const manifest = makeManifest('q1');
		const first = render(QuizBlock, { props: { manifest, quizRef: 'a' } });
		await vi.waitFor(() => expect(initDatabaseMock).toHaveBeenCalledTimes(1));
		first.unmount();

		const second = render(QuizBlock, {
			props: { manifest: makeManifest('q2'), quizRef: 'b' }
		});
		await vi.waitFor(() => expect(initDatabaseMock).toHaveBeenCalledTimes(2));
		expect(second.container.querySelector('aside[data-quizazz-error]')).toBeNull();
		second.unmount();
	});
});

describe('QuizBlock quiz flow wiring', () => {
	it('starts a quiz covering the whole manifest on mount', async () => {
		const manifest = makeManifest('flow', '1.0', 3);
		render(QuizBlock, { props: { manifest, quizRef: 'ref-1' } });
		await vi.waitFor(() => {
			const session = get(quizSession);
			expect(session).not.toBeNull();
			expect(session!.questions).toHaveLength(3);
			expect(session!.currentIndex).toBe(0);
			expect(session!.completed).toBe(false);
			expect(session!.config.answerCount).toBe(4);
			expect(session!.config.selectedTags).toEqual([]);
			expect(session!.config.selectedNodeIds).toEqual([]);
			expect(session!.config.questionCount).toBe(3);
		});
		expect(get(viewMode)).toBe('quiz');
	});

	it('renders QuizView when viewMode is "quiz"', async () => {
		const manifest = makeManifest('flow', '1.0', 2);
		const { container } = render(QuizBlock, { props: { manifest, quizRef: 'ref-1' } });
		await vi.waitFor(() => expect(get(viewMode)).toBe('quiz'));
		await tick();
		const submit = Array.from(container.querySelectorAll('button')).find(
			(b) => b.textContent?.trim() === 'Submit'
		);
		expect(submit).toBeDefined();
		const question = get(quizSession)!.questions[0].question.question;
		expect(container.textContent).toContain(question);
	});

	async function submitCategory(
		category: 'correct' | 'incorrect' | 'partially_correct' | 'ridiculous'
	) {
		const s = get(quizSession)!;
		const q = s.questions[s.currentIndex];
		const match = q.presentedAnswers.find((a) => a.category === category);
		if (!match) throw new Error(`No ${category} answer in presented set`);
		await submitAnswer(match.label, db);
	}

	async function completeAllWith(
		category: 'correct' | 'incorrect' | 'partially_correct' | 'ridiculous',
		count: number
	) {
		for (let i = 0; i < count; i++) await submitCategory(category);
	}

	it('renders SummaryView when viewMode is "summary" with Retake visible and Start/Quit suppressed', async () => {
		const manifest = makeManifest('flow', '1.0', 2);
		const { container } = render(QuizBlock, { props: { manifest, quizRef: 'ref-1' } });
		await vi.waitFor(() => expect(get(viewMode)).toBe('quiz'));
		await completeAllWith('correct', 2);
		await vi.waitFor(() => expect(get(viewMode)).toBe('summary'));
		await tick();

		const buttons = Array.from(container.querySelectorAll('button'));
		const texts = buttons.map((b) => b.textContent?.trim() ?? '');
		expect(texts.some((t) => t.includes('Retake'))).toBe(true);
		expect(texts.some((t) => t.includes('Start New'))).toBe(false);
		expect(texts.some((t) => t === 'Quit')).toBe(false);
	});

	it('all-correct run through N questions shows 100% on summary', async () => {
		const manifest = makeManifest('allcorrect', '1.0', 3);
		const { container } = render(QuizBlock, { props: { manifest, quizRef: 'ref-1' } });
		await vi.waitFor(() => expect(get(viewMode)).toBe('quiz'));
		await completeAllWith('correct', 3);
		await vi.waitFor(() => expect(get(viewMode)).toBe('summary'));
		await tick();
		expect(container.textContent).toContain('100%');
		expect(container.textContent).toContain('3 of 3 correct');
	});

	it('retake from summary resets the session and returns to quiz mode; DB scores carry over', async () => {
		const manifest = makeManifest('retake', '1.0', 2);
		const { container } = render(QuizBlock, { props: { manifest, quizRef: 'ref-1' } });
		await vi.waitFor(() => expect(get(viewMode)).toBe('quiz'));
		await completeAllWith('incorrect', 2);
		await vi.waitFor(() => expect(get(viewMode)).toBe('summary'));
		await tick();

		const retakeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
			b.textContent?.includes('Retake')
		);
		expect(retakeBtn).toBeDefined();
		retakeBtn!.click();
		await tick();

		expect(get(viewMode)).toBe('quiz');
		const session = get(quizSession)!;
		expect(session.currentIndex).toBe(0);
		expect(session.completed).toBe(false);
		for (const q of session.questions) {
			expect(q.submittedLabel).toBeNull();
			expect(q.selectedLabel).toBeNull();
			expect(q.elapsedMs).toBe(0);
		}

		// DB scores from the first run (-5 per question) are retained
		const rows = db.exec('SELECT question_id, cumulative_score FROM question_scores ORDER BY question_id');
		const scores = Object.fromEntries(rows[0].values.map((r) => [r[0] as string, r[1] as number]));
		expect(scores).toEqual({ q1: -5, q2: -5 });

		// Complete the retake with correct answers; scores add +1 each → -4 each
		await completeAllWith('correct', 2);
		await vi.waitFor(() => expect(get(viewMode)).toBe('summary'));
		const rows2 = db.exec('SELECT question_id, cumulative_score FROM question_scores ORDER BY question_id');
		const scores2 = Object.fromEntries(rows2[0].values.map((r) => [r[0] as string, r[1] as number]));
		expect(scores2).toEqual({ q1: -4, q2: -4 });
	});

	it('all-incorrect run persists -5 per question in cumulative_score', async () => {
		const manifest = makeManifest('allwrong', '1.0', 3);
		render(QuizBlock, { props: { manifest, quizRef: 'ref-1' } });
		await vi.waitFor(() => expect(get(viewMode)).toBe('quiz'));
		await completeAllWith('incorrect', 3);
		await vi.waitFor(() => expect(get(viewMode)).toBe('summary'));

		const rows = db.exec('SELECT question_id, cumulative_score FROM question_scores ORDER BY question_id');
		const scores = Object.fromEntries(rows[0].values.map((r) => [r[0] as string, r[1] as number]));
		expect(scores).toEqual({ q1: -5, q2: -5, q3: -5 });
	});

	it('mid-quiz: answered list → review → exit returns to current unanswered question', async () => {
		const manifest = makeManifest('midquiz', '1.0', 3);
		const { container } = render(QuizBlock, { props: { manifest, quizRef: 'ref-1' } });
		await vi.waitFor(() => expect(get(viewMode)).toBe('quiz'));
		await completeAllWith('correct', 2);
		expect(get(quizSession)!.currentIndex).toBe(2);

		showAnsweredQuestions();
		await tick();
		expect(get(viewMode)).toBe('quiz-answered');
		expect(container.textContent).toContain('Answered Questions');

		reviewAnsweredMidQuiz(0);
		await tick();
		expect(get(viewMode)).toBe('quiz-review');
		// ReviewView shows presented answers with the user's answer highlighted
		expect(container.textContent).toContain('Your answer');

		exitMidQuizReview();
		await tick();
		expect(get(viewMode)).toBe('quiz');
		// Progress preserved: still on question 3 (index 2), first two still submitted
		expect(get(quizSession)!.currentIndex).toBe(2);
		expect(get(quizSession)!.questions[0].submittedLabel).not.toBeNull();
		expect(get(quizSession)!.questions[1].submittedLabel).not.toBeNull();
		expect(get(quizSession)!.questions[2].submittedLabel).toBeNull();
	});

	it('post-quiz drill-down: carousel navigates between answered questions', async () => {
		const manifest = makeManifest('drill', '1.0', 3);
		render(QuizBlock, { props: { manifest, quizRef: 'ref-1' } });
		await vi.waitFor(() => expect(get(viewMode)).toBe('quiz'));
		await completeAllWith('correct', 3);
		await vi.waitFor(() => expect(get(viewMode)).toBe('summary'));

		reviewQuestion(0);
		await tick();
		expect(get(viewMode)).toBe('review');
		expect(get(reviewIndex)).toBe(0);

		reviewNext();
		expect(get(reviewIndex)).toBe(1);
		reviewNext();
		expect(get(reviewIndex)).toBe(2);
		reviewNext();
		expect(get(reviewIndex)).toBe(2); // clamps

		reviewPrev();
		expect(get(reviewIndex)).toBe(1);
		reviewPrev();
		expect(get(reviewIndex)).toBe(0);
	});
});

describe('QuizBlock schema-version handling', () => {
	it('renders a warning aside for an incompatible major version but still inits the DB', async () => {
		const manifest = makeManifest('future-quiz', '2.0');
		const { container } = render(QuizBlock, {
			props: { manifest, quizRef: 'ref-1' }
		});
		await vi.waitFor(() => expect(initDatabaseMock).toHaveBeenCalled());
		const warning = container.querySelector('aside[data-quizazz-warning]');
		expect(warning).not.toBeNull();
	});

	it('treats a missing schemaVersion as compatible (no warning)', async () => {
		const manifest = makeManifest('legacy', undefined);
		const { container } = render(QuizBlock, {
			props: { manifest, quizRef: 'ref-1' }
		});
		await vi.waitFor(() => expect(initDatabaseMock).toHaveBeenCalled());
		expect(container.querySelector('aside[data-quizazz-warning]')).toBeNull();
	});
});
