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
	import type { Question } from '$lib/types';

	interface Props {
		questions: Question[];
		allTags: string[];
		onStart: (questionCount: number, answerCount: 3 | 4 | 5, selectedTags: string[]) => void;
	}

	let { questions, allTags, onStart }: Props = $props();

	let selectedTags = $state<string[]>([]);
	let answerCount = $state<3 | 4 | 5>(4);

	let filteredCount = $derived(
		selectedTags.length === 0
			? questions.length
			: questions.filter((q) => q.tags.some((t) => selectedTags.includes(t))).length
	);

	let questionCount = $state(Math.min(10, questions.length));
	$effect(() => {
		if (filteredCount === 0) {
			questionCount = 0;
		} else {
			questionCount = Math.min(questionCount, filteredCount) || 1;
		}
	});

	function toggleTag(tag: string) {
		if (selectedTags.includes(tag)) {
			selectedTags = selectedTags.filter((t) => t !== tag);
		} else {
			selectedTags = [...selectedTags, tag];
		}
	}

	function clearTags() {
		selectedTags = [];
	}

	function handleStart() {
		if (filteredCount > 0 && questionCount >= 1 && questionCount <= filteredCount) {
			onStart(questionCount, answerCount, selectedTags);
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
				{filteredCount} of {questions.length} questions available
			</p>
		</div>

		<div class="space-y-6 rounded-2xl border border-gray-800 bg-gray-900 p-6">
			<!-- Tag filter -->
			{#if allTags.length > 0}
				<div>
					<div class="mb-3 flex items-center justify-between">
						<span class="text-sm font-medium text-gray-300">Filter by tag</span>
						{#if selectedTags.length > 0}
							<button
								type="button"
								class="text-xs text-gray-500 hover:text-gray-300 transition-colors"
								onclick={clearTags}
							>
								Clear all
							</button>
						{/if}
					</div>
					<div class="flex flex-wrap gap-2">
						{#each allTags as tag}
							<button
								type="button"
								class="rounded-full border px-3 py-1 text-xs font-medium transition-colors {selectedTags.includes(tag)
									? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
									: 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-300'}"
								onclick={() => toggleTag(tag)}
							>
								{tag}
							</button>
						{/each}
					</div>
				</div>
			{/if}

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
						max={filteredCount}
						bind:value={questionCount}
						disabled={filteredCount === 0}
						class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-indigo-500 disabled:opacity-50"
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
				disabled={filteredCount === 0 || questionCount < 1 || questionCount > filteredCount}
				onclick={handleStart}
			>
				{filteredCount === 0 ? 'No questions match selected tags' : 'Start Quiz'}
			</button>
		</div>
	</div>
</div>
