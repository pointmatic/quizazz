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
