// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { writable, derived } from 'svelte/store';
import type { NavNode, Question, QuizManifest } from '$lib/types';

export const activeManifest = writable<QuizManifest | null>(null);

export const questions = derived(activeManifest, ($m): Question[] => $m?.questions ?? []);

export const navTree = derived(activeManifest, ($m): NavNode[] => $m?.tree ?? []);

export const allTags = derived(questions, ($q): string[] =>
	[...new Set($q.flatMap((q) => q.tags))].sort()
);
