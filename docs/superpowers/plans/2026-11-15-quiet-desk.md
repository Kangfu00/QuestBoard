# Quiet Desk Implementation Plan

**Goal:** Remove dashboard clutter and use drawer-held physical tools for quest creation and stamping.

**Architecture:** Preserve the current model and IndexedDB. Replace app shell and add a small pure stamp-tools module. A final quiet-desk stylesheet controls the immersive layout without rewriting shared dialogs.

**Spec:** docs/superpowers/specs/2026-11-15-questboard-design.md, quiet desk follow-up.

- [x] Build pure choose/apply held-stamp functions and tests (model agent).
- [x] Build full viewport styling and tool objects in quiet-desk.css (visuals agent).
- [x] Replace shell, move menus to tool drawer, implement drawer exclusivity/pull and held cursor lifecycle (root).
- [x] Verify stamp click/return, Escape, keyboard and ordinary editing in browser; archive/photo/backup regressions covered by model tests. Native coordinate drag QA remains limited by browser input mapping.
- [x] Run independent review, regression tests and local browser QA; document actual verification and deliver localhost.
