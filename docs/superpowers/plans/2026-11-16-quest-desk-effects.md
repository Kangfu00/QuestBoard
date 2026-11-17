# Exact stamping, drawer feed and quest arrival

**Approved goal:** Implement all three proposed desk interactions in the existing local fantasy board.

**Design:** A stamp's centre is the clicked local paper point, even during zoom/rotation; ink clips to paper edges and its point survives persistence. Keyboard/menu stamps retain their current/default point. Storage commits immediately, then the retained paper approaches the drawer slot and slides behind a clipping plane at the wooden lip. Newly created quests are placed in the visible board area and emerge from the tool drawer edge, unfolding and settling; edits never replay arrival.

**Constraints:** No online deployment/dependencies; old backups remain compatible. No animation delays data mutation, pointer tracking or input. Reduced motion is immediate. Cancel effects on re-grab, rerender, resize, drawer movement, blur/pagehide. The managed browser-origin denial remains in force; verification is source, geometry and event/controller tests, not rendered QA.

- [x] Add validated nullable stampPosition, preservation/reset behavior, and backup round-trip tests.
- [x] Add affine pointer-to-paper calculation and integrate held stamp clicks, clipped ink and aligned impact.
- [x] Add cancellable two-stage drawer feed and immediate-state archive integration.
- [x] Add new-quest arrival from the tool drawer edge to a visible board position.
- [x] Add physical slot/ink styling, independent review, full tests and syntax checks.

**Ownership:** stamp_position_model owns model/stamp-tools and new model tests. paper_desk_effects owns paper-effects.mjs and tests. quest_effects_visuals owns quest-effects.css. Root owns app, stamp-placement helper/tests, index/package/docs and integration tests.

**Result:** 199 tests pass; 12 production modules pass syntax checks. Independent review's arrival pickup offset was reproduced and fixed RED→GREEN by capturing the current local grip before cancellation, reconciling the provisional board position, and preserving release/cancel semantics. Real disposable-server backup/restart/cache-clear test preserves stampPosition. Verified local server process refreshed with -NoBrowser to load the new validator. Browser rendering remains unverified under the saved origin policy.
