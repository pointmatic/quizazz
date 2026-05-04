// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	assertWasmAssetAvailable,
	initDatabase,
	WASM_ASSET_URL,
	WasmAssetMissingError
} from '$lib/db';

describe('assertWasmAssetAvailable', () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('resolves when the HEAD response is OK', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		globalThis.fetch = fetchMock as typeof fetch;

		await expect(assertWasmAssetAvailable('/sql-wasm.wasm')).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('sends HEAD with cache: no-store', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		globalThis.fetch = fetchMock as typeof fetch;

		await assertWasmAssetAvailable('/sql-wasm.wasm');

		expect(fetchMock).toHaveBeenCalledWith('/sql-wasm.wasm', {
			method: 'HEAD',
			cache: 'no-store'
		});
	});

	it('throws WasmAssetMissingError on a 404 response', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
		globalThis.fetch = fetchMock as typeof fetch;

		await expect(assertWasmAssetAvailable('/sql-wasm.wasm')).rejects.toMatchObject({
			name: 'WasmAssetMissingError',
			assetUrl: '/sql-wasm.wasm'
		});
	});

	it('throws WasmAssetMissingError with cause on a network failure', async () => {
		const networkErr = new TypeError('NetworkError when attempting to fetch resource.');
		const fetchMock = vi.fn().mockRejectedValue(networkErr);
		globalThis.fetch = fetchMock as typeof fetch;

		try {
			await assertWasmAssetAvailable('/sql-wasm.wasm');
			throw new Error('expected assertWasmAssetAvailable to reject');
		} catch (err) {
			expect(err).toBeInstanceOf(WasmAssetMissingError);
			expect((err as WasmAssetMissingError).assetUrl).toBe('/sql-wasm.wasm');
			expect((err as { cause?: unknown }).cause).toBe(networkErr);
		}
	});
});

describe('initDatabase precheck', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		// Each test installs its own fetch mock.
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('throws WasmAssetMissingError when the precheck 404s (no sql.js init)', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
		globalThis.fetch = fetchMock as typeof fetch;

		await expect(initDatabase('test-quiz')).rejects.toMatchObject({
			name: 'WasmAssetMissingError',
			assetUrl: WASM_ASSET_URL
		});
	});

	it('throws WasmAssetMissingError on fetch network failure', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new TypeError('network down'));
		globalThis.fetch = fetchMock as typeof fetch;

		await expect(initDatabase('test-quiz')).rejects.toBeInstanceOf(WasmAssetMissingError);
	});
});
