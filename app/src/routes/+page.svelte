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
	import type { Database } from 'sql.js';
	import { questions, allTags } from '$lib/data';
	import { initDatabase, getScores, seedScores } from '$lib/db';
	import { quizSession, viewMode, reviewIndex } from '$lib/stores/quiz';
	import { startQuiz, submitAnswer, retakeQuiz, newQuiz, quitQuiz, reviewQuestion, backToSummary, reviewPrev, reviewNext, showAnsweredQuestions, reviewAnsweredQuestion, backToQuiz } from '$lib/engine/lifecycle';
	import type { QuestionScore } from '$lib/types';
	import ConfigView from '$lib/components/ConfigView.svelte';
	import QuizView from '$lib/components/QuizView.svelte';
	import SummaryView from '$lib/components/SummaryView.svelte';
	import ReviewView from '$lib/components/ReviewView.svelte';
	import AnsweredQuestionsView from '$lib/components/AnsweredQuestionsView.svelte';

	let db: Database | null = $state(null);
	let scores: QuestionScore[] = $state([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			db = await initDatabase();
			seedScores(db, questions.map((q) => q.id));
			scores = getScores(db);
			loading = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to initialize database';
			loading = false;
		}
	});

	function handleStart(questionCount: number, answerCount: 3 | 4 | 5, selectedTags: string[] = []) {
		if (!db) return;
		scores = getScores(db);
		startQuiz({ questionCount, answerCount, selectedTags, selectedNodeIds: [] }, questions, scores, db);
	}

	async function handleSubmit(label: string) {
		if (!db) return;
		await submitAnswer(label, db);
		scores = getScores(db);
	}

	function handleRetake() {
		if (!db) return;
		scores = getScores(db);
		retakeQuiz(db, questions, scores);
	}

	function handleNewQuiz() {
		newQuiz();
	}

	function handleQuit() {
		quitQuiz();
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
{:else if $viewMode === 'config'}
	<ConfigView {questions} {allTags} onStart={handleStart} />
{:else if $viewMode === 'quiz' && $quizSession}
	{@const current = $quizSession.questions[$quizSession.currentIndex]}
	{@const answered = $quizSession.questions.filter((q) => q.submittedLabel !== null).length}
	{#if current}
		<QuizView
			question={current}
			progressCurrent={answered}
			progressTotal={$quizSession.questions.length}
			progressPercent={Math.round((answered / $quizSession.questions.length) * 100)}
			hasAnswered={$quizSession.currentIndex > 0}
			onSubmit={handleSubmit}
			onShowAnswered={showAnsweredQuestions}
		/>
	{/if}
{:else if $viewMode === 'quiz-answered' && $quizSession}
	<AnsweredQuestionsView
		answeredQuestions={$quizSession.questions.slice(0, $quizSession.currentIndex)}
		currentQuestionNumber={$quizSession.currentIndex + 1}
		totalQuestions={$quizSession.questions.length}
		onReview={reviewAnsweredQuestion}
		onBack={backToQuiz}
	/>
{:else if $viewMode === 'quiz-review' && $quizSession && $reviewIndex !== null}
	{@const q = $quizSession.questions[$reviewIndex]}
	{@const answeredCount = $quizSession.currentIndex}
	{#if q}
		<ReviewView
			question={q}
			currentIndex={$reviewIndex}
			totalQuestions={answeredCount}
			onBack={showAnsweredQuestions}
			onPrev={reviewPrev}
			onNext={reviewNext}
		/>
	{/if}
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
