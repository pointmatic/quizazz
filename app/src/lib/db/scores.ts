// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import type { Database } from 'sql.js';
import type { AnswerCategory, QuestionScore } from '$lib/types';

export function getScores(db: Database): QuestionScore[] {
	const results = db.exec('SELECT question_id, cumulative_score FROM question_scores');
	if (results.length === 0) return [];

	return results[0].values.map((row) => ({
		questionId: row[0] as string,
		cumulativeScore: row[1] as number
	}));
}

export function updateScore(db: Database, questionId: string, points: number): void {
	db.run('UPDATE question_scores SET cumulative_score = cumulative_score + ? WHERE question_id = ?', [
		points,
		questionId
	]);
}

export function seedScores(db: Database, questionIds: string[]): void {
	const stmt = db.prepare('INSERT OR IGNORE INTO question_scores (question_id, cumulative_score) VALUES (?, 0)');
	for (const id of questionIds) {
		stmt.run([id]);
	}
	stmt.free();
}

export function recordAnswer(
	db: Database,
	sessionId: string,
	questionId: string,
	category: AnswerCategory,
	points: number,
	elapsedMs: number = 0
): void {
	db.run(
		'INSERT INTO session_answers (session_id, question_id, selected_category, points, timestamp, elapsed_ms) VALUES (?, ?, ?, ?, ?, ?)',
		[sessionId, questionId, category, points, Date.now(), elapsedMs]
	);
}
