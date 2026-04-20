// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

export const MANIFEST_SCHEMA_VERSION_MAJOR = 1;

export function isCompatible(manifestVersion: string | undefined): 'ok' | 'mismatch' {
	const effective = manifestVersion ?? '1.0';
	const match = /^(\d+)\./.exec(effective);
	if (!match) return 'mismatch';
	const major = Number.parseInt(match[1], 10);
	return major === MANIFEST_SCHEMA_VERSION_MAJOR ? 'ok' : 'mismatch';
}
