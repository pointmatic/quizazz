// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { activeManifest, questions, navTree, allTags } from '$lib/stores/manifest';
import type { QuizManifest } from '$lib/types';

function makeManifest(name: string, questionCount: number = 2): QuizManifest {
	return {
		quizName: name,
		tree: [
			{
				id: 'topic1',
				label: 'Topic 1',
				description: '',
				type: 'topic',
				questionIds: Array.from({ length: questionCount }, (_, i) => `${name}-q${i}`),
				children: []
			}
		],
		questions: Array.from({ length: questionCount }, (_, i) => ({
			id: `${name}-q${i}`,
			question: `Question ${i} from ${name}?`,
			tags: i === 0 ? ['tag-a'] : ['tag-b'],
			answers: [],
			topicId: 'topic1',
			subtopic: null
		}))
	};
}

describe('manifest store', () => {
	beforeEach(() => {
		activeManifest.set(null);
	});

	it('derived stores are empty when no manifest is active', () => {
		expect(get(questions)).toEqual([]);
		expect(get(navTree)).toEqual([]);
		expect(get(allTags)).toEqual([]);
	});

	it('setting activeManifest populates derived stores', () => {
		const m = makeManifest('test-quiz', 3);
		activeManifest.set(m);

		expect(get(questions)).toHaveLength(3);
		expect(get(navTree)).toHaveLength(1);
		expect(get(navTree)[0].id).toBe('topic1');
		expect(get(allTags)).toEqual(['tag-a', 'tag-b']);
	});

	it('switching manifests updates derived stores', () => {
		const m1 = makeManifest('quiz-a', 2);
		const m2 = makeManifest('quiz-b', 5);

		activeManifest.set(m1);
		expect(get(questions)).toHaveLength(2);
		expect(get(questions)[0].id).toBe('quiz-a-q0');

		activeManifest.set(m2);
		expect(get(questions)).toHaveLength(5);
		expect(get(questions)[0].id).toBe('quiz-b-q0');
	});

	it('clearing activeManifest empties derived stores', () => {
		const m = makeManifest('test', 3);
		activeManifest.set(m);
		expect(get(questions)).toHaveLength(3);

		activeManifest.set(null);
		expect(get(questions)).toEqual([]);
		expect(get(navTree)).toEqual([]);
		expect(get(allTags)).toEqual([]);
	});

	it('allTags are sorted and deduplicated', () => {
		const m: QuizManifest = {
			quizName: 'tags-test',
			tree: [],
			questions: [
				{ id: 'q1', question: 'Q1?', tags: ['zebra', 'apple'], answers: [], topicId: 't', subtopic: null },
				{ id: 'q2', question: 'Q2?', tags: ['apple', 'mango'], answers: [], topicId: 't', subtopic: null }
			]
		};
		activeManifest.set(m);
		expect(get(allTags)).toEqual(['apple', 'mango', 'zebra']);
	});
});
