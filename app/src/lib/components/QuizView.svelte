<!-- Copyright (c) 2026 Pointmatic -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import { ArrowLeft, Clock } from 'lucide-svelte';
	import { onDestroy, onMount } from 'svelte';
	import type { QuizQuestion } from '$lib/types';
	import { formatTime } from '$lib/utils/format';
	import ProgressBar from './ProgressBar.svelte';

	interface Props {
		question: QuizQuestion;
		progressCurrent: number;
		progressTotal: number;
		progressPercent: number;
		hasAnswered: boolean;
		startedAt: number;
		onSubmit: (label: string) => void;
		onShowAnswered: () => void;
	}

	let { question, progressCurrent, progressTotal, progressPercent, hasAnswered, startedAt, onSubmit, onShowAnswered }: Props = $props();

	let selectedLabel = $state<string | null>(null);
	let now = $state(Date.now());
	let rootEl: HTMLDivElement | undefined = $state();

	const timer = setInterval(() => { now = Date.now(); }, 1000);
	onDestroy(() => clearInterval(timer));
	onMount(() => rootEl?.focus());

	let displayMs = $derived(question.elapsedMs + (now - startedAt));

	$effect(() => {
		// Pre-select previous answer when editing, or reset for new questions
		selectedLabel = question.submittedLabel;
	});

	function handleSubmit() {
		if (selectedLabel) {
			onSubmit(selectedLabel);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && hasAnswered) {
			onShowAnswered();
			return;
		}

		const key = e.key.toLowerCase();
		const validLabels = question.presentedAnswers.map((a) => a.label);

		if (validLabels.includes(key)) {
			selectedLabel = key;
		} else if (e.key === 'Enter' && selectedLabel) {
			handleSubmit();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="flex min-h-screen items-center justify-center bg-gray-950 px-4 focus:outline-none"
	tabindex="-1"
	bind:this={rootEl}
	onkeydown={handleKeydown}
	data-quizazz-view="quiz"
>
	<div class="w-full max-w-2xl">
		{#if hasAnswered}
			<button
				type="button"
				class="mb-4 flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
				onclick={onShowAnswered}
			>
				<ArrowLeft class="h-4 w-4" />
				Back to Answered Questions
			</button>
		{/if}

		<div class="mb-8 flex items-center gap-4">
			<div class="flex-1">
				<ProgressBar current={progressCurrent} total={progressTotal} percent={progressPercent} />
			</div>
			<div class="flex items-center gap-1.5 text-sm tabular-nums text-gray-400">
				<Clock class="h-4 w-4" />
				{formatTime(displayMs)}
			</div>
		</div>

		<div class="rounded-2xl border border-gray-800 bg-gray-900 p-6">
			<h2 class="mb-6 text-xl font-semibold text-white">
				{question.question.question}
			</h2>

			<div class="space-y-3">
				{#each question.presentedAnswers as answer}
					<button
						type="button"
						class="flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors {selectedLabel === answer.label
							? 'border-indigo-500 bg-indigo-500/10'
							: 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}"
						onclick={() => (selectedLabel = answer.label)}
					>
						<span
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold uppercase {selectedLabel === answer.label
								? 'bg-indigo-500 text-white'
								: 'bg-gray-700 text-gray-300'}"
						>
							{answer.label}
						</span>
						<span class="text-sm {selectedLabel === answer.label ? 'text-indigo-200' : 'text-gray-300'}">
							{answer.text}
						</span>
					</button>
				{/each}
			</div>

			<div class="mt-6">
				<button
					type="button"
					class="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!selectedLabel}
					onclick={handleSubmit}
				>
					Submit
				</button>
			</div>
		</div>
	</div>
</div>
