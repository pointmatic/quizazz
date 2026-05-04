// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

export {
	getDbName,
	initDatabase,
	persistDatabase,
	createSchema,
	assertWasmAssetAvailable,
	WASM_ASSET_URL
} from './database';
export { getScores, updateScore, seedScores, recordAnswer } from './scores';
export { WasmAssetMissingError } from './errors';
