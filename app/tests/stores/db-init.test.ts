// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { dbInit, classifyDbInitError } from '$lib/stores/db-init';
import { WasmAssetMissingError } from '$lib/db';

beforeEach(() => {
	dbInit.set('pending');
});

describe('dbInit store', () => {
	it('starts in "pending"', () => {
		expect(get(dbInit)).toBe('pending');
	});

	it('accepts each documented status value', () => {
		dbInit.set('ready');
		expect(get(dbInit)).toBe('ready');
		dbInit.set('wasm-missing');
		expect(get(dbInit)).toBe('wasm-missing');
		dbInit.set('failed');
		expect(get(dbInit)).toBe('failed');
		dbInit.set('pending');
		expect(get(dbInit)).toBe('pending');
	});

	it('does not notify subscribers when set to the same value (svelte/store same-value de-dup)', () => {
		dbInit.set('ready');
		const subscriber = vi.fn();
		const unsub = dbInit.subscribe(subscriber);
		expect(subscriber).toHaveBeenCalledTimes(1);
		dbInit.set('ready');
		dbInit.set('ready');
		expect(subscriber).toHaveBeenCalledTimes(1);
		unsub();
	});
});

describe('classifyDbInitError', () => {
	it('returns "wasm-missing" for a WasmAssetMissingError instance', () => {
		const err = new WasmAssetMissingError('/sql-wasm.wasm');
		expect(classifyDbInitError(err)).toBe('wasm-missing');
	});

	it('returns "failed" for a generic Error', () => {
		expect(classifyDbInitError(new Error('boom'))).toBe('failed');
	});

	it('returns "failed" for non-Error rejections', () => {
		expect(classifyDbInitError('something bad')).toBe('failed');
		expect(classifyDbInitError(null)).toBe('failed');
		expect(classifyDbInitError(undefined)).toBe('failed');
	});
});
