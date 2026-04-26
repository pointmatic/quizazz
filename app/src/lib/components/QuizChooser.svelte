<!-- Copyright (c) 2026 Pointmatic -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import { BookOpen, X } from 'lucide-svelte';
	import type { QuizManifest } from '$lib/types';
	import ManifestUpload from './ManifestUpload.svelte';

	interface Props {
		manifests: QuizManifest[];
		uploadedManifests: QuizManifest[];
		onSelect: (manifest: QuizManifest) => void;
		onUpload: (manifest: QuizManifest) => void;
		onRemove: (quizName: string) => void;
	}

	let { manifests, uploadedManifests, onSelect, onUpload, onRemove }: Props = $props();
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

			{#each uploadedManifests as m}
				<div class="flex w-full items-center gap-4 rounded-2xl border border-gray-800 bg-gray-900 px-6 py-5">
					<button
						type="button"
						class="flex flex-1 items-center gap-4 text-left transition-colors hover:opacity-80"
						onclick={() => onSelect(m)}
					>
						<div class="rounded-xl bg-emerald-500/10 p-3">
							<BookOpen class="h-6 w-6 text-emerald-400" />
						</div>
						<div class="flex-1">
							<h2 class="text-lg font-semibold text-white">{m.quizName}</h2>
							<p class="mt-0.5 text-sm text-gray-400">
								{m.questions.length} questions <span class="text-emerald-500">· uploaded</span>
							</p>
						</div>
					</button>
					<button
						type="button"
						class="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-800 hover:text-red-400"
						onclick={() => onRemove(m.quizName)}
						title="Remove uploaded quiz"
					>
						<X class="h-4 w-4" />
					</button>
				</div>
			{/each}
		</div>

		<div class="mt-6">
			<ManifestUpload onLoad={onUpload} />
		</div>
	</div>
</div>
