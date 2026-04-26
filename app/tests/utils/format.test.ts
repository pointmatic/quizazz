// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

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
