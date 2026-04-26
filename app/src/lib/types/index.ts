// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

export type AnswerCategory = 'correct' | 'partially_correct' | 'incorrect' | 'ridiculous';

export interface Answer {
	text: string;
	explanation: string;
	category: AnswerCategory;
}

export interface Question {
	id: string;
	question: string;
	tags: string[];
	answers: Answer[];
	topicId: string;
	subtopic: string | null;
}

export type NavNodeType = 'directory' | 'topic' | 'subtopic';

export interface NavNode {
	id: string;
	label: string;
	description: string;
	type: NavNodeType;
	questionIds: string[];
	children: NavNode[];
}

export interface QuizManifest {
	schemaVersion?: string;
	quizName: string;
	tree: NavNode[];
	questions: Question[];
}

export interface QuizConfig {
	questionCount: number;
	answerCount: 3 | 4 | 5;
	selectedTags: string[];
	selectedNodeIds: string[];
}

export interface PresentedAnswer extends Answer {
	label: string;
}

export interface QuizQuestion {
	question: Question;
	presentedAnswers: PresentedAnswer[];
	selectedLabel: string | null;
	submittedLabel: string | null;
	elapsedMs: number;
}

export interface QuizSession {
	config: QuizConfig;
	questions: QuizQuestion[];
	currentIndex: number;
	completed: boolean;
}

export interface QuestionScore {
	questionId: string;
	cumulativeScore: number;
}
