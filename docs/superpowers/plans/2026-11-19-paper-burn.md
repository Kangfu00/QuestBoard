# Implementation Plan: Paper Burn & Urgency System

**Goal:** Implement the physical paper burn effect based on due dates, with pure calculation model, deterministic masks, CSS styling, midnight/visibility time updates, extinguish effect on stamping, rekindle animation, and complete test suite.

## Tasks

- [x] Task 1: Create `dist/burn-model.mjs` with `burnStage`, `burnVariant`, `generateBurnMaskSvg`, `burnMaskDataUri`, and `msUntilNextMidnight`.
- [x] Task 2: Create unit tests in `tests/burn-model.test.mjs` testing all stage boundaries, DST/midnight safety, invalid inputs, deterministic variants, and masks.
- [x] Task 3: Create `dist/paper-burn.css` with 4-stage inset shadows, ember glow/pulse, `--burn-mask` bindings for variants 0–3, soft `.overdue` text, drag pauses, and forced-colors/reduced-motion fallbacks. Link in `dist/index.html`.
- [x] Task 4: Enhance `createPaperEffects` in `dist/paper-effects.mjs` with `extinguish(paper, { stage, variant })` and cancellation lifecycle.
- [x] Task 5: Integrate into `dist/app.mjs`:
  - `renderQuest` markup with `data-burn`, `data-burn-variant`, and `<span class="paper-burn" aria-hidden="true"></span>`.
  - Midnight timer and `visibilitychange` synchronization (`syncBurnStages`).
  - Stamping extinguish integration in `stampPaper`.
- [x] Task 6: Unit and integration tests for extinguish effect lifecycle and markup in `tests/paper-burn-effects.test.mjs`.
- [x] Task 7: Update `package.json` check script, verify `npm run check`, `node --test tests/motion-governance.test.mjs`, and full `npm test`.
- [x] Task 8: Update docs (`README.md`, `docs/verification.md`, `.agent/rules/motion-and-interaction.md`, and `.agent/rules/design-system.md`).
