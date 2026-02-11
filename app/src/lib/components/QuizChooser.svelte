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
	import type { QuizManifest } from '$lib/types';

	interface Props {
		manifests: QuizManifest[];
		onSelect: (manifest: QuizManifest) => void;
	}

	let { manifests, onSelect }: Props = $props();
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-950 px-4">
	<div class="w-full max-w-2xl">
		<div class="mb-8 text-center">
			<h1 class="text-3xl font-bold text-white">Quizazz</h1>
			<p class="mt-2 text-sm text-gray-400">Choose a quiz to get started</p>
		</div>

		<div class="space-y-3">
			{#each manifests as m}
				<button
					type="button"
					class="flex w-full items-center gap-4 rounded-2xl border border-gray-800 bg-gray-900 px-6 py-5 text-left transition-colors hover:border-gray-700 hover:bg-gray-800/80"
					onclick={() => onSelect(m)}
				>
					<div class="rounded-xl bg-indigo-500/10 p-3">
						<BookOpen class="h-6 w-6 text-indigo-400" />
					</div>
					<div class="flex-1">
						<h2 class="text-lg font-semibold text-white">{m.quizName}</h2>
						<p class="mt-0.5 text-sm text-gray-400">
							{m.questions.length} questions
						</p>
					</div>
				</button>
			{/each}
		</div>
	</div>
</div>
