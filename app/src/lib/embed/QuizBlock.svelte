<!-- Copyright (c) 2026 Pointmatic -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script module lang="ts">
	let mountCount = 0;
	let activeQuizRef = '';
</script>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Database } from 'sql.js';
	import type { QuizManifest } from '$lib/types';
	import { initDatabase, seedScores, getScores } from '$lib/db';
	import { activeManifest } from '$lib/stores/manifest';
	import { quizSession, viewMode, reviewIndex } from '$lib/stores/quiz';
	import {
		setNavNodes,
		startQuiz,
		submitAnswer,
		retakeQuiz,
		showAnsweredQuestions,
		backToQuiz,
		backToSummary,
		reviewPrev,
		reviewNext,
		reviewQuestion,
		reviewAnsweredMidQuiz,
		exitMidQuizReview,
		getFrontierIndex,
		getQuestionStartTime
	} from '$lib/engine/lifecycle';
	import { isCompatible } from './schema-version';
	import QuizView from '$lib/components/QuizView.svelte';
	import AnsweredQuestionsView from '$lib/components/AnsweredQuestionsView.svelte';
	import ReviewView from '$lib/components/ReviewView.svelte';
	import SummaryView from '$lib/components/SummaryView.svelte';

	export interface QuizCompleteEvent {
		quizRef: string;
		score: number;
		maxScore: number;
		questionCount: number;
	}

	interface Props {
		manifest: QuizManifest;
		quizRef: string;
		class?: string;
		oncomplete?: (event: QuizCompleteEvent) => void;
	}

	const { manifest, quizRef, class: className = '', oncomplete }: Props = $props();

	let blocked = $state(false);
	let blockedBy = $state('');
	let schemaStatus = $state<'ok' | 'mismatch'>('ok');
	let db = $state<Database | null>(null);
	let rootEl = $state<HTMLElement | undefined>();
	let hasFiredComplete = $state(false);

	$effect(() => {
		const mode = $viewMode;
		const session = $quizSession;
		if (blocked) return;
		if (mode === 'summary' && session && !hasFiredComplete) {
			const correct = session.questions.filter((q) => {
				const submitted = q.presentedAnswers.find((a) => a.label === q.submittedLabel);
				return submitted?.category === 'correct';
			}).length;
			const total = manifest.questions.length;
			const payload: QuizCompleteEvent = {
				quizRef,
				score: correct,
				maxScore: total,
				questionCount: total
			};
			oncomplete?.(payload);
			rootEl?.dispatchEvent(new CustomEvent('complete', { detail: payload, bubbles: true }));
			hasFiredComplete = true;
		} else if (mode === 'quiz' && hasFiredComplete) {
			hasFiredComplete = false;
		}
	});

	onMount(async () => {
		if (mountCount >= 1) {
			blocked = true;
			blockedBy = activeQuizRef;
			console.error(
				`[quizazz] <QuizBlock> single-instance-per-page violation: ` +
					`quizRef="${activeQuizRef}" is already mounted; refusing to mount quizRef="${quizRef}". ` +
					`See the @pointmatic/quizazz README for the rationale and roadmap.`
			);
			return;
		}
		mountCount = 1;
		activeQuizRef = quizRef;

		schemaStatus = isCompatible(manifest.schemaVersion);

		db = await initDatabase(manifest.quizName);
		seedScores(db, manifest.questions.map((q) => q.id));
		activeManifest.set(manifest);
		setNavNodes(manifest.tree);

		startQuiz(
			{
				questionCount: manifest.questions.length,
				answerCount: 4,
				selectedTags: [],
				selectedNodeIds: []
			},
			manifest.questions,
			getScores(db),
			db,
			manifest.quizName
		);
	});

	onDestroy(() => {
		if (!blocked) {
			mountCount = 0;
			activeQuizRef = '';
		}
	});

	async function handleSubmit(label: string) {
		if (!db) return;
		await submitAnswer(label, db);
	}

	function handleRetake() {
		if (!db) return;
		retakeQuiz(db, manifest.questions, []);
	}

	function noop() {}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<section tabindex="0" class={className} bind:this={rootEl}>
	{#if blocked}
		<aside data-quizazz-error>
			<p>
				Only one &lt;QuizBlock&gt; can be mounted per page in this release. The page already has
				<code>{blockedBy}</code> mounted; <code>{quizRef}</code> was not started.
			</p>
		</aside>
	{:else}
		{#if schemaStatus === 'mismatch'}
			<aside data-quizazz-warning>
				<p>
					This manifest declares <code>schemaVersion={manifest.schemaVersion ?? 'unknown'}</code>,
					which is a different major version than this component supports. The quiz will still
					render, but some fields may not be interpreted correctly.
				</p>
			</aside>
		{/if}

		{#if $viewMode === 'quiz' && $quizSession}
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
				onSelect={reviewAnsweredMidQuiz}
				onBack={backToQuiz}
			/>
		{:else if $viewMode === 'quiz-review' && $quizSession && $reviewIndex !== null}
			{@const q = $quizSession.questions[$reviewIndex]}
			{#if q}
				<ReviewView
					question={q}
					currentIndex={$reviewIndex}
					totalQuestions={$quizSession.questions.length}
					onBack={exitMidQuizReview}
					onPrev={reviewPrev}
					onNext={reviewNext}
				/>
			{/if}
		{:else if $viewMode === 'summary' && $quizSession}
			<SummaryView
				questions={$quizSession.questions}
				onRetake={handleRetake}
				onNewQuiz={noop}
				onQuit={noop}
				onReview={reviewQuestion}
				showStartQuit={false}
			/>
		{:else if $viewMode === 'review' && $quizSession && $reviewIndex !== null}
			{@const q = $quizSession.questions[$reviewIndex]}
			{#if q}
				<ReviewView
					question={q}
					currentIndex={$reviewIndex}
					totalQuestions={$quizSession.questions.length}
					onBack={backToSummary}
					onPrev={reviewPrev}
					onNext={reviewNext}
				/>
			{/if}
		{/if}
	{/if}
</section>
