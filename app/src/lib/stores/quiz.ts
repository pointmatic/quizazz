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

import { writable, derived } from 'svelte/store';
import type { QuizSession, QuizQuestion } from '$lib/types';

export type ViewMode = 'config' | 'quiz' | 'quiz-answered' | 'quiz-review' | 'summary' | 'review';

export const quizSession = writable<QuizSession | null>(null);
export const viewMode = writable<ViewMode>('config');
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
