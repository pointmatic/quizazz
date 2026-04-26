// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import type { QuizManifest } from '$lib/types';

const modules = import.meta.glob<QuizManifest>('./*.json', { eager: true, import: 'default' });

export const manifests: QuizManifest[] = Object.values(modules).map((m) => m as QuizManifest);
