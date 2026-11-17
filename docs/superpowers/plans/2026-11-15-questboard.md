# Questboard Implementation Plan

> **For agentic workers:** Use executing-plans for the main UI and bounded parallel implementation for the data model.

**Goal:** Build a polished Thai RPG quest board with freely placed quests/labels and customizable status stamps.

**Architecture:** Buildless HTML/CSS/JavaScript. Pure model module, IndexedDB storage and a DOM UI. Static Sites hosting.

**Tech Stack:** Native ES modules, CSS, SVG, IndexedDB, Node test runner.

**Spec:** docs/superpowers/specs/2026-11-15-questboard-design.md

## Global Constraints

- User-selected warm guild theme; Thai controls; no copied game assets.
- Browser-local data with explicit backup/restore.
- Validate imports and image uploads before applying.

## Review Focus

- Reload must preserve an intentionally empty board.
- Dragging at non-100% scale must track pointer and stay in bounds.
- Invalid imports must not erase saved data.
- Uploaded images must remain visible after reload.
- Cancelled dialogs and pointer gestures must not apply accidental actions.

## Tasks

- [x] 1. Model + storage: define state schema, seed state, CRUD, filtering, stamp transitions, import validation. Write meaningful node tests first, run and implement. Owner: model agent, dist/model.mjs and tests/model.test.mjs only.
- [x] 2. UI: dist/index.html, dist/styles.css, dist/app.mjs. Create sidebar, header, board surface, quest/label cards, editing dialogs and stamps library. Pointer and keyboard interaction; persistence and backup.
- [x] 3. Validate (with browser limits recorded in docs/verification.md): node --test; syntax checks; browser visual and interaction QA at desktop/mobile. Independent review and fix observed failures.
- [x] 4. Deliver locally: user explicitly chose local-only after automatic approval review rejected remote synchronization. Provide a local launcher, running preview and README. No push or deployment.

## Decisions

The empty workspace is isolated in guild-board/. Plain JavaScript is sufficient for local interactions. Implement directly under the user's creation request and selected theme; no further design approval gate needed. Source synchronization and publication are provided by the Sites workflow.

