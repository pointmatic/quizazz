<!-- Copyright (c) 2026 Pointmatic -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import { dbInit } from '$lib/stores/db-init';
	import { activeManifest } from '$lib/stores/manifest';
	import { getDbName } from '$lib/db';

	function handleReload() {
		window.location.reload();
	}

	async function handleResetDatabase() {
		const m = $activeManifest;
		if (m) {
			await new Promise<void>((resolve) => {
				const req = indexedDB.deleteDatabase(getDbName(m.quizName));
				req.onsuccess = () => resolve();
				req.onerror = () => resolve();
				req.onblocked = () => resolve();
			});
		}
		window.location.reload();
	}
</script>

{#if $dbInit === 'wasm-missing'}
	<aside
		role="alert"
		class="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
	>
		<div class="mx-auto flex max-w-3xl items-center justify-between gap-4">
			<p>
				<strong>Score recording paused.</strong> The quiz database engine could not load
				(<code>sql-wasm.wasm</code> is unreachable). Your answers will not be saved until this
				is resolved.
			</p>
			<button
				type="button"
				class="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-400"
				onclick={handleReload}
			>
				Reload
			</button>
		</div>
	</aside>
{:else if $dbInit === 'failed'}
	<aside
		role="alert"
		class="border-b border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
	>
		<div class="mx-auto flex max-w-3xl items-center justify-between gap-4">
			<p>
				<strong>Score recording paused.</strong> The quiz database failed to initialize. You can
				reset the local database for this quiz to recover; this will clear saved scores for the
				active quiz only.
			</p>
			<button
				type="button"
				class="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
				onclick={handleResetDatabase}
			>
				Reset Database
			</button>
		</div>
	</aside>
{/if}
