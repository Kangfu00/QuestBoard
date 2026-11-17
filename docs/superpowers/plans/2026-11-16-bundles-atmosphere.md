# Quest Bundles and Guild Atmosphere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Multi-select and move quests as one tactile packet; add configurable local lighting, dust, rain and tavern ambience.

**Architecture:** Isolated captured bundle controller intercepts only selected multi-quest grips; existing single drag remains. Atmosphere rendering/settings and continuous audio have independent controllers; app wires data/controls/mute.

**Tech Stack:** Native ES modules/CSS/WebAudio/Node tests.

**Spec:** docs/superpowers/specs/2026-11-16-bundles-atmosphere-design.md

## Global Constraints
- Local-only, no dependencies/deployment/schema changes, no real quest data access.
- No local-origin browser automation; actual controllers with synthetic DOM and temporary HTTP tests are permitted.
- Quest batch updates are atomic, preserve nonlocation edits and persist once; cancellation writes nothing.
- Ambience is opt-in, gesture gated, mute aware; decorative effects cannot capture input and reduced-motion/hidden-tab behavior must be bounded.

## Review Focus
- Gesture capture must not conflict with single paper/window drag, form entry, checkbox click or stamp.
- A stale/deleted selected quest or invalid destination cannot partially move a batch or overwrite newer notes.
- Tray/board transforms and grab point must work at different zoom levels and after drawer opens.
- Continuous audio must stop/release on mute, hide, toggle, error and destroy without duplicate loops or late starts.
- Overlays/controls must not flatten folio3D, obscure text, or block pointer targets.

### Task1: Bundle controller/model/visuals
Files: dist/quest-bundles.mjs, optional dist/quest-bundle-model.mjs, dist/quest-bundles.css, tests/quest-bundles*.test.mjs.
- [x] RED tests for selection, atomic latest-state updates, folder/tray/board drops, cancellation and scale geometry.
- [x] Implement interface in spec, bounded fanned ghosts and one cue per gesture; root wires select button and callbacks.
- [x] Focused GREEN, no existing single-drag regressions.

### Task2: Atmosphere visuals/settings/controls
Files: dist/atmosphere.mjs, dist/atmosphere.css, tests/atmosphere.test.mjs.
- [x] RED tests settings normalization/persistence, independent controls, day/night, reduced motion/visibility/cleanup.
- [x] Implement overlays and scoped controls with pointer-safe bounded paint effects.
- [x] Focused GREEN.

### Task3: Local ambience recordings/player
Files: dist/ambience.mjs, tests/ambience.test.mjs, dist/audio/ambience/*, docs/ambience-sources.md.
- [x] Verify primary-source license and provenance; bundle usable local rain/tavern recordings.
- [x] RED lifecycle tests; implement opt-in gesture-gated loops/fades/volume/mute/hide/destroy and decode failure cleanup.
- [x] Focused GREEN and verify audio format, durations and bounded gains.

### Task4: Integration/review/verification
Files: dist/app.mjs, dist/index.html, package.json, relevant tests/docs.
- [x] Wire bundle selection and existing drop surfaces, ghost ownership/abort, menu controls, global mute and gesture unlock.
- [x] Run focused regressions, approved temporary-HTTP full suite and module checks.
- [x] Independent review; fix important findings with regressions; document real browser/listening limits.
