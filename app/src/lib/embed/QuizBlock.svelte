<!-- Copyright (c) 2026 Pointmatic -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script module lang="ts">
	let mountCount = 0;
	let activeQuizRef = '';
</script>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { QuizManifest } from '$lib/types';
	import { initDatabase, seedScores } from '$lib/db';
	import { activeManifest } from '$lib/stores/manifest';
	import { setNavNodes } from '$lib/engine/lifecycle';
	import { isCompatible } from './schema-version';

	export interface QuizCompleteEvent {
		quizRef: string;
		score: number;
		maxScore: number;
		questionCount: number;
	}

	interface Props {
		manifest: QuizManifest;
		quizRef: string;
		class?: string;
		oncomplete?: (event: QuizCompleteEvent) => void;
	}

	const { manifest, quizRef, class: className = '', oncomplete: _oncomplete }: Props = $props();

	let blocked = $state(false);
	let blockedBy = $state('');
	let schemaStatus = $state<'ok' | 'mismatch'>('ok');

	onMount(async () => {
		if (mountCount >= 1) {
			blocked = true;
			blockedBy = activeQuizRef;
			console.error(
				`[quizazz] <QuizBlock> single-instance-per-page violation: ` +
					`quizRef="${activeQuizRef}" is already mounted; refusing to mount quizRef="${quizRef}". ` +
					`See the @pointmatic/quizazz README for the rationale and roadmap.`
			);
			return;
		}
		mountCount = 1;
		activeQuizRef = quizRef;

		schemaStatus = isCompatible(manifest.schemaVersion);

		const db = await initDatabase(manifest.quizName);
		seedScores(db, manifest.questions.map((q) => q.id));
		activeManifest.set(manifest);
		setNavNodes(manifest.tree);
	});

	onDestroy(() => {
		if (!blocked) {
			mountCount = 0;
			activeQuizRef = '';
		}
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<section tabindex="0" class={className}>
	{#if blocked}
		<aside data-quizazz-error>
			<p>
				Only one &lt;QuizBlock&gt; can be mounted per page in this release. The page already has
				<code>{blockedBy}</code> mounted; <code>{quizRef}</code> was not started.
			</p>
		</aside>
	{:else if schemaStatus === 'mismatch'}
		<aside data-quizazz-warning>
			<p>
				This manifest declares <code>schemaVersion={manifest.schemaVersion ?? 'unknown'}</code>,
				which is a different major version than this component supports. The quiz will still
				render, but some fields may not be interpreted correctly.
			</p>
		</aside>
	{/if}
</section>
