<!-- Copyright (c) 2026 Pointmatic -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { onMount } from 'svelte';
	import type { QuizQuestion } from '$lib/types';

	interface Props {
		answeredQuestions: QuizQuestion[];
		currentQuestionNumber: number;
		totalQuestions: number;
		onSelect: (index: number) => void;
		onBack: () => void;
	}

	let { answeredQuestions, currentQuestionNumber, totalQuestions, onSelect, onBack }: Props =
		$props();

	let rootEl: HTMLDivElement | undefined = $state();
	onMount(() => rootEl?.focus());

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onBack();
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
	data-quizazz-view="quiz-answered"
>
	<div class="w-full max-w-2xl">
		<button
			type="button"
			class="mb-6 flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
			onclick={onBack}
		>
			<ArrowLeft class="h-4 w-4" />
			Return to Quiz
		</button>

		<div class="mb-6 text-center">
			<h2 class="text-xl font-semibold text-white">Answered Questions</h2>
			<p class="mt-2 text-sm text-gray-400">
				{answeredQuestions.length} of {totalQuestions} answered — currently on question {currentQuestionNumber}
			</p>
		</div>

		<div class="space-y-2">
			{#each answeredQuestions as q, i}
				<button
					type="button"
					class="flex w-full items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 text-left transition-colors hover:border-gray-700 hover:bg-gray-800/80"
					onclick={() => onSelect(i)}
				>
					<span
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-700"
					>
						<span class="text-xs font-bold text-gray-300">{i + 1}</span>
					</span>
					<span class="truncate text-sm text-gray-300">{q.question.question}</span>
				</button>
			{/each}
		</div>
	</div>
</div>
