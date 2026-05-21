# stories.md -- quizazz (python)

This document breaks the `quizazz` project into an ordered sequence of small, independently completable stories grouped into phases. Each story has a checklist of concrete tasks. Stories are organized by phase and reference modules defined in `tech-spec.md`.

Put **`vX.Y.Z` in the story title only when that story ships the package version bump** for that release. Doc-only or polish stories **omit the version from the title** (they share the release with the preceding code story, or use your project’s doc-release policy). **One semver bump per owning story** — extra tasks on the *same* story share that bump; see `project-essentials.md`. Semantic versioning applies to the package. Stories are marked with `[Planned]` initially and changed to `[Done]` when completed.

For a high-level concept (why), see [`concept.md`](concept.md). For requirements and behavior (what), see [`features.md`](features.md). For implementation details (how), see [`tech-spec.md`](tech-spec.md). For project-specific must-know facts, see [`project-essentials.md`](project-essentials.md) (`plan_phase` appends new facts per phase). For the workflow steps tailored to the current mode (cycle steps, approval gates, conventions), see [`docs/project-guide/go.md`](../project-guide/go.md) — re-read it whenever the mode changes or after context compaction.

---

## Version Cadence

Standard semantic versioning, with these conventions:

- **Every story belongs to a phase.** Bugfix stories included. No orphan stories.
- **Per-story bumping** (when a story owns its own release):
  - Bugfix or trivial change → **patch** (`vX.Y.Z+1`)
  - Feature or improvement → **minor** (`vX.Y+1.0`)
  - Breaking change → **major** (`vX+1.0.0`). Post-1.0 only, and only via the `plan_production_phase` mode, which negotiates with the developer about whether the breakage is substantively user-facing or technically-but-trivially breaking (example: a log-format change is technically breaking, but if logs aren't a core consumer capability, the developer may judge it minor or even patch).
- **Phase-bundling option:** a phase can run unversioned during work and ship a single release/tag at end-of-phase. Stories within the phase carry no version in their title; the phase's last story owns the bump (magnitude determined by the highest-impact change in the bundle).
- **No out-of-order implementation.** Story order in this file is the order of execution. If work order needs to change, **reorganize/renumber here first** — don't skip ahead and create version-number gaps.
- **Pre-1.0:** standard semver applies; version starts at `v0.1.0` (Story A.a).
- **Post-1.0:** every phase must go through `plan_production_phase` (the lighter `plan_phase` is pre-1.0 only). Major bumps only happen through that mode's negotiation step.

This is the authoritative cadence rule. **Do not extrapolate the bump magnitude from `pyproject.toml`'s current version** — re-read this section whenever you're about to assign a version to a story.

---

## Phase N: LearningFoundry Integration Improvements

### Story N.a: v1.3.2 Assessment-vs-Quiz Naming Boundary [Done]

LearningFoundry is generalizing its embed surface to `<AssessmentBlock>` so it can host any assessment provider (Quizazz, LLM interview, interactive game, etc.). Audit the local mirror of [`learningfoundry-dependency-spec.md`](learningfoundry-dependency-spec.md) for places where LearningFoundry-domain artifacts still carry vendor (`quiz...`) terminology, and produce a recommendations document for LearningFoundry to apply on its side. No changes to Quizazz's vendor surface (`<QuizBlock>`, `quizRef` prop, `quizName` manifest key, `quizazz-{quizName}` IndexedDB names) — those are deliberately preserved per "vendor terminology stops at the vendor boundary."

This is a doc-only patch. Per the version cadence above, doc-only stories typically omit the version from the title; v1.3.2 is included here because the developer requested it. Lockstep bump applies (npm + Python).

- [x] Audit local mirror of [`learningfoundry-dependency-spec.md`](learningfoundry-dependency-spec.md) and confirm no Quizazz-owned surface needs renaming
  - [x] `<QuizBlock>` component name — vendor; stays
  - [x] `quizRef` prop on `<QuizBlock>` — vendor surface; stays (LF's `<AssessmentBlock>` relabels)
  - [x] `quizName` key in manifest emitted by quizazz — wire format; stays (RR-1a relabel by `QuizazzProvider`)
  - [x] IndexedDB naming `quizazz-{quizName}` — vendor-internal storage; stays
  - [x] `source: quizazz` curriculum YAML selector — vendor selector; stays
- [x] Draft `docs/specs/learningfoundry-pushback-recommendations.md` listing the LF-side renames Quizazz recommends pushing back to LearningFoundry's canonical `dependency-spec.md`
  - [x] BR-1 docstring (line 39–40): "compiled **quiz** manifest" → "compiled **assessment** manifest" — the noun crossing the boundary is LF-domain
  - [x] Data Flow Summary runtime block: `LessonView renders QuizBlock component...` → show `<AssessmentBlock>` as the LF-side mount point that delegates to `<QuizBlock>` when `source: quizazz`
  - [x] Data Flow Summary runtime block: `learningfoundry writes {quizRef, score, maxScore} to its assessment_scores table` → `{assessmentRef, score, maxScore}` (LF's own DB column shouldn't carry vendor terminology)
  - [x] `AssessmentCompleteEvent` interface field `quizRef: string` → `assessmentRef: string` at the LF generic event level (Quizazz's vendor event still fires `quizRef`; the rewrite happens in `<AssessmentBlock>`)
  - [x] Add **RR-1b: Prop and Event Relabel** parallel to RR-1a — `<AssessmentBlock>` is the sole translation surface on the TS side, owning both the `assessmentRef` ↔ `quizRef` prop relabel and the event-detail `quizRef` → `assessmentRef` rewrite; symmetric to `QuizazzProvider`'s manifest-key relabel on the Python side
  - [x] Generalize package-distribution and versioning sections so they read as "for the `quizazz` provider" rather than describing the only provider
- [ ] Sync local mirror of dep spec from LearningFoundry once those changes land upstream (`cp ../learningfoundry/docs/specs/quizazz/dependency-spec.md docs/specs/learningfoundry-dependency-spec.md`) — *deferred until LF lands the upstream changes*
- [x] Verify Quizazz's path-escape constraint (BR-1 last bullet) is implemented and tested: `compile_assessment` raises `quizazz.ValidationError` when `yaml_path` resolves outside `base_dir`
  - [x] If missing, add the check in `quizazz.compile_assessment` and a unit test (`tests/test_library_api.py`) — *already implemented in `python/src/quizazz/api.py` (`_resolve_under_base`) and covered by `python/tests/test_api.py` `TestPathEscapeGuard` (dotdot, absolute-outside, symlink-escape, absolute-inside); no new file needed*
- [x] Bump version (lockstep — no public-API change, doc-only):
  - [x] [`python/pyproject.toml`](../../python/pyproject.toml) `version` → `"1.3.2"`
  - [x] [`python/src/quizazz/__init__.py`](../../python/src/quizazz/__init__.py) `__version__` → `"1.3.2"`
  - [x] [`app/package.json`](../../app/package.json) `version` → `"1.3.2"`
  - [x] `MANIFEST_SCHEMA_VERSION` unchanged (`"1.0"`)
- [x] Update [`CHANGELOG.md`](../../CHANGELOG.md) with a `1.3.2` entry summarizing the boundary clarification and pointing at `learningfoundry-pushback-recommendations.md`
- [x] Verify: `pnpm exec vitest run` and Python tests still pass (no source changes expected aside from the optional path-escape test)
- [ ] Push tag(s) *(developer-initiated)*

---

## Future

<!--
This section captures items intentionally deferred from the active phases above:
- Stories not yet planned in detail
- Phases beyond the current scope
- Project-level out-of-scope items
The `archive_stories` mode preserves this section verbatim when archiving stories.md.
-->
