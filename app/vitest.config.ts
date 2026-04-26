// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	test: {
		include: ['tests/**/*.test.ts']
	}
});
