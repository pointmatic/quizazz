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

import { describe, it, expect, beforeEach } from 'vitest';
import initSqlJs, { type Database } from 'sql.js';
import { createSchema } from '$lib/db/database';
import { getScores, updateScore, seedScores, recordAnswer } from '$lib/db/scores';

let db: Database;

beforeEach(async () => {
	const SQL = await initSqlJs();
	db = new SQL.Database();
	createSchema(db);
});

describe('seedScores', () => {
	it('initializes all questions to score 0', () => {
		seedScores(db, ['q1', 'q2', 'q3']);
		const scores = getScores(db);
		expect(scores).toHaveLength(3);
		for (const s of scores) {
			expect(s.cumulativeScore).toBe(0);
		}
	});

	it('is idempotent (INSERT OR IGNORE)', () => {
		seedScores(db, ['q1', 'q2']);
		updateScore(db, 'q1', 5);
		seedScores(db, ['q1', 'q2', 'q3']);

		const scores = getScores(db);
		expect(scores).toHaveLength(3);

		const q1 = scores.find((s) => s.questionId === 'q1');
		expect(q1?.cumulativeScore).toBe(5);
	});
});

describe('getScores', () => {
	it('returns empty array when no scores exist', () => {
		const scores = getScores(db);
		expect(scores).toEqual([]);
	});

	it('returns all seeded questions', () => {
		seedScores(db, ['q1', 'q2']);
		const scores = getScores(db);
		expect(scores).toHaveLength(2);
		expect(scores.map((s) => s.questionId).sort()).toEqual(['q1', 'q2']);
	});
});

describe('updateScore', () => {
	it('increments score with positive points', () => {
		seedScores(db, ['q1']);
		updateScore(db, 'q1', 1);
		const scores = getScores(db);
		expect(scores[0].cumulativeScore).toBe(1);
	});

	it('decrements score with negative points', () => {
		seedScores(db, ['q1']);
		updateScore(db, 'q1', -5);
		const scores = getScores(db);
		expect(scores[0].cumulativeScore).toBe(-5);
	});

	it('accumulates across multiple updates', () => {
		seedScores(db, ['q1']);
		updateScore(db, 'q1', 1);
		updateScore(db, 'q1', -10);
		updateScore(db, 'q1', 1);
		const scores = getScores(db);
		expect(scores[0].cumulativeScore).toBe(-8);
	});
});

describe('recordAnswer', () => {
	it('inserts a session answer record', () => {
		seedScores(db, ['q1']);
		recordAnswer(db, 'session-1', 'q1', 'correct', 1);

		const results = db.exec('SELECT session_id, question_id, selected_category, points FROM session_answers');
		expect(results).toHaveLength(1);
		expect(results[0].values).toHaveLength(1);

		const row = results[0].values[0];
		expect(row[0]).toBe('session-1');
		expect(row[1]).toBe('q1');
		expect(row[2]).toBe('correct');
		expect(row[3]).toBe(1);
	});

	it('records multiple answers for same session', () => {
		seedScores(db, ['q1', 'q2']);
		recordAnswer(db, 'session-1', 'q1', 'correct', 1);
		recordAnswer(db, 'session-1', 'q2', 'ridiculous', -10);

		const results = db.exec('SELECT * FROM session_answers');
		expect(results[0].values).toHaveLength(2);
	});
});
