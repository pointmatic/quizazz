<!-- Copyright (c) 2026 Pointmatic -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	interface Props {
		current: number;
		total: number;
		percent: number;
	}

	let { current, total, percent }: Props = $props();
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between text-sm">
		<span class="font-medium text-gray-300">Question {Math.min(current + 1, total)} of {total}</span>
		<span class="text-gray-500">{percent}%</span>
	</div>
	<div class="h-2 overflow-hidden rounded-full bg-gray-800">
		<div
			class="h-full rounded-full bg-indigo-500 transition-all duration-300 ease-out"
			style="width: {percent}%"
		></div>
	</div>
</div>
