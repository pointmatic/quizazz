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
	import { BookOpen } from 'lucide-svelte';

	interface Props {
		maxQuestions: number;
		onStart: (questionCount: number, answerCount: 3 | 4 | 5) => void;
	}

	let { maxQuestions, onStart }: Props = $props();

	let questionCount = $state(Math.min(10, maxQuestions));
	$effect(() => {
		questionCount = Math.min(questionCount, maxQuestions);
	});
	let answerCount = $state<3 | 4 | 5>(4);

	function handleStart() {
		if (questionCount >= 1 && questionCount <= maxQuestions) {
			onStart(questionCount, answerCount);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleStart();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="flex min-h-screen items-center justify-center bg-gray-950 px-4">
	<div class="w-full max-w-md">
		<div class="mb-10 text-center">
			<div class="mb-4 flex justify-center">
				<div class="rounded-2xl bg-indigo-500/10 p-4">
					<BookOpen class="h-10 w-10 text-indigo-400" />
				</div>
			</div>
			<h1 class="text-3xl font-bold tracking-tight text-white">Quizazz</h1>
			<p class="mt-2 text-sm text-gray-400">
				{maxQuestions} questions available
			</p>
		</div>

		<div class="space-y-6 rounded-2xl border border-gray-800 bg-gray-900 p-6">
			<!-- Question count -->
			<div>
				<label for="question-count" class="mb-2 block text-sm font-medium text-gray-300">
					Number of questions
				</label>
				<div class="flex items-center gap-4">
					<input
						id="question-count"
						type="range"
						min="1"
						max={maxQuestions}
						bind:value={questionCount}
						class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-indigo-500"
					/>
					<span class="w-10 text-right text-lg font-semibold text-white tabular-nums">
						{questionCount}
					</span>
				</div>
			</div>

			<!-- Answer count -->
			<div>
				<span class="mb-3 block text-sm font-medium text-gray-300">
					Answer choices
				</span>
				<div class="flex gap-3">
					{#each [3, 4, 5] as count}
						<button
							type="button"
							class="flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-colors {answerCount === count
								? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
								: 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-300'}"
							onclick={() => (answerCount = count as 3 | 4 | 5)}
						>
							{count}
						</button>
					{/each}
				</div>
			</div>

			<!-- Start button -->
			<button
				type="button"
				class="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={questionCount < 1 || questionCount > maxQuestions}
				onclick={handleStart}
			>
				Start Quiz
			</button>
		</div>
	</div>
</div>
