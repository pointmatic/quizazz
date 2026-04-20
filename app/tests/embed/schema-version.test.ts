// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { MANIFEST_SCHEMA_VERSION_MAJOR, isCompatible } from '$lib/embed/schema-version';

describe('MANIFEST_SCHEMA_VERSION_MAJOR', () => {
	it('is 1', () => {
		expect(MANIFEST_SCHEMA_VERSION_MAJOR).toBe(1);
	});
});

describe('isCompatible', () => {
	it('returns "ok" for matching major version "1.0"', () => {
		expect(isCompatible('1.0')).toBe('ok');
	});

	it('returns "ok" for any minor bump within major 1 (e.g., "1.5")', () => {
		expect(isCompatible('1.5')).toBe('ok');
	});

	it('returns "mismatch" for a different major version ("2.0")', () => {
		expect(isCompatible('2.0')).toBe('mismatch');
	});

	it('returns "mismatch" for a lower major version ("0.9")', () => {
		expect(isCompatible('0.9')).toBe('mismatch');
	});

	it('treats undefined as "1.0" (pre-Phase-K manifests) → "ok"', () => {
		expect(isCompatible(undefined)).toBe('ok');
	});

	it('returns "mismatch" for malformed version strings', () => {
		expect(isCompatible('not-a-version')).toBe('mismatch');
	});
});
