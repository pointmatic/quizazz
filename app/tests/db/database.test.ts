// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	assertWasmAssetAvailable,
	initDatabase,
	WASM_ASSET_URL,
	WasmAssetMissingError
} from '$lib/db';
import { __resetMemoization } from '$lib/db/database';

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
		__resetMemoization();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		__resetMemoization();
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

describe('initDatabase memoization', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		__resetMemoization();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		__resetMemoization();
		vi.restoreAllMocks();
	});

	it('shares one in-flight precheck across concurrent callers', async () => {
		let resolveFetch: (response: Response) => void = () => {};
		const fetchMock = vi.fn().mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					resolveFetch = resolve;
				})
		);
		globalThis.fetch = fetchMock as typeof fetch;

		const p1 = initDatabase('memo-test').catch(() => 'rejected');
		const p2 = initDatabase('memo-test').catch(() => 'rejected');

		// Microtask flush so both calls reach the memoization point before the precheck resolves.
		await Promise.resolve();
		await Promise.resolve();

		expect(fetchMock).toHaveBeenCalledTimes(1);

		// Resolve with 404 so both rejections come from the shared promise and the test exits.
		resolveFetch(new Response(null, { status: 404 }));
		const [r1, r2] = await Promise.all([p1, p2]);
		expect(r1).toBe('rejected');
		expect(r2).toBe('rejected');
	});

	it('clears the memoized state on rejection so a retry runs the precheck again', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 404 }))
			.mockResolvedValueOnce(new Response(null, { status: 404 }));
		globalThis.fetch = fetchMock as typeof fetch;

		await expect(initDatabase('retry-test')).rejects.toBeInstanceOf(WasmAssetMissingError);
		expect(fetchMock).toHaveBeenCalledTimes(1);

		await expect(initDatabase('retry-test')).rejects.toBeInstanceOf(WasmAssetMissingError);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('keys per-quiz memoization slots independently', async () => {
		// Both calls share the precheck (the sql.js init layer is shared across quiz names)
		// but each quiz name owns its own dbPromise slot. Verifiable indirectly: with one
		// fetch invocation served to both, each call's per-quiz slot is independently cleared
		// on rejection — a subsequent call to either name re-issues the precheck.
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 404 }))
			.mockResolvedValueOnce(new Response(null, { status: 404 }));
		globalThis.fetch = fetchMock as typeof fetch;

		const [r1, r2] = await Promise.all([
			initDatabase('alpha').catch((e) => e),
			initDatabase('beta').catch((e) => e)
		]);

		expect(r1).toBeInstanceOf(WasmAssetMissingError);
		expect(r2).toBeInstanceOf(WasmAssetMissingError);
		// Both shared the in-flight sqlJsInit precheck → exactly one fetch.
		expect(fetchMock).toHaveBeenCalledTimes(1);

		// Both slots cleared independently — a fresh call retries.
		await expect(initDatabase('alpha')).rejects.toBeInstanceOf(WasmAssetMissingError);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
