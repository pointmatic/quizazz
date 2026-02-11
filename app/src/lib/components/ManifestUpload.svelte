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
	import { Upload } from 'lucide-svelte';
	import { parseAndValidate } from '$lib/utils/validate-manifest';
	import type { QuizManifest } from '$lib/types';

	interface Props {
		onLoad: (manifest: QuizManifest) => void;
	}

	let { onLoad }: Props = $props();
	let errorMessage = $state<string | null>(null);
	let dragging = $state(false);

	function handleFile(file: File) {
		errorMessage = null;
		if (!file.name.endsWith('.json')) {
			errorMessage = 'Please select a .json file.';
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			const result = parseAndValidate(reader.result as string);
			if (result.ok) {
				onLoad(result.manifest);
			} else {
				errorMessage = result.error;
			}
		};
		reader.onerror = () => {
			errorMessage = 'Failed to read file.';
		};
		reader.readAsText(file);
	}

	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handleFile(file);
		input.value = '';
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const file = e.dataTransfer?.files[0];
		if (file) handleFile(file);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragging = true;
	}

	function handleDragLeave() {
		dragging = false;
	}
</script>

<div
	class="rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors {dragging
		? 'border-indigo-500 bg-indigo-500/5'
		: 'border-gray-700 hover:border-gray-600'}"
	role="button"
	tabindex="0"
	ondrop={handleDrop}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
>
	<Upload class="mx-auto mb-3 h-8 w-8 text-gray-500" />
	<p class="text-sm text-gray-400">
		Drag & drop a quiz package, or
		<label class="cursor-pointer text-indigo-400 hover:text-indigo-300">
			browse
			<input type="file" accept=".json" class="hidden" onchange={handleInput} />
		</label>
	</p>
	<p class="mt-1 text-xs text-gray-600">Compiled .json from quizazz generate</p>

	{#if errorMessage}
		<p class="mt-3 text-sm text-red-400">{errorMessage}</p>
	{/if}
</div>
