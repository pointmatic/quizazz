// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { validateManifest, parseAndValidate } from '$lib/utils/validate-manifest';

function makeValidManifest() {
	return {
		quizName: 'test-quiz',
		tree: [{ id: 't1', label: 'Topic', description: '', type: 'topic', questionIds: ['q1'], children: [] }],
		questions: [
			{ id: 'q1', question: 'What is 1+1?', tags: ['math'], answers: [{ text: '2', explanation: 'Correct', category: 'correct' }], topicId: 't1', subtopic: null }
		]
	};
}

describe('validateManifest', () => {
	it('accepts a valid manifest', () => {
		const result = validateManifest(makeValidManifest());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.manifest.quizName).toBe('test-quiz');
			expect(result.manifest.questions).toHaveLength(1);
		}
	});

	it('rejects null', () => {
		const result = validateManifest(null);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('JSON object');
	});

	it('rejects non-object', () => {
		const result = validateManifest('hello');
		expect(result.ok).toBe(false);
	});

	it('rejects missing quizName', () => {
		const m = makeValidManifest();
		delete (m as Record<string, unknown>).quizName;
		const result = validateManifest(m);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('quizName');
	});

	it('rejects empty quizName', () => {
		const m = makeValidManifest();
		m.quizName = '  ';
		const result = validateManifest(m);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('quizName');
	});

	it('rejects missing tree', () => {
		const m = makeValidManifest();
		delete (m as Record<string, unknown>).tree;
		const result = validateManifest(m);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('tree');
	});

	it('rejects non-array tree', () => {
		const m = makeValidManifest() as Record<string, unknown>;
		m.tree = 'not-an-array';
		const result = validateManifest(m);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('tree');
	});

	it('rejects missing questions', () => {
		const m = makeValidManifest();
		delete (m as Record<string, unknown>).questions;
		const result = validateManifest(m);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('questions');
	});

	it('rejects empty questions array', () => {
		const m = makeValidManifest();
		m.questions = [];
		const result = validateManifest(m);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('no questions');
	});

	it('rejects question missing id', () => {
		const m = makeValidManifest();
		delete (m.questions[0] as Record<string, unknown>).id;
		const result = validateManifest(m);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('Question 0');
	});

	it('rejects question missing question text', () => {
		const m = makeValidManifest();
		delete (m.questions[0] as Record<string, unknown>).question;
		const result = validateManifest(m);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('Question 0');
	});

	it('rejects question missing answers', () => {
		const m = makeValidManifest();
		delete (m.questions[0] as Record<string, unknown>).answers;
		const result = validateManifest(m);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('Question 0');
	});
});

describe('parseAndValidate', () => {
	it('parses and validates valid JSON', () => {
		const json = JSON.stringify(makeValidManifest());
		const result = parseAndValidate(json);
		expect(result.ok).toBe(true);
	});

	it('rejects invalid JSON', () => {
		const result = parseAndValidate('not json {{{');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('Invalid JSON');
	});

	it('rejects valid JSON with invalid manifest shape', () => {
		const result = parseAndValidate('{"foo": "bar"}');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('quizName');
	});
});
