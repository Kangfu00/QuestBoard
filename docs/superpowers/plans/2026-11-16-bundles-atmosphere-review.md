# Independent review: bundles and guild atmosphere

Reviewed 2026-11-16 against `docs/superpowers/specs/2026-11-16-bundles-atmosphere-design.md` and the corresponding implementation plan. Scope: quest bundle model/controller/CSS, atmosphere settings/controls/CSS, ambience lifecycle and provenance, and their `dist/app.mjs` integration. Review used source inspection and synthetic state/DOM boundaries; it did not access real quest data.

## Findings

No unresolved important correctness findings in the final reviewed source.

One P2 finding was reproduced and fixed during review:

- **Returned bundles were hidden by active desk filters.** The original `setupQuestBundles()` commit callback in `dist/app.mjs:283` called `commit(next)` without resetting filters. Reproducer: filter the desk to completed quests (or an unrelated search), select two active quests from the tray or an open folio, then drop the packet on exposed desk. Both quests became unarchived and selection cleared, while `renderBoard()` filtered them out, making a successful drop appear to lose the papers. A targeted probe against the actual setup callback and bundle model confirmed `archived: [false,false]`, `visibleOnDesk: 0`, `statusFilter: 'done'`. The final callback records the latest `onTarget`, clears status/category/search and the search field before its one board commit, and leaves other destination filters alone. The regression in `tests/bundles-app-integration.test.mjs` exercises the actual setup callback; all four tests in that file passed independently after the fix.

## Spec verdict

Source and synthetic evidence support the selected item 2 and item 4 scope. Bundle selection spans desk, tray and folio sources while excluding paper readers and writing fields. Captured multi-paper gestures have one bounded ghost/count, latest-state validated batch movement, rotation/content preservation, single-commit ownership, cancellation restoration and one packet cue pair. The late title Shift-selection, tray z-order, and blur/pagehide cue cleanup edits were also inspected. Existing single-paper and window gestures retain their event paths.

Atmosphere preferences use a separate local key and native menu controls. The bounded decorative layer has pointer events disabled, sits under the paper canvas, and avoids new compositing properties on folio ancestors. Hidden and reduced-motion behavior is explicit. The ambience controller uses local recordings, gesture unlock, current requested settings, mute-aware fading/release, immediate hidden-tab release, guarded asynchronous loading/resume, and teardown. Recording sources and processing limits are documented in `docs/ambience-sources.md`.

## Quality verdict and limits

The controller/model boundaries keep persistence, temporary gesture ownership, decorative preferences and continuous audio separate. The important filter integration issue is fixed with a focused regression. No additional change is requested from this review.

Real-browser layout, art direction, 3D presentation, touch hardware and subjective listening were not verified because the managed local-origin browser restriction remains in force. Audio provenance was inspected from the recorded source documentation; this review did not repeat external source/license retrieval. These are verification limits, not claims of visual or listening approval. The root agent owns the final full-suite and module-check results; this review did not rerun the full suite.
