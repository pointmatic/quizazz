// Copyright (c) 2026 Pointmatic
// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { statSync } from 'node:fs';

const cli = resolve(process.cwd(), 'node_modules/.bin/tailwindcss');
const input = 'src/lib/embed/styles.css';
const output = 'dist/styles.css';

execFileSync(cli, ['-i', input, '-o', output, '--minify'], { stdio: 'inherit' });

const sizeKb = (statSync(output).size / 1024).toFixed(1);
console.log(`build-styles: emitted ${output} (${sizeKb} KB minified)`);
