// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import RecordingPausedBanner from '$lib/components/RecordingPausedBanner.svelte';
import { dbInit } from '$lib/stores/db-init';
import { activeManifest } from '$lib/stores/manifest';
import type { QuizManifest } from '$lib/types';

function manifest(quizName: string): QuizManifest {
	return {
		schemaVersion: '1.0',
		quizName,
		tree: [],
		questions: []
	};
}

beforeEach(() => {
	dbInit.set('pending');
	activeManifest.set(null);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe('RecordingPausedBanner', () => {
	it('renders nothing on "pending"', () => {
		const { container } = render(RecordingPausedBanner);
		expect(container.querySelector('aside')).toBeNull();
	});

	it('renders nothing on "ready"', async () => {
		const { container } = render(RecordingPausedBanner);
		dbInit.set('ready');
		await tick();
		expect(container.querySelector('aside')).toBeNull();
	});

	it('renders a Reload action on "wasm-missing"', async () => {
		const { container, getByRole } = render(RecordingPausedBanner);
		dbInit.set('wasm-missing');
		await tick();
		const aside = container.querySelector('aside');
		expect(aside).not.toBeNull();
		expect(aside!.getAttribute('role')).toBe('alert');
		expect(getByRole('button', { name: /reload/i })).toBeTruthy();
	});

	it('renders a Reset Database action on "failed"', async () => {
		const { container, getByRole } = render(RecordingPausedBanner);
		dbInit.set('failed');
		await tick();
		const aside = container.querySelector('aside');
		expect(aside).not.toBeNull();
		expect(getByRole('button', { name: /reset database/i })).toBeTruthy();
	});

	it('Reload action calls window.location.reload()', async () => {
		const reload = vi.fn();
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: { reload }
		});

		const { getByRole } = render(RecordingPausedBanner);
		dbInit.set('wasm-missing');
		await tick();
		await fireEvent.click(getByRole('button', { name: /reload/i }));
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it('Reset Database action deletes the active quiz IDB and reloads', async () => {
		activeManifest.set(manifest('geography'));

		const deleteRequests: { name: string; req: { onsuccess?: () => void } }[] = [];
		const deleteDatabase = vi.fn((name: string) => {
			const req: { onsuccess?: () => void; onerror?: () => void; onblocked?: () => void } = {};
			deleteRequests.push({ name, req });
			queueMicrotask(() => req.onsuccess?.());
			return req as unknown as IDBOpenDBRequest;
		});
		Object.defineProperty(window, 'indexedDB', {
			configurable: true,
			value: { deleteDatabase }
		});

		const reload = vi.fn();
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: { reload }
		});

		const { getByRole } = render(RecordingPausedBanner);
		dbInit.set('failed');
		await tick();
		await fireEvent.click(getByRole('button', { name: /reset database/i }));

		await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
		expect(deleteDatabase).toHaveBeenCalledWith('quizazz-geography');
	});

	it('Reset Database reloads even if no manifest is active', async () => {
		const reload = vi.fn();
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: { reload }
		});

		const { getByRole } = render(RecordingPausedBanner);
		dbInit.set('failed');
		await tick();
		await fireEvent.click(getByRole('button', { name: /reset database/i }));
		await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
	});
});
