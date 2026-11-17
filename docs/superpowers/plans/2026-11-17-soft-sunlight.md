# Soft morning and evening sunlight implementation plan

> **For agentic workers:** Use the existing workspace, test-driven changes, parallel file ownership and an independent final review. This folder has no Git repository; no worktree, branch or commit operations apply.

**Goal:** Soften morning/evening sunlight, drift cloud shadows past the desk, and brighten dust where it crosses sunlight.

**Architecture:** Keep the current atmosphere controller and CSS animation lifecycle. Share one spatial beam mask between light and a synchronized bright copy of the dust field; dim base dust remains in shadow. Two static SVG cloud textures drift across both fields using transform/opacity, with invisible resets. No per-frame JavaScript, animated turbulence, dependency or data-schema changes.

**Tech stack:** Native ES modules, CSS masks/keyframes, local SVG, node:test and isolated Chromium fixtures.

**Spec:** User approved the preceding research proposal and explicitly requested implementation and testing. Morning is soft cream-gold from upper left; evening is longer amber light from the right. Preserve the existing layer above board cards and below expanded documents, pointer transparency, local settings, fine dust sizes, hidden-tab pause and reduced motion.

## Global constraints

- Local-only; never publish or access real quests/backups for QA.
- The browser origin gate denies the real page. Use only an isolated fixture with dummy content, a fresh temporary profile and no app or backup API.
- Keep the existing one minute timer; CSS owns all animation.
- Normal dust count remains 0–60. A paired bright visual copy may add at most 60 nodes, with identical geometry and drift phase; it never adds distinct visible motes.

## Review focus

- Changing time, density or audio must not restart or desynchronize existing dust.
- Clouds must travel one direction and reset while invisible, without brightness flashes or hard rectangular edges.
- Light-off/day/night must not retain a masked bright dust copy.
- Both reduced-motion paths and hidden-page pause must cover every added animation.
- Overlay compositing must keep document and folder interactions available and leave expanded windows above atmosphere.

## Tasks

- [x] Controller and regression: add paired `.desk-atmosphere-dust-lit` with `.desk-atmosphere-lit-particle` nodes, and two `.desk-atmosphere-cloud` nodes (second also `.desk-atmosphere-cloud-far`). Preserve existing particle identities and attributes. Write/run failing pairing/lifecycle tests, implement, run atmosphere tests.
- [x] Presentation: replace whole-sheet alternating rays with anchored feathered masks. Share phase mask with lit dust. Add local static cloud SVG and independent one-way transform/opacity loops. Cover pause, reduction, off and inactive phases. Verify with native fixture rather than CSS string snapshots.
- [x] Native verification and finish: dummy desk, papers and expanded windows. Seek real CSS animations, inspect masks/phase/transform/reset/dust alignment/hit testing/reduced motion, render morning/evening images and inspect them. Run all tests, syntax checks and independent review; fix confirmed findings. Update usage and verification notes.

## Execution ledger

- Baseline: previous task completed with 543 tests and syntax checks passing; Git absence reconfirmed. Existing source and atmosphere tests read before changes.
- Interfaces: root owns atmosphere.css, local SVG and documentation; controller agent owns atmosphere.mjs and atmosphere.test.mjs; native QA agent owns its new fixture/test. Shared class names are fixed above. No per-frame sampling or model module is needed because the light and bright dust use the same CSS mask in the same viewport coordinates.
- Controller: RED verified missing paired fields/clouds; GREEN atmosphere27/27 and interim full547/547. No new timer, RAF or settings keys.
- Native QA: masks and bounds agree; one-way cloud transforms and zero-opacity reset verified; pointer hit tests and both reduced-motion paths pass. Independent reviewer ran29/29 focused checks and found no product defect. Adding natural animation-clock checks to complement manually sought geometry before final verification.
- Native QA completed: fresh isolated Chromium pipe permits real requestAnimationFrame progress. Normal/lit startTime and currentTime match within0.1ms before any seek, after visibility resume and after reduced-motion recreation. Lifecycle uses fresh CSS-owned animations rather than manually paused seek probes. Cloud direction/reset and active/inactive phase checks pass.
- Visual/pixel QA: root inspected both morning/evening captures. Paired no-lit references retain identical native geometry; sampled lit motes add up to45/44 channel levels, sampled shadow motes add0. Optional captures6/6 pass. Images and metadata remain under .local/sunlight-native.
- Final verification by root: npm test549/549, zero skips/failures; npm run check31 modules passes. No new dependency, schema, publishing, real-page access or user-data changes. Full real-page visual/OS interaction and hardware FPS are outside the isolated fixture evidence; no such claims made.
