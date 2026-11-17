# Movable Document Windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Open, move and stack several quest and folio documents while retaining each document's state.

**Architecture:** Shared desk-windows manager owns view geometry and focus; reader and folio controllers own document instances. App retains task data and existing drag/drop persistence.

**Tech Stack:** Native ES modules, CSS, Node test runner.

**Spec:** docs/superpowers/specs/2026-11-16-document-windows-design.md

## Global Constraints
- Local-only, no new dependencies, no backup schema/data migration or real user-data access.
- No Git repository; modify the established workspace in place.
- No local-origin browser automation; use actual controllers with synthetic DOM where possible.
- Position/stack state never mutates saved task placement; save failure must preserve input.

## Review Focus
- Concurrent quest notes must save to their own quest; opening the same quest must not discard drafts.
- Dragging a window must not drag its quest, select text, or swallow button/input actions.
- Escape/native modal forms and stacking must work across both document types.
- Closing/deleting one document must not affect other windows or leave listeners/animations.
- Folio paper drag must target the correct instance and remain visible over windows.

### Task1: Shared floating-window manager
Files: dist/desk-windows.mjs, dist/document-windows.css, tests/desk-windows.test.mjs. Implement shared interface from spec.
- [x] RED tests: independent drag/raise; control exclusions; cancel/blur/release; viewport clamp; top-only Escape/modal precedence; cleanup and session position.
- [x] Implement manager and sparse toolbar/active-window styling; preserve folio/paper art.
- [x] Focused tests GREEN.

### Task2: Multiple paper readers
Files: dist/paper-reader.mjs, dist/paper-reader.css, tests/paper-reader-integration.test.mjs and new multi-reader behavioral test.
- [x] RED tests: two readers, same-id raise, independent notes/flip/save/failure/close, flush all.
- [x] Implement nonmodal per-id reader instances injected with shared windows manager; toolbar drag; refresh fronts safely.
- [x] Keep turn/back-editor behavior; focused suite GREEN.

### Task3: Multiple folios
Files: dist/folio-windows.mjs, dist/folio-view.mjs, tests/folio-windows.test.mjs, tests/folio-view.test.mjs; scoped styling if necessary.
- [x] RED tests: two folders, independent search/selection/close, same-id reuse, deletion reconciliation and scoped DOM ids.
- [x] Implement controller and shared window registrations; preserve each view and separate motions.
- [x] Focused suite GREEN.

### Task4: Integrate and verify
Files: dist/app.mjs, dist/index.html, package.json, relevant actual-handler integration tests, docs.
- [x] Route quest title to front reader; preserve explicit edit action. Replace singleton folio wiring with controller wrappers.
- [x] Keep open folios visible while extracting quests; ghosts above windows; close only intended folder; Escape delegated to manager before global actions.
- [x] Run focused drag/notes regressions, full suite with temporary HTTP permission, module syntax checks.
- [x] Independent code review; fix important findings with RED→GREEN; record final evidence and browser limits.
