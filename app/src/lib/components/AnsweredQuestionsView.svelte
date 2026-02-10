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
	import { ArrowLeft, Check, X } from 'lucide-svelte';
	import type { QuizQuestion } from '$lib/types';

	interface Props {
		answeredQuestions: QuizQuestion[];
		currentQuestionNumber: number;
		totalQuestions: number;
		onReview: (index: number) => void;
		onBack: () => void;
	}

	let { answeredQuestions, currentQuestionNumber, totalQuestions, onReview, onBack }: Props =
		$props();

	function isCorrect(q: QuizQuestion): boolean {
		const submitted = q.presentedAnswers.find((a) => a.label === q.submittedLabel);
		return submitted?.category === 'correct';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
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
					onclick={() => onReview(i)}
				>
					<span
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full {isCorrect(q)
							? 'bg-emerald-500/20'
							: 'bg-red-500/20'}"
					>
						{#if isCorrect(q)}
							<Check class="h-4 w-4 text-emerald-400" />
						{:else}
							<X class="h-4 w-4 text-red-400" />
						{/if}
					</span>
					<span class="truncate text-sm text-gray-300">{q.question.question}</span>
				</button>
			{/each}
		</div>
	</div>
</div>
