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

import type { Database } from 'sql.js';
import type { Question, QuestionScore, QuizConfig, QuizQuestion } from '$lib/types';
import { selectQuestions } from '$lib/engine/selection';
import { presentAnswers } from '$lib/engine/presentation';
import { scoreAnswer } from '$lib/engine/scoring';
import { updateScore, recordAnswer, persistDatabase } from '$lib/db';
import { quizSession, viewMode, reviewIndex } from '$lib/stores/quiz';
import { get } from 'svelte/store';

let sessionId = crypto.randomUUID();

export function startQuiz(
	config: QuizConfig,
	allQuestions: Question[],
	scores: QuestionScore[],
	db: Database
): void {
	sessionId = crypto.randomUUID();

	const selected = selectQuestions(allQuestions, scores, config.questionCount);

	const questions: QuizQuestion[] = selected.map((q) => ({
		question: q,
		presentedAnswers: presentAnswers(q, config.answerCount),
		selectedLabel: null,
		submittedLabel: null
	}));

	quizSession.set({
		config,
		questions,
		currentIndex: 0,
		completed: false
	});

	viewMode.set('quiz');
}

export async function submitAnswer(label: string, db: Database): Promise<void> {
	const session = get(quizSession);
	if (!session) return;

	const current = session.questions[session.currentIndex];
	if (!current || current.submittedLabel !== null) return;

	const selectedAnswer = current.presentedAnswers.find((a) => a.label === label);
	if (!selectedAnswer) return;

	const points = scoreAnswer(selectedAnswer.category);

	updateScore(db, current.question.id, points);
	recordAnswer(db, sessionId, current.question.id, selectedAnswer.category, points);

	const updatedQuestions = [...session.questions];
	updatedQuestions[session.currentIndex] = {
		...current,
		selectedLabel: label,
		submittedLabel: label
	};

	const isLast = session.currentIndex >= session.questions.length - 1;

	quizSession.set({
		...session,
		questions: updatedQuestions,
		currentIndex: isLast ? session.currentIndex : session.currentIndex + 1,
		completed: isLast
	});

	if (isLast) {
		viewMode.set('summary');
	}

	await persistDatabase(db);
}

export function retakeQuiz(db: Database, allQuestions: Question[], scores: QuestionScore[]): void {
	const session = get(quizSession);
	if (!session) return;

	sessionId = crypto.randomUUID();

	const questions: QuizQuestion[] = session.questions.map((qq) => ({
		question: qq.question,
		presentedAnswers: presentAnswers(qq.question, session.config.answerCount),
		selectedLabel: null,
		submittedLabel: null
	}));

	quizSession.set({
		...session,
		questions,
		currentIndex: 0,
		completed: false
	});

	viewMode.set('quiz');
}

export function newQuiz(): void {
	quizSession.set(null);
	reviewIndex.set(null);
	viewMode.set('config');
}

export function quitQuiz(): void {
	newQuiz();
}

export function reviewQuestion(index: number): void {
	reviewIndex.set(index);
	viewMode.set('review');
}

export function backToSummary(): void {
	reviewIndex.set(null);
	viewMode.set('summary');
}
