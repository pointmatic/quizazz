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

	interface Props {
		question: QuizQuestion;
		onBack: () => void;
	}

	let { question, onBack }: Props = $props();

	const categoryLabels: Record<string, string> = {
		correct: 'Correct',
		partially_correct: 'Partially Correct',
		incorrect: 'Incorrect',
		ridiculous: 'Ridiculous'
	};

	const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
		correct: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
		partially_correct: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
		incorrect: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
		ridiculous: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' }
	};

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
			onBack();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="flex min-h-screen items-center justify-center bg-gray-950 px-4">
	<div class="w-full max-w-2xl">
		<button
			type="button"
			class="mb-6 flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
			onclick={onBack}
		>
			<ArrowLeft class="h-4 w-4" />
			Back to Summary
		</button>

		<div class="rounded-2xl border border-gray-800 bg-gray-900 p-6">
			<h2 class="mb-6 text-xl font-semibold text-white">
				{question.question.question}
			</h2>

			<div class="space-y-3">
				{#each question.presentedAnswers as answer}
					{@const isUserChoice = answer.label === question.submittedLabel}
					{@const colors = categoryColors[answer.category]}
					<div
						class="rounded-xl border-2 px-4 py-3 {isUserChoice ? 'ring-2 ring-indigo-500/50' : ''} {colors.border} {colors.bg}"
					>
						<div class="flex items-start gap-3">
							<span
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold uppercase {isUserChoice ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-300'}"
							>
								{answer.label}
							</span>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium text-gray-200">{answer.text}</span>
									{#if isUserChoice}
										<span class="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
											Your answer
										</span>
									{/if}
								</div>
								<div class="mt-1 flex items-center gap-2">
									<span class="rounded-full px-2 py-0.5 text-xs font-medium {colors.bg} {colors.text}">
										{categoryLabels[answer.category]}
									</span>
								</div>
								<p class="mt-2 text-sm text-gray-400">
									{answer.explanation}
								</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
