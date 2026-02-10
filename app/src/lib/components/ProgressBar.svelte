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
