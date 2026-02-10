<!--
  Copyright (c) 2026 Pointmatic

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->

<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
	import type { QuizQuestion } from '$lib/types';
	import ProgressBar from './ProgressBar.svelte';

	interface Props {
		question: QuizQuestion;
		progressCurrent: number;
		progressTotal: number;
		progressPercent: number;
		hasAnswered: boolean;
		onSubmit: (label: string) => void;
		onShowAnswered: () => void;
	}

	let { question, progressCurrent, progressTotal, progressPercent, hasAnswered, onSubmit, onShowAnswered }: Props = $props();

	let selectedLabel = $state<string | null>(null);

	$effect(() => {
		// Reset selection when question changes
		question;
		selectedLabel = null;
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

<svelte:window on:keydown={handleKeydown} />

<div class="flex min-h-screen items-center justify-center bg-gray-950 px-4">
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

		<div class="mb-8">
			<ProgressBar current={progressCurrent} total={progressTotal} percent={progressPercent} />
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
