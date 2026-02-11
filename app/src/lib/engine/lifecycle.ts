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
import type { NavNode, Question, QuestionScore, QuizConfig, QuizQuestion, QuizSession } from '$lib/types';
import { selectQuestions } from '$lib/engine/selection';
import { presentAnswers } from '$lib/engine/presentation';
import { scoreAnswer } from '$lib/engine/scoring';
import { updateScore, recordAnswer, persistDatabase } from '$lib/db';
import { quizSession, viewMode, reviewIndex } from '$lib/stores/quiz';
import { get } from 'svelte/store';

let sessionId = crypto.randomUUID();
let activeQuizName = '';
let questionStartTime = 0;

let allNavNodes: NavNode[] = [];

export function setNavNodes(nodes: NavNode[]): void {
	allNavNodes = nodes;
}

function collectQuestionIds(nodeIds: string[], nodes: NavNode[]): Set<string> {
	const ids = new Set<string>();
	function walk(node: NavNode) {
		if (nodeIds.includes(node.id)) {
			for (const qid of node.questionIds) ids.add(qid);
			return;
		}
		for (const child of node.children) walk(child);
	}
	for (const node of nodes) walk(node);
	return ids;
}

function filterByNodeIds(questions: Question[], nodeIds: string[], nodes: NavNode[]): Question[] {
	const questionIds = collectQuestionIds(nodeIds, nodes);
	return questions.filter((q) => questionIds.has(q.id));
}

export function startQuiz(
	config: QuizConfig,
	allQuestions: Question[],
	scores: QuestionScore[],
	db: Database,
	quizName: string = ''
): void {
	sessionId = crypto.randomUUID();
	activeQuizName = quizName;
	frontierIndex = 0;

	const pool =
		config.selectedNodeIds.length > 0
			? filterByNodeIds(allQuestions, config.selectedNodeIds, allNavNodes)
			: allQuestions;

	const selected = selectQuestions(pool, scores, config.questionCount, config.selectedTags);

	const questions: QuizQuestion[] = selected.map((q) => ({
		question: q,
		presentedAnswers: presentAnswers(q, config.answerCount),
		selectedLabel: null,
		submittedLabel: null,
		elapsedMs: 0
	}));

	quizSession.set({
		config,
		questions,
		currentIndex: 0,
		completed: false
	});

	questionStartTime = Date.now();
	viewMode.set('quiz');
}

let frontierIndex = 0;

export function getFrontierIndex(): number {
	return frontierIndex;
}

export function getQuestionStartTime(): number {
	return questionStartTime;
}

function snapshotElapsed(session: QuizSession): QuizQuestion[] {
	const now = Date.now();
	const delta = now - questionStartTime;
	questionStartTime = now;
	const updatedQuestions = [...session.questions];
	const current = updatedQuestions[session.currentIndex];
	if (current) {
		updatedQuestions[session.currentIndex] = {
			...current,
			elapsedMs: current.elapsedMs + delta
		};
	}
	return updatedQuestions;
}

export async function submitAnswer(label: string, db: Database): Promise<void> {
	const session = get(quizSession);
	if (!session) return;

	const current = session.questions[session.currentIndex];
	if (!current) return;

	const selectedAnswer = current.presentedAnswers.find((a) => a.label === label);
	if (!selectedAnswer) return;

	const updatedQuestions = snapshotElapsed(session);
	updatedQuestions[session.currentIndex] = {
		...updatedQuestions[session.currentIndex],
		selectedLabel: label,
		submittedLabel: label
	};

	const isEditing = session.currentIndex < frontierIndex;

	if (isEditing) {
		// Return to frontier after changing a previous answer
		quizSession.set({
			...session,
			questions: updatedQuestions,
			currentIndex: frontierIndex
		});
	} else {
		// Normal forward progression
		const isLast = frontierIndex >= session.questions.length - 1;

		if (isLast) {
			quizSession.set({
				...session,
				questions: updatedQuestions,
				currentIndex: session.currentIndex,
				completed: true
			});
			await finalizeQuiz(updatedQuestions, db);
			viewMode.set('summary');
			return;
		} else {
			frontierIndex = session.currentIndex + 1;
			quizSession.set({
				...session,
				questions: updatedQuestions,
				currentIndex: frontierIndex,
				completed: false
			});
		}
	}
}

async function finalizeQuiz(questions: QuizQuestion[], db: Database): Promise<void> {
	for (const qq of questions) {
		if (!qq.submittedLabel) continue;
		const answer = qq.presentedAnswers.find((a) => a.label === qq.submittedLabel);
		if (!answer) continue;
		const points = scoreAnswer(answer.category);
		updateScore(db, qq.question.id, points);
		recordAnswer(db, sessionId, qq.question.id, answer.category, points, qq.elapsedMs);
	}
	await persistDatabase(db, activeQuizName);
}

export function editAnsweredQuestion(index: number): void {
	const session = get(quizSession);
	if (!session || index >= frontierIndex) return;

	const updatedQuestions = snapshotElapsed(session);

	quizSession.set({
		...session,
		questions: updatedQuestions,
		currentIndex: index
	});

	questionStartTime = Date.now();
	reviewIndex.set(null);
	viewMode.set('quiz');
}

export function retakeQuiz(db: Database, allQuestions: Question[], scores: QuestionScore[]): void {
	const session = get(quizSession);
	if (!session) return;

	sessionId = crypto.randomUUID();
	frontierIndex = 0;

	const questions: QuizQuestion[] = session.questions.map((qq) => ({
		question: qq.question,
		presentedAnswers: presentAnswers(qq.question, session.config.answerCount),
		selectedLabel: null,
		submittedLabel: null,
		elapsedMs: 0
	}));

	quizSession.set({
		...session,
		questions,
		currentIndex: 0,
		completed: false
	});

	questionStartTime = Date.now();
	viewMode.set('quiz');
}

export function newQuiz(): void {
	quizSession.set(null);
	reviewIndex.set(null);
	viewMode.set('nav');
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

export function showAnsweredQuestions(): void {
	const session = get(quizSession);
	if (!session || frontierIndex === 0) return;

	const updatedQuestions = snapshotElapsed(session);
	quizSession.set({
		...session,
		questions: updatedQuestions
	});

	reviewIndex.set(null);
	viewMode.set('quiz-answered');
}

export function backToQuiz(): void {
	const session = get(quizSession);
	if (session) {
		quizSession.set({
			...session,
			currentIndex: frontierIndex
		});
	}
	questionStartTime = Date.now();
	reviewIndex.set(null);
	viewMode.set('quiz');
}

export function reviewPrev(): void {
	const idx = get(reviewIndex);
	if (idx !== null && idx > 0) {
		reviewIndex.set(idx - 1);
	}
}

export function reviewNext(): void {
	const session = get(quizSession);
	const idx = get(reviewIndex);
	if (!session || idx === null) return;

	if (idx < session.questions.length - 1) {
		reviewIndex.set(idx + 1);
	}
}
