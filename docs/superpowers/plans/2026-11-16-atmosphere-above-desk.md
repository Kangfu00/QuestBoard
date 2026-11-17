# Floating dust above desk documents

User requests freely floating dust and atmosphere above normal folders/quests, except expanded readers. Existing atmosphere is a pointer-transparent child of board-scroll at z0, underneath the transformed board-canvas; expanded quest and folio windows are body-level panels managed at z240+.

Use the existing CSS layer at z20, above the board-canvas's stacking context and below empty-state UI z30, drawers/tools and expanded readers. Keep its existing board viewport containment and pointer transparency. No ancestor filters/opacity/transforms or modifications to window management. Reduce the night wash strength for text legibility now that it crosses normal paper cards.

- [x] CSS owner: raise only .desk-atmosphere to z20 and update its composition comment. Replace one-direction fade/reset dust with a closed, bidirectional multi-waypoint loop using existing --dust-dx/dy, duration and negative delays. Keep fine sizes/count/density; keep visibility/reduced-motion pausing. Gentle irregular opacity rather than blinking/resetting. Reduce night base wash alpha to roughly0.14–0.24 plus restrained radial tint; keep warm pools and phase animation.
- [x] Root: update obsolete under-paper comments/test wording, preserving DOM placement and existing behavioral assertions; update README. No new tests that copy CSS values for this reversible visual edit.
- [x] Verify existing atmosphere/audio/window tests and syntax; independently inspect actual board stacking context and body-level expanded windows, pointer transparency, fine dust and motion lifecycle. Full npm test435/435; npm run check26 modules passed. Independent scoped source review found no actionable issue. No browser/UI fallback under the existing managed denial; actual visual stacking/dust/night legibility remain unverified.

No data, persistence schema, audio, dependencies, publishing, new timers or DOM changes. CSS owner edits only dist/atmosphere.css; root owns other files. Local-only app without Git; no worktree/commit steps apply.
