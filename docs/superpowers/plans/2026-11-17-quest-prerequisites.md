# Quest prerequisites implementation plan

> **For agentic workers:** Test-driven implementation with independent file ownership and final review. This workspace has no Git repository; no worktree/commit steps apply.

**Goal:** Choose one or more quests which must succeed before a quest unlocks; show its waiting state and animate real unlock transitions.

**Spec:** The user approved the previously recorded prerequisite idea and explicitly requested implementation, unlock animation, complete testing and bug fixes. Preserve the quiet fantasy desk, all paper/folio/tray/readers, images, notes, movement and local backups.

**Architecture:** Optional `prerequisiteIds` on quests, with missing legacy fields kept absent. A small pure dependency module validates the directed graph and derives lock state. The model enforces completion guards across every stamp path. A search/checklist in the existing quest editor selects predecessors; a compact ink badge replaces the left priority caption only for dependency quests (rank remains above), avoiding extra paper overlap. Commit compares before/after snapshots and animates every visible live copy of quests which actually unlock, without moving the paper or blocking input.

**Tech stack:** Existing ES modules, CSS/SVG/WAAPI, node:test, fresh-profile Chromium fixture. No dependencies, publishing or reads/writes to real quest data for testing.

## Rules and interfaces

- Every selected prerequisite must have status `done`; paused/failed do not unlock. Archived/in-folder quests may be prerequisites normally.
- Self references, duplicates, unknown/nonquest references and cycles are rejected. At most499 prerequisite IDs per quest; IDs follow existing100-character ASCII identifier rules.
- Locked quests remain readable, editable, movable and archivable. Marking an unfinished locked quest `done` is rejected by the model, including direct update, held stamp and modal stamp; other statuses remain usable.
- Existing completed quests keep their achievement/history when a prerequisite is reopened. Unfinished dependent quests relock. New completed quests cannot bypass unfinished prerequisites.
- Deleting a prerequisite removes that edge from surviving quests; the existing confirmation explains affected quests. Undo restores the edge as well as the deleted quest while preserving unrelated current metadata. Import/reload do not play unlock effects.
- `quest-dependencies.mjs` exports `normalizePrerequisiteIds(value)`, `validateDependencies(items)`, `dependencyInfo(items,questOrId) -> {prerequisites,pending,locked}`, `wouldCreateDependencyCycle(items,questId,prerequisiteId) -> boolean`, `newlyUnlockedQuestIds(beforeItems,afterItems) -> string[]`.
- `quest-dependency-view.mjs` exports `dependencyMarkup(quest,items) -> string`, `createPrerequisitePicker({container,items,questId,selectedIds}) -> {getSelectedIds(),destroy()}`. Checklist includes all existing quests except self; cycle-causing choices disabled with explanation; selection survives search. Generated markup is escaped.
- `quest-unlock.mjs` exports `createQuestUnlockEffects({document,window,reducedMotion}) -> {play(ids),cancelAll(),destroy()}`. It resolves valid board, tray, reader and folio paper identities, excludes hidden/back/ghost copies, and adds only local pointer-transparent ephemeral flourishes at `.quest-dependency-badge`. No whole-sheet transform, initial-load animation, persistent decoration or extra sound required.

## File ownership and tasks

- [x] Model agent: dependency helper and model integration; meaningful RED→GREEN tests for multi-prerequisite chains, cycles, direct/stamp completion guards, reopen/delete/legacy/import/budget/persistence. Own dist/model.mjs, dist/quest-dependencies.mjs and new model tests.
- [x] View agent: searchable accessible picker and compact waiting/ready badge, matching fantasy theme; tests for selected/filtered/disabled/escaped states. Own dist/quest-dependency-view.mjs/.css and its tests.
- [x] Effects agent: local knot/lock loosening plus subtle ink/gold flourish at badge; cancel/cleanup/reduced-motion and re-grab/rerender safety. Own dist/quest-unlock.mjs/.css and its tests.
- [x] Root: integrate form/save/status modal, snapshot-safe commit/transition detection, deletion/undo, style imports and checks; update folio refresh when another quest changes its lock. Add integration/backup/native fixture coverage, run full tests/checks, independent review, fix findings, document actual limits.

## Review focus

- Partial completion never unlocks; completion paths cannot bypass the model.
- Completed historical quests keep their stamp; unrelated edits do not fail or relaunch effects.
- Deletion/undo and graph import remain valid and do not erase image/notes/storage metadata.
- All visible copies refresh when prerequisite status changes, including folio views which cache by quest object identity.
- Motion never delays state persistence, steals pointer capture, transforms a whole paper or leaves an overlay behind; both reduced-motion paths and repeat commits are safe.

## Execution ledger

- Source/form/stamp/paper/folio/backup boundaries inspected. Baseline549 tests and31 syntax checks passed in preceding completed turn. Existing real-origin browser denial remains; native QA uses only dummy local fixtures and temporary profiles.
- Ruling: multi-select means all predecessors must succeed, and completed history is preserved on reopen. This follows the requested completion prerequisite without retroactively removing achievements.
- Ruling: optional field stays omitted in legacy records; no version bump. Import rejects malformed graphs instead of silently changing user intent.
- Ruling: dependency badge shares the existing metadata row to avoid covering photos or adding another toolbar to the desk.
- Model:15 new tests RED→GREEN; model/stamp105/105 pass, including sparse-array rejection. Real temporary HTTP/disk backup integration1/1 passes across server restart and rejects invalid uploads without changing last-good data/history.
- View: badge4/4 and native DOM picker fixture1/1 pass. Effects:16/16 lifecycle/surface tests RED→GREEN. Native combined flow verification remains in progress.
- Root integration: commit and cached-folio regression failed before fixes, passed afterward; modal invalid-completion and dependency deletion/undo tests RED→GREEN. Editor submit, pre-status/archive save, create and error paths verified. Existing modal fixture gained the real picker boundary; assertions remain intact.
- Ruling: old server PID6524 was verified by exact Node executable and absolute workspace server command, then restarted via Launch-Questboard.ps1 -NoBrowser. New PID2724 healthy and creation time follows model changes, preventing stale backend normalization from dropping the new field. No backup contents inspected.
- Review: independent read-only review found no confirmed product issue. Native visual fit, actual animation and OS-level interactions are outside that source review; dummy native tests cover the first two without accessing the denied real origin.
- Native combined flow:2/2 pass,75 moving and51 native-reduced checks. Real DOM picker, graph/model/held stamp, four visible paper copies,16 local WAAPI animations, natural frame progression, unchanged paper geometry, hit testing, finish cleanup, repeat/relock/history and serialization covered. Root viewed final four-copy PNG; badge fits quietly in metadata.
- Ruling: unlimited test-file concurrency overloaded the native browser fixtures (sunlight frame timeout and prerequisite animation AbortError;596/598). npm test now uses --test-concurrency=1, keeping every assertion/test and bounded native deadlines. Fresh full run598/598 passes with no skips; syntax34 modules passes. This schedules real rendering work rather than weakening animation assertions or changing product cancellation.
- Final optional native capture rerun2/2 passes; artifacts under .local/prerequisite-native. No real page, quest state or backup contents accessed. No publishing/dependency installation, schema-version bump or new audio. User must Ctrl+F5 to load frontend modules; backend already reloaded as recorded above.
