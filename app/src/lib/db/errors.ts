// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

export class WasmAssetMissingError extends Error {
	readonly assetUrl: string;

	constructor(assetUrl: string, cause?: unknown) {
		super(
			`sql.js WASM asset is unavailable at ${assetUrl}. ` +
				`Quiz progress recording is disabled until this asset can be served.`
		);
		this.name = 'WasmAssetMissingError';
		this.assetUrl = assetUrl;
		if (cause !== undefined) {
			(this as { cause?: unknown }).cause = cause;
		}
	}
}
