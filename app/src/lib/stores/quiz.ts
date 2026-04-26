// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { writable, derived } from 'svelte/store';
import type { QuizSession, QuizQuestion } from '$lib/types';

export type ViewMode =
	| 'chooser'
	| 'nav'
	| 'config'
	| 'quiz'
	| 'quiz-answered'
	| 'quiz-review'
	| 'summary'
	| 'review';

export const quizSession = writable<QuizSession | null>(null);
export const viewMode = writable<ViewMode>('nav');
export const reviewIndex = writable<number | null>(null);

export const currentQuestion = derived(quizSession, ($session): QuizQuestion | null => {
	if (!$session) return null;
	return $session.questions[$session.currentIndex] ?? null;
});

export const progress = derived(quizSession, ($session) => {
	if (!$session) return { current: 0, total: 0, percent: 0 };
	const answered = $session.questions.filter((q) => q.submittedLabel !== null).length;
	return {
		current: answered,
		total: $session.questions.length,
		percent: Math.round((answered / $session.questions.length) * 100)
	};
});
