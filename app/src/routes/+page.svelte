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
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import type { Database } from 'sql.js';
	import { manifests } from '$lib/data';
	import { initDatabase, getScores, seedScores } from '$lib/db';
	import { quizSession, viewMode, reviewIndex } from '$lib/stores/quiz';
	import { activeManifest, questions as questionsStore, navTree as navTreeStore, allTags as allTagsStore } from '$lib/stores/manifest';
	import { startQuiz, submitAnswer, retakeQuiz, newQuiz, quitQuiz, reviewQuestion, backToSummary, reviewPrev, reviewNext, showAnsweredQuestions, editAnsweredQuestion, backToQuiz, setNavNodes, getFrontierIndex, getQuestionStartTime } from '$lib/engine/lifecycle';
	import type { Question, QuestionScore, QuizManifest, NavNode } from '$lib/types';
	import QuizChooser from '$lib/components/QuizChooser.svelte';
	import NavigationTree from '$lib/components/NavigationTree.svelte';
	import ConfigView from '$lib/components/ConfigView.svelte';
	import QuizView from '$lib/components/QuizView.svelte';
	import SummaryView from '$lib/components/SummaryView.svelte';
	import ReviewView from '$lib/components/ReviewView.svelte';
	import AnsweredQuestionsView from '$lib/components/AnsweredQuestionsView.svelte';

	let db: Database | null = $state(null);
	let scores: QuestionScore[] = $state([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedNodeIds = $state<string[]>([]);
	let filteredQuestions = $state<Question[]>([]);
	let uploadedManifests = $state<QuizManifest[]>([]);

	let hasMultipleQuizzes = $derived(manifests.length + uploadedManifests.length > 1);

	let filteredTags = $derived(
		[...new Set(filteredQuestions.flatMap((q) => q.tags))].sort()
	);

	onMount(async () => {
		try {
			if (manifests.length === 1) {
				await selectManifest(manifests[0]);
			} else {
				viewMode.set('chooser');
				loading = false;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to initialize';
			loading = false;
		}
	});

	async function selectManifest(m: QuizManifest) {
		loading = true;
		error = null;
		try {
			activeManifest.set(m);
			setNavNodes(m.tree);
			db = await initDatabase(m.quizName);
			seedScores(db, m.questions.map((q) => q.id));
			scores = getScores(db);
			filteredQuestions = m.questions;
			quizSession.set(null);
			reviewIndex.set(null);
			viewMode.set('nav');
			loading = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to initialize database';
			loading = false;
		}
	}

	function handleContinue(nodeIds: string[]) {
		const currentTree = get(navTreeStore);
		const currentQuestions = get(questionsStore);
		selectedNodeIds = nodeIds;
		const selectedQids = new Set<string>();
		function collect(nodes: NavNode[]) {
			for (const node of nodes) {
				if (nodeIds.includes(node.id)) {
					for (const qid of node.questionIds) selectedQids.add(qid);
				} else if (node.children.length > 0) {
					collect(node.children);
				}
			}
		}
		collect(currentTree);
		filteredQuestions = currentQuestions.filter((q) => selectedQids.has(q.id));
		viewMode.set('config');
	}

	function handleBack() {
		viewMode.set('nav');
	}

	function handleStart(questionCount: number, answerCount: 3 | 4 | 5, selectedTags: string[] = []) {
		if (!db) return;
		const m = get(activeManifest);
		if (!m) return;
		scores = getScores(db);
		startQuiz({ questionCount, answerCount, selectedTags, selectedNodeIds }, filteredQuestions, scores, db, m.quizName);
	}

	async function handleSubmit(label: string) {
		if (!db) return;
		await submitAnswer(label, db);
		scores = getScores(db);
	}

	function handleRetake() {
		if (!db) return;
		scores = getScores(db);
		retakeQuiz(db, filteredQuestions, scores);
	}

	function handleNewQuiz() {
		newQuiz();
	}

	function handleQuit() {
		quitQuiz();
		if (hasMultipleQuizzes) {
			activeManifest.set(null);
			viewMode.set('chooser');
		}
	}

	function handleUpload(m: QuizManifest) {
		const exists = uploadedManifests.some((u) => u.quizName === m.quizName);
		if (exists) {
			uploadedManifests = uploadedManifests.map((u) => u.quizName === m.quizName ? m : u);
		} else {
			uploadedManifests = [...uploadedManifests, m];
		}
	}

	function handleRemove(quizName: string) {
		uploadedManifests = uploadedManifests.filter((u) => u.quizName !== quizName);
	}

	function handleReview(index: number) {
		reviewQuestion(index);
	}

	function handleBackToSummary() {
		backToSummary();
	}
</script>

{#if loading}
	<div class="flex min-h-screen items-center justify-center bg-gray-950">
		<div class="text-center">
			<div class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-500"></div>
			<p class="text-sm text-gray-400">Loading...</p>
		</div>
	</div>
{:else if error}
	<div class="flex min-h-screen items-center justify-center bg-gray-950 px-4">
		<div class="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
			<p class="text-sm text-red-400">{error}</p>
			<button
				type="button"
				class="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
				onclick={() => location.reload()}
			>
				Reload
			</button>
		</div>
	</div>
{:else if $viewMode === 'chooser'}
	<QuizChooser {manifests} {uploadedManifests} onSelect={selectManifest} onUpload={handleUpload} onRemove={handleRemove} />
{:else if $viewMode === 'nav'}
	<NavigationTree tree={$navTreeStore} {scores} onContinue={handleContinue} />
{:else if $viewMode === 'config'}
	<ConfigView questions={filteredQuestions} allTags={filteredTags} onStart={handleStart} onBack={handleBack} />
{:else if $viewMode === 'quiz' && $quizSession}
	{@const current = $quizSession.questions[$quizSession.currentIndex]}
	{@const frontier = getFrontierIndex()}
	{@const answered = $quizSession.questions.filter((q) => q.submittedLabel !== null).length}
	{#if current}
		<QuizView
			question={current}
			progressCurrent={answered}
			progressTotal={$quizSession.questions.length}
			progressPercent={Math.round((answered / $quizSession.questions.length) * 100)}
			hasAnswered={frontier > 0}
			startedAt={getQuestionStartTime()}
			onSubmit={handleSubmit}
			onShowAnswered={showAnsweredQuestions}
		/>
	{/if}
{:else if $viewMode === 'quiz-answered' && $quizSession}
	{@const frontier = getFrontierIndex()}
	<AnsweredQuestionsView
		answeredQuestions={$quizSession.questions.slice(0, frontier)}
		currentQuestionNumber={frontier + 1}
		totalQuestions={$quizSession.questions.length}
		onSelect={editAnsweredQuestion}
		onBack={backToQuiz}
	/>
{:else if $viewMode === 'summary' && $quizSession}
	<SummaryView
		questions={$quizSession.questions}
		onRetake={handleRetake}
		onNewQuiz={handleNewQuiz}
		onQuit={handleQuit}
		onReview={handleReview}
	/>
{:else if $viewMode === 'review' && $quizSession && $reviewIndex !== null}
	{@const q = $quizSession.questions[$reviewIndex]}
	{#if q}
		<ReviewView
			question={q}
			currentIndex={$reviewIndex}
			totalQuestions={$quizSession.questions.length}
			onBack={handleBackToSummary}
			onPrev={reviewPrev}
			onNext={reviewNext}
		/>
	{/if}
{/if}
