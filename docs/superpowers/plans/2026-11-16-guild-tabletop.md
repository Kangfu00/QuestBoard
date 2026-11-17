# Guild Tabletop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Turn the accepted fantasy board into a sparse registrar's tabletop with responsive loose papers, physical storage details and synchronized contact sound.

**Architecture:** Keep app.mjs as integration owner; add a small pure paper-grip module, extend storage drawer motion through optional callbacks, and keep folio view state in its existing controller. CSS changes never change saved placement geometry.

**Tech Stack:** Native ES modules, CSS, Node test runner.

**Spec:** docs/superpowers/specs/2026-11-16-guild-tabletop-design.md

## Global Constraints
- Local-only; no deployment or external uploads; no new dependencies.
- Do not change user data, backup format, or saved item coordinates for visual motion.
- Respect reduced motion, mute, pointer cancellation and re-grabbing.
- No local-origin browser automation; synthetic DOM/temporary HTTP checks are allowed.
- No Git repository exists; edit the established local project in place.

## Review Focus
- Paper grabbed at corners under desk zoom must stay under the cursor.
- Reopening/filtering a folio must preserve last selection without showing stale/deleted quests.
- Drawer movement must not alter saved coordinates or leave residual transforms.
- Cancel/re-grab must retire delayed sounds and transient effects.
- Empty/single-quest folios must not pretend to contain a stack.

### Task 1: Grip response
Files: create dist/paper-grip.mjs, dist/tabletop.css, tests/paper-grip.test.mjs; root integrates app.mjs/index.html.
Interface: paperGripPose(grab,{width=300,height=350,tilt=0,reduced=false}={}) returns {transform,shadeX,shadeY}; transform is an appendable CSS transform suffix with no translation or scale; invalid input is neutral. Root appends it after ghostPose transform, preserving transformOrigin.
- [x] Write and run failing tests for corner/center grip, bounded response, invalid/reduced input.
- [x] Implement pure pose and isolated tabletop styles, including no pins and soft desk shadows.
- [x] Run focused tests, integrate with held quest ghosts only; keep folder transforms rigid.

### Task 2: Folio contents and memory
Files: dist/folio-view.mjs, dist/folio-spread.css, tests/folio-view.test.mjs.
Interface: existing createFolioView API; memory belongs to its controller. Add bounded decorative stack and bookmark without replacing drag handlers.
- [x] Add failing tests for zero/one/many stack counts and selection memory across search/folder reopening/deletion.
- [x] Implement total membership count independent of search, decorative bookmark and per-folder remembered quest id.
- [x] Run focused view and integration tests.

### Task 3: Drawer contents and sound integration
Files: dist/storage-tray.mjs, dist/app.mjs, dist/tabletop.css, tests/storage-tray.test.mjs, tests/drawer-motion.test.mjs, tests/paper-drag-motion.test.mjs.
Interface: bindStorageDrawer accepts optional onMotion callback for bounded visual content offsets; app renders offsets on an inner tray plane or individual visual child without affecting hit geometry.
- [x] Add failing gesture tests for movement response, cancellation/reset and unchanged stored coordinates.
- [x] Implement subtle contained response, neutralize before drop or layout measurement.
- [x] Move existing drawer/folio contact cues to contact completion with cancellation ownership. Keep immediate data commit and reduced-motion behavior.
- [x] Remove pin markup and update visible desk wording; run drag/cue tests.

### Task 4: Verify and review
- [x] Run npm test and npm run check; record restriction-related failures separately and rerun approved temporary HTTP tests with necessary execution permission.
- [x] Fresh independent code review; address concrete important findings with regression checks.
- [x] Update README/docs/verification.md; explain actual validation limits to user.
