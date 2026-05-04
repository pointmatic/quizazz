// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { writable } from 'svelte/store';
import { WasmAssetMissingError } from '$lib/db';

export type DbInitStatus = 'pending' | 'ready' | 'wasm-missing' | 'failed';

export const dbInit = writable<DbInitStatus>('pending');

export function classifyDbInitError(err: unknown): Exclude<DbInitStatus, 'pending' | 'ready'> {
	return err instanceof WasmAssetMissingError ? 'wasm-missing' : 'failed';
}
