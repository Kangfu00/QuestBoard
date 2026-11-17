# Independent document-window review

Reviewed against `2026-11-16-document-windows-design.md` and its implementation plan. Product code was read-only during this review.

## Findings

No outstanding actionable regressions found in the current implementation.

The review covered pointer capture and cancellation, header control exclusions, keyboard movement and viewport clamping; mixed reader/folio stacking and Escape/native-modal precedence; independent reader drafts, save rejection, turns, lifecycle flushing and deletion; per-folio search/bookmark/scroll/motion and scoped IDs; and the application path for extracting a paper while other windows remain open. Window geometry stays outside persisted quest coordinates, and extraction ghosts use a higher stacking level.

An independently reproduced same-ID data-replacement hazard would retain stale reader notes/checklists through `paperReader.refresh()` and overwrite restored checklist data on the next edit. The current import guard at `dist/app.mjs:858` closes old reader buffers before replacing state and aborts replacement if a synchronous save is rejected. Its integration regression test passes; the hazard is no longer reachable through the import path reviewed.

Also inspected and verified the root's drop-target correction at `dist/app.mjs:399`: releasing a pulled paper over a floating document no longer detaches it onto the board behind that document. Valid destination folios remain handled first. The actual-handler regression passes.

## Spec verdict

**Pass for the requested floating multi-document scope.** One instance per document, independent local state, shared stacking/movement, close isolation, modal precedence, deletion cleanup and preservation of the existing paper/folio motions match the design.

Save-failure refusal here follows the existing synchronous application-state commit contract: a thrown `onSave` rejection preserves the reader. As before this change, `persist()` queues asynchronous browser/file backup and reports its outcome separately. Closing does not wait for durable backup acknowledgement. This is an existing persistence limitation, not a regression introduced by the window feature.

## Code-quality verdict

**Pass.** The manager owns geometry/activation, reader and folio controllers own their instances, and app integration owns task persistence. No new dependencies, storage schema changes or real-data access were introduced by this review.

Reviewer verification: `node --test tests/desk-windows.test.mjs tests/paper-reader-windows.test.mjs tests/folio-windows.test.mjs tests/document-windows-integration.test.mjs` — **34/34 passed**; `node --test tests/folio-preview-drag.test.mjs` — **9/9 passed**. A separate synthetic run against the real reader reproduced the data-replacement hazard above before checking the import retirement guard. No full-suite rerun or local-origin browser automation was performed by the reviewer. Native browser pointer dispatch, overlap rendering and visual animation quality remain outside synthetic-DOM verification.
