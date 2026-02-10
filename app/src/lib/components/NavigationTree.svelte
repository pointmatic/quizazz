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
	import { BookOpen, ChevronRight, ChevronDown, FolderOpen, FileText, List } from 'lucide-svelte';
	import type { NavNode, QuestionScore } from '$lib/types';
	import { computeMastery } from '$lib/engine/mastery';

	interface Props {
		tree: NavNode[];
		scores: QuestionScore[];
		onContinue: (selectedNodeIds: string[]) => void;
	}

	let { tree, scores, onContinue }: Props = $props();

	let selectedIds = $state<Set<string>>(new Set());
	let expandedIds = $state<Set<string>>(new Set());

	function getAllNodeIds(nodes: NavNode[]): string[] {
		const ids: string[] = [];
		for (const node of nodes) {
			ids.push(node.id);
			if (node.children.length > 0) {
				ids.push(...getAllNodeIds(node.children));
			}
		}
		return ids;
	}

	function getDescendantIds(node: NavNode): string[] {
		const ids: string[] = [];
		for (const child of node.children) {
			ids.push(child.id);
			ids.push(...getDescendantIds(child));
		}
		return ids;
	}

	function getAncestorIds(targetId: string, nodes: NavNode[], path: string[] = []): string[] | null {
		for (const node of nodes) {
			if (node.id === targetId) return path;
			if (node.children.length > 0) {
				const result = getAncestorIds(targetId, node.children, [...path, node.id]);
				if (result) return result;
			}
		}
		return null;
	}

	function areAllChildrenSelected(node: NavNode): boolean {
		if (node.children.length === 0) return selectedIds.has(node.id);
		return node.children.every((c) => areAllChildrenSelected(c));
	}

	function toggleNode(node: NavNode) {
		const next = new Set(selectedIds);
		const descendants = getDescendantIds(node);

		if (next.has(node.id)) {
			next.delete(node.id);
			for (const id of descendants) next.delete(id);
			// Uncheck ancestors if they were fully selected
			const ancestors = getAncestorIds(node.id, tree) ?? [];
			for (const id of ancestors) next.delete(id);
		} else {
			next.add(node.id);
			for (const id of descendants) next.add(id);
			// Check ancestors if all their children are now selected
			const ancestors = getAncestorIds(node.id, tree) ?? [];
			// Re-derive: temporarily apply next, then check ancestors bottom-up
			selectedIds = next;
			for (const ancestorId of [...ancestors].reverse()) {
				const ancestorNode = findNode(ancestorId, tree);
				if (ancestorNode && ancestorNode.children.every((c) => next.has(c.id))) {
					next.add(ancestorId);
				}
			}
		}
		selectedIds = next;
	}

	function findNode(id: string, nodes: NavNode[]): NavNode | null {
		for (const node of nodes) {
			if (node.id === id) return node;
			if (node.children.length > 0) {
				const found = findNode(id, node.children);
				if (found) return found;
			}
		}
		return null;
	}

	function selectAll() {
		selectedIds = new Set(getAllNodeIds(tree));
	}

	function clearAll() {
		selectedIds = new Set();
	}

	function toggleExpand(nodeId: string) {
		const next = new Set(expandedIds);
		if (next.has(nodeId)) {
			next.delete(nodeId);
		} else {
			next.add(nodeId);
		}
		expandedIds = next;
	}

	let allIds = $derived(getAllNodeIds(tree));
	let allSelected = $derived(allIds.length > 0 && allIds.every((id) => selectedIds.has(id)));
	let selectedCount = $derived(
		tree.reduce((acc, node) => {
			if (selectedIds.has(node.id)) return acc + node.questionIds.length;
			// Count from selected children if parent not selected
			let count = 0;
			function countSelected(n: NavNode) {
				if (selectedIds.has(n.id)) {
					count += n.questionIds.length;
					return;
				}
				for (const child of n.children) countSelected(child);
			}
			countSelected(node);
			return acc + count;
		}, 0)
	);

	// Count unique selected question IDs
	let selectedQuestionCount = $derived(() => {
		const questionIds = new Set<string>();
		function collect(nodes: NavNode[]) {
			for (const node of nodes) {
				if (selectedIds.has(node.id)) {
					for (const qid of node.questionIds) questionIds.add(qid);
				} else if (node.children.length > 0) {
					collect(node.children);
				}
			}
		}
		collect(tree);
		return questionIds.size;
	});

	function handleContinue() {
		onContinue([...selectedIds]);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && selectedIds.size > 0) {
			handleContinue();
		}
	}

	// Expand all directory nodes by default on mount
	$effect(() => {
		const dirs = new Set<string>();
		function findDirs(nodes: NavNode[]) {
			for (const node of nodes) {
				if (node.type === 'directory') dirs.add(node.id);
				if (node.children.length > 0) findDirs(node.children);
			}
		}
		findDirs(tree);
		expandedIds = dirs;
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="flex min-h-screen items-center justify-center bg-gray-950 px-4">
	<div class="w-full max-w-lg">
		<div class="mb-10 text-center">
			<div class="mb-4 flex justify-center">
				<div class="rounded-2xl bg-indigo-500/10 p-4">
					<BookOpen class="h-10 w-10 text-indigo-400" />
				</div>
			</div>
			<h1 class="text-3xl font-bold tracking-tight text-white">Quizazz</h1>
			<p class="mt-2 text-sm text-gray-400">Select topics to study</p>
		</div>

		<div class="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-6">
			<!-- Select All / Clear controls -->
			<div class="flex items-center justify-between">
				<span class="text-sm font-medium text-gray-300">Topics</span>
				<div class="flex gap-3">
					{#if !allSelected}
						<button
							type="button"
							class="text-xs text-gray-500 hover:text-gray-300 transition-colors"
							onclick={selectAll}
						>
							Select all
						</button>
					{/if}
					{#if selectedIds.size > 0}
						<button
							type="button"
							class="text-xs text-gray-500 hover:text-gray-300 transition-colors"
							onclick={clearAll}
						>
							Clear
						</button>
					{/if}
				</div>
			</div>

			<!-- Tree -->
			<div class="space-y-1">
				{#each tree as node}
					{@render treeNode(node, 0)}
				{/each}
			</div>

			<!-- Continue button -->
			<button
				type="button"
				class="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={selectedIds.size === 0}
				onclick={handleContinue}
			>
				{selectedIds.size === 0 ? 'Select topics to continue' : `Continue with ${selectedQuestionCount()} questions`}
			</button>
		</div>
	</div>
</div>

{#snippet treeNode(node: NavNode, depth: number)}
	{@const mastery = computeMastery(node.questionIds, scores)}
	{@const isSelected = selectedIds.has(node.id)}
	{@const hasChildren = node.children.length > 0}
	{@const isExpanded = expandedIds.has(node.id)}

	<div>
		<button
			type="button"
			class="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-800/50"
			style="padding-left: {depth * 1.25 + 0.75}rem"
			onclick={() => toggleNode(node)}
		>
			<!-- Checkbox -->
			<span
				class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors {isSelected
					? 'border-indigo-500 bg-indigo-500'
					: 'border-gray-600 bg-gray-800 group-hover:border-gray-500'}"
			>
				{#if isSelected}
					<svg class="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M2 6l3 3 5-5" />
					</svg>
				{/if}
			</span>

			<!-- Expand/collapse for nodes with children -->
			{#if hasChildren}
				<span
					role="button"
					tabindex="-1"
					class="shrink-0 cursor-pointer text-gray-500 hover:text-gray-300 transition-colors"
					onclick={(e: MouseEvent) => { e.stopPropagation(); toggleExpand(node.id); }}
					onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleExpand(node.id); } }}
				>
					{#if isExpanded}
						<ChevronDown class="h-4 w-4" />
					{:else}
						<ChevronRight class="h-4 w-4" />
					{/if}
				</span>
			{:else}
				<span class="w-4 shrink-0"></span>
			{/if}

			<!-- Icon -->
			{#if node.type === 'directory'}
				<FolderOpen class="h-4 w-4 shrink-0 text-gray-500" />
			{:else if node.type === 'topic'}
				<FileText class="h-4 w-4 shrink-0 text-gray-500" />
			{:else}
				<List class="h-4 w-4 shrink-0 text-gray-500" />
			{/if}

			<!-- Label and info -->
			<div class="min-w-0 flex-1">
				<div class="flex items-center justify-between gap-2">
					<span class="truncate text-sm font-medium {isSelected ? 'text-white' : 'text-gray-300'}">
						{node.label}
					</span>
					<div class="flex shrink-0 items-center gap-2">
						<span class="text-xs tabular-nums text-gray-500">
							{node.questionIds.length}q
						</span>
						{#if mastery.total > 0}
							<span
								class="min-w-[2.5rem] rounded-full px-1.5 py-0.5 text-center text-xs font-medium tabular-nums {mastery.percent >= 80
									? 'bg-emerald-500/20 text-emerald-400'
									: mastery.percent >= 40
										? 'bg-amber-500/20 text-amber-400'
										: 'bg-gray-700 text-gray-400'}"
							>
								{mastery.percent}%
							</span>
						{/if}
					</div>
				</div>
				{#if node.description && node.type === 'topic'}
					<p class="mt-0.5 truncate text-xs text-gray-500">{node.description}</p>
				{/if}
			</div>
		</button>

		<!-- Children -->
		{#if hasChildren && isExpanded}
			{#each node.children as child}
				{@render treeNode(child, depth + 1)}
			{/each}
		{/if}
	</div>
{/snippet}
