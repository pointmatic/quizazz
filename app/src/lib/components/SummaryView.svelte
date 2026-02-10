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
	import { Trophy, RotateCcw, Play, LogOut, Check, X } from 'lucide-svelte';
	import type { QuizQuestion } from '$lib/types';

	interface Props {
		questions: QuizQuestion[];
		onRetake: () => void;
		onNewQuiz: () => void;
		onQuit: () => void;
		onReview: (index: number) => void;
	}

	let { questions, onRetake, onNewQuiz, onQuit, onReview }: Props = $props();

	let totalQuestions = $derived(questions.length);
	let correctCount = $derived(
		questions.filter((q) => {
			const submitted = q.presentedAnswers.find((a) => a.label === q.submittedLabel);
			return submitted?.category === 'correct';
		}).length
	);
	let scorePercent = $derived(totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0);

	function isCorrect(q: QuizQuestion): boolean {
		const submitted = q.presentedAnswers.find((a) => a.label === q.submittedLabel);
		return submitted?.category === 'correct';
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-950 px-4">
	<div class="w-full max-w-2xl">
		<!-- Score header -->
		<div class="mb-8 text-center">
			<div class="mb-4 flex justify-center">
				<div class="rounded-2xl {scorePercent >= 70 ? 'bg-emerald-500/10' : scorePercent >= 40 ? 'bg-amber-500/10' : 'bg-red-500/10'} p-4">
					<Trophy class="h-10 w-10 {scorePercent >= 70 ? 'text-emerald-400' : scorePercent >= 40 ? 'text-amber-400' : 'text-red-400'}" />
				</div>
			</div>
			<div class="text-5xl font-bold {scorePercent >= 70 ? 'text-emerald-400' : scorePercent >= 40 ? 'text-amber-400' : 'text-red-400'}">
				{scorePercent}%
			</div>
			<p class="mt-2 text-sm text-gray-400">
				{correctCount} of {totalQuestions} correct
			</p>
		</div>

		<!-- Question list -->
		<div class="mb-8 space-y-2">
			{#each questions as q, i}
				<button
					type="button"
					class="flex w-full items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 text-left transition-colors hover:border-gray-700 hover:bg-gray-800/80"
					onclick={() => onReview(i)}
				>
					<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full {isCorrect(q) ? 'bg-emerald-500/20' : 'bg-red-500/20'}">
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

		<!-- Action buttons -->
		<div class="flex gap-3">
			<button
				type="button"
				class="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
				onclick={onRetake}
			>
				<RotateCcw class="h-4 w-4" />
				Retake
			</button>
			<button
				type="button"
				class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
				onclick={onNewQuiz}
			>
				<Play class="h-4 w-4" />
				Start New
			</button>
			<button
				type="button"
				class="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
				onclick={onQuit}
			>
				<LogOut class="h-4 w-4" />
				Quit
			</button>
		</div>
	</div>
</div>
