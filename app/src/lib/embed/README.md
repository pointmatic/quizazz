# `<QuizBlock>` — embedding reference

Host-facing documentation for `@pointmatic/quizazz`. This README lives next to
the component source so it evolves in lockstep with the public API; the npm
package README is derived from this file in Story L.d.

## Keyboard scoping

`<QuizBlock>` confines all keyboard handling to elements inside the component
root — there are **no** `window`-level listeners anywhere in the reachable
component graph. Host pages keep their global shortcuts (`a`–`e`, `Enter`,
`Escape`, `←` / `→`) when focus is outside the embedded quiz.

- The component root `<section>` is tab-focusable (`tabindex="0"`).
- The active view (`QuizView`, `ReviewView`, `AnsweredQuestionsView`, etc.)
  auto-focuses its own root on mount, so users can start typing immediately
  after the quiz loads.
- If the user tabs away, keyboard shortcuts inside the quiz stop firing.
  Clicking anywhere inside the quiz restores focus.

## CSS custom properties (theming)

All theming is opt-in and cascades through the DOM — set any of the following
custom properties on `<QuizBlock>`'s root, any ancestor, or `:root` to override
the default.

| Variable                              | Default      | Where it's used                     |
| ------------------------------------- | ------------ | ----------------------------------- |
| `--quizazz-color-correct`             | `#34d399`    | Correct-answer indicator color      |
| `--quizazz-color-incorrect`           | `#f87171`    | Incorrect-answer indicator color    |
| `--quizazz-color-partially-correct`   | `#fbbf24`    | Partially-correct category accent   |
| `--quizazz-color-ridiculous`          | `#c084fc`    | Ridiculous category accent          |
| `--quizazz-radius`                    | `1rem`       | Card / button corner radius         |
| `--quizazz-font-family`               | `inherit`    | Root font family                    |

Example — theme via a wrapping class:

```html
<style>
  .my-theme {
    --quizazz-color-correct: oklch(0.72 0.17 145);
    --quizazz-color-incorrect: oklch(0.62 0.24 25);
    --quizazz-radius: 0.5rem;
  }
</style>

<QuizBlock class="my-theme" manifest={...} quizRef="module-3" />
```

### Coverage caveat

The initial pass applies these variables to the most visible
category-sensitive elements (the summary-list correct / incorrect indicators
among them). Many internal elements still use Tailwind color utilities
directly; replacing the full palette with custom-property-driven styles is
tracked as follow-on work. The behavior is intentional — host overrides reach
the primary signal-carrying elements today, and the remaining Tailwind colors
stay visually consistent with the defaults.

## `complete` event

When the final question is submitted, `<QuizBlock>` emits a completion event
in two forms so hosts can pick whichever fits their idioms:

- **Callback prop** — `oncomplete={(e) => ...}` receives a plain object:
  `{ quizRef, score, maxScore, questionCount }`.
- **DOM event** — the root section dispatches a bubbling `CustomEvent('complete')`
  with the same payload in `event.detail`. Hosts can listen anywhere up the DOM
  tree.

Semantics:

- `score` is the number of correct answers in the just-completed session.
- `maxScore` equals `questionCount`, which equals `manifest.questions.length`.
- The event fires **exactly once** per completed session. On retake, it fires
  again only when the retake itself reaches the last question.

## Single-instance-per-page

Only one `<QuizBlock>` may be mounted at a time on the same page. A defensive
mount-counter guard in the component enforces this — a second concurrent
mount renders a visible error aside and logs to the console, naming both the
already-mounted `quizRef` and the blocked one.

The restriction exists because the quiz engine's Svelte stores
(`quizSession`, `viewMode`, `reviewIndex`, `activeManifest`) are module-level
singletons. Lifting the stores to per-instance context is deferred — when it
lands, the guard goes with it in the same change.

## Schema-version compatibility

`<QuizBlock>` soft-checks the manifest's `schemaVersion` field against the
major version it was built for (`MANIFEST_SCHEMA_VERSION_MAJOR`, currently
`1`). A mismatched major renders a warning aside inside the component root,
then proceeds to render the quiz normally — a manifest produced by a future
major version may work, partially work, or behave unexpectedly, and the
warning makes that visible to the user.

Manifests missing `schemaVersion` are treated as `"1.0"` (pre-Phase-K
manifests predate the field).
