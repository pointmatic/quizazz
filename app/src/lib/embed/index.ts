// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

export { default as QuizBlock } from './QuizBlock.svelte';
export type { QuizCompleteEvent } from './QuizBlock.svelte';
export type { QuizErrorEvent, QuizErrorType } from '$lib/types';
export { MANIFEST_SCHEMA_VERSION_MAJOR, isCompatible } from './schema-version';
