# Motion Upgrade Phase 2 & 3 Implementation Plan

**Goal:** Implement physical light-and-shadow directionality, release inertia with anticipation-action-settle, drag atmosphere suspension, playbackRate acceleration, and reduced-motion crossfade.

**Architecture:**
- Pure mathematical functions in `dist/desk-motion.mjs` for release inertia.
- Dynamic directional lighting CSS variables in `atmosphere.mjs` and `tabletop.css`.
- Atmosphere suspension state in `atmosphere.mjs` triggered by pointer interactions in `app.mjs`.
- Fast-forward animation helpers via Web Animations API in `desk-motion.mjs`.

**Tech Stack:** Native ES modules, CSS Custom Properties / WAAPI, `node:test`.

## Global Constraints
- Zero external dependencies.
- No direct `.animate()` calls outside `dist/desk-motion.mjs`.
- All `.mjs` files registered in `package.json` `check`.
- Preserves full backward compatibility and zero disruption to backup schema.
- All existing tests and `tests/motion-governance.test.mjs` must pass 100%.

## Tasks
- [x] Task 1 (Phase 2, Item 1): Unified directional light and shadows (`--light-x`, `--light-y`, `--lift`).
- [x] Task 2 (Phase 2, Item 4): Suspend atmosphere animations during drag (`setSuspended`).
- [x] Task 3 (Phase 2, Item 2 & 3): Pure `settleTiltKeyframes` function and Anticipation-Action-Settle in `settlePaper` and `paperweight`.
- [x] Task 4 (Phase 3, Item 5): Fast-forward animations with `playbackRate` in unfolding flows.
- [x] Task 5 (Phase 3, Item 6): Reduced-motion crossfade (120ms) where applicable.
- [x] Task 6: Tests, governance verification, and verification logging.
