// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import QuizBlock from '$lib/embed/QuizBlock.svelte';
import type { QuizManifest } from '$lib/types';

const initDatabaseMock = vi.fn();
const seedScoresMock = vi.fn();
const persistDatabaseMock = vi.fn();

vi.mock('$lib/db', () => ({
	initDatabase: (quizName: string) => initDatabaseMock(quizName),
	seedScores: (db: unknown, ids: string[]) => seedScoresMock(db, ids),
	persistDatabase: (db: unknown, quizName: string) => persistDatabaseMock(db, quizName),
	getDbName: (quizName: string) => `quizazz-${quizName}`,
	createSchema: vi.fn(),
	getScores: vi.fn(() => []),
	updateScore: vi.fn(),
	recordAnswer: vi.fn()
}));

function makeManifest(
	quizName: string = 'test-quiz',
	schemaVersion: string | undefined = '1.0'
): QuizManifest {
	return {
		schemaVersion,
		quizName,
		tree: [
			{
				id: 'topic1',
				label: 'Topic 1',
				description: '',
				type: 'topic',
				questionIds: ['q1', 'q2'],
				children: []
			}
		],
		questions: [
			{
				id: 'q1',
				question: 'Q1?',
				tags: [],
				topicId: 'topic1',
				subtopic: null,
				answers: [
					{ text: 'A', explanation: '', category: 'correct' },
					{ text: 'B', explanation: '', category: 'incorrect' },
					{ text: 'C', explanation: '', category: 'incorrect' },
					{ text: 'D', explanation: '', category: 'incorrect' },
					{ text: 'E', explanation: '', category: 'ridiculous' }
				]
			},
			{
				id: 'q2',
				question: 'Q2?',
				tags: [],
				topicId: 'topic1',
				subtopic: null,
				answers: [
					{ text: 'A', explanation: '', category: 'correct' },
					{ text: 'B', explanation: '', category: 'incorrect' },
					{ text: 'C', explanation: '', category: 'incorrect' },
					{ text: 'D', explanation: '', category: 'incorrect' },
					{ text: 'E', explanation: '', category: 'ridiculous' }
				]
			}
		]
	};
}

beforeEach(() => {
	initDatabaseMock.mockReset();
	seedScoresMock.mockReset();
	persistDatabaseMock.mockReset();
	initDatabaseMock.mockResolvedValue({ fake: 'db' });
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe('QuizBlock rendering', () => {
	it('renders a root element with the supplied class', () => {
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

	it('seeds scores with the question ids from the manifest', async () => {
		const manifest = makeManifest();
		render(QuizBlock, { props: { manifest, quizRef: 'ref-1' } });
		await vi.waitFor(() => {
			expect(seedScoresMock).toHaveBeenCalled();
		});
		const call = seedScoresMock.mock.calls[0];
		expect(call[1]).toEqual(['q1', 'q2']);
	});

	it('does not mutate the manifest prop after mount', async () => {
		const manifest = makeManifest();
		const snapshot = structuredClone(manifest);
		render(QuizBlock, { props: { manifest, quizRef: 'ref-1' } });
		await vi.waitFor(() => expect(initDatabaseMock).toHaveBeenCalled());
		expect(manifest).toEqual(snapshot);
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
