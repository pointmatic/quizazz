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

import { describe, it, expect } from 'vitest';
import { scoreAnswer, SCORE_MAP } from '$lib/engine/scoring';

describe('scoreAnswer', () => {
	it('correct → +1', () => {
		expect(scoreAnswer('correct')).toBe(1);
	});

	it('partially_correct → -2', () => {
		expect(scoreAnswer('partially_correct')).toBe(-2);
	});

	it('incorrect → -5', () => {
		expect(scoreAnswer('incorrect')).toBe(-5);
	});

	it('ridiculous → -10', () => {
		expect(scoreAnswer('ridiculous')).toBe(-10);
	});
});

describe('SCORE_MAP', () => {
	it('has all four categories', () => {
		expect(Object.keys(SCORE_MAP).sort()).toEqual([
			'correct',
			'incorrect',
			'partially_correct',
			'ridiculous'
		]);
	});
});
