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
import { formatTime } from '$lib/utils/format';

describe('formatTime', () => {
	it('formats 0ms as 0:00', () => {
		expect(formatTime(0)).toBe('0:00');
	});

	it('formats seconds with leading zero', () => {
		expect(formatTime(5000)).toBe('0:05');
	});

	it('formats full minutes and seconds', () => {
		expect(formatTime(65000)).toBe('1:05');
	});

	it('formats exact minutes', () => {
		expect(formatTime(120000)).toBe('2:00');
	});

	it('handles large values', () => {
		expect(formatTime(3661000)).toBe('61:01');
	});

	it('truncates sub-second precision', () => {
		expect(formatTime(1999)).toBe('0:01');
	});
});
