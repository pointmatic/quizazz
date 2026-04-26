// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import type { QuizManifest } from '$lib/types';

export type ValidationResult =
	| { ok: true; manifest: QuizManifest }
	| { ok: false; error: string };

export function validateManifest(data: unknown): ValidationResult {
	if (data === null || typeof data !== 'object') {
		return { ok: false, error: 'Manifest must be a JSON object.' };
	}

	const obj = data as Record<string, unknown>;

	if (typeof obj.quizName !== 'string' || obj.quizName.trim() === '') {
		return { ok: false, error: 'Missing or empty "quizName" field.' };
	}

	if (!Array.isArray(obj.tree)) {
		return { ok: false, error: 'Missing or invalid "tree" field (expected array).' };
	}

	if (!Array.isArray(obj.questions)) {
		return { ok: false, error: 'Missing or invalid "questions" field (expected array).' };
	}

	if (obj.questions.length === 0) {
		return { ok: false, error: 'Manifest has no questions.' };
	}

	for (let i = 0; i < obj.questions.length; i++) {
		const q = obj.questions[i];
		if (q === null || typeof q !== 'object') {
			return { ok: false, error: `Question ${i} is not an object.` };
		}
		const qObj = q as Record<string, unknown>;
		if (typeof qObj.id !== 'string') {
			return { ok: false, error: `Question ${i} is missing "id".` };
		}
		if (typeof qObj.question !== 'string') {
			return { ok: false, error: `Question ${i} is missing "question".` };
		}
		if (!Array.isArray(qObj.answers)) {
			return { ok: false, error: `Question ${i} is missing "answers" array.` };
		}
	}

	return { ok: true, manifest: data as QuizManifest };
}

export function parseAndValidate(text: string): ValidationResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, error: 'Invalid JSON.' };
	}
	return validateManifest(parsed);
}
