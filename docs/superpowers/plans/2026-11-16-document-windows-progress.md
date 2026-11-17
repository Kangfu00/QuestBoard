# Execution ledger — plan: 2026-11-16-document-windows.md

- User explicitly requested the concrete floating multi-document behavior; prior idea backlog is recorded separately and is not being implemented.
- Preflight: manager interface is shared; independent agents own manager, paper reader, and folio controller. Root owns app integration and verification. Existing local app has no Git repository.
- Baseline prior turn:317/317 tests and20 module checks green. Browser/local origin restriction still applies.

- Task1 complete: shared manager11/11 RED→GREEN, capture/cancel/raise/clamp/keyboard/session memory and modal-aware Escape.
- Task2 complete: reader/editor/turn focused24/24, independent quests, save refusal on synchronous model rejection, cleanup and deletion/recreation-safe handlers.
- Task3 complete: folio focused50/50, scoped IDs, independent state and motions, cleanup, preserved live manager classes.
- Task4 app integration complete: quest-title front readers, shared window stacking, no blanket close/hide on extraction, higher held ghost layer, per-folder close and modal flush. Existing style IDs converted to scoped class selectors.
- Import replacement guard added RED→GREEN: retire old reader buffers before replacing state, refuse import on synchronous save rejection.
- Visible-document drop regression added RED→GREEN: a pulled quest released over a nonreceiving document stays filed, not behind its window.
- Independent review PASS for spec/quality; reviewer43/43 focusedchecks. Async persistence retains existing application-state/backup-queue contract, storage failures are surfaced through global backup status; no storage architecture changes. Browser visuals/native pointer dispatch remain unavailable.

- Final verification after all changes: npm test354/354 (0fail/skip), npm run check22 modules exit0. All tasks complete.
