# Guild Quest Reception Counter Implementation Plan

**Date:** 2026-11-19  
**Goal:** Implement the Guild Turn-in Tray & Receptionist Bell on the left rim of the desk.  
**Tech Stack:** Native ES Modules (`.mjs`), Vanilla CSS, WAAPI (`animateTransient`), `node:test`.  

---

## Phases & Milestones

### Phase 1: Pure Model & Dialogue Logic (`dist/quest-reception-model.mjs`)
- [ ] Define `RECEPTIONIST_IDLE_QUOTES` and `RECEPTIONIST_TURNIN_QUOTES`.
- [ ] Implement `pickReceptionistQuote(isSubmission, seed)`.
- [ ] Implement `canReceiveQuest(item)`.
- [ ] Write unit tests in `tests/quest-reception.test.mjs` verifying quote selection, determinism with seeds, and quest eligibility.

### Phase 2: Audio & Sound Catalog (`dist/sound-catalog.mjs`)
- [ ] Add `bell` sound recipe into `DESK_SOUNDS` using pitched metallic clips (`impactMetal_light_000`, `impactMetal_light_001` with higher pitch rate) or synthesized audio.
- [ ] Verify audio mute/unmute and volume governance compliance.

### Phase 3: Visual Styling & Brass Counter (`dist/quest-reception.css`)
- [ ] Style `.guild-reception` container positioned along the left rim of `.desk-surface` / `#board-scroll`.
- [ ] Style the brass turn-in tray with woodland velvet interior, engraved filigree borders, and dropzone hover glow.
- [ ] Style the 3D brass service bell with plunger, bell dome, base, and click depression.
- [ ] Style the parchment speech bubble with tail, fade-and-float animation, and dark ink typography.
- [ ] Style the giant `GUILD ACCEPTED` red/gold wax/stamp mark and sliding archive motion.
- [ ] Scale responsiveness with `--desk-scale` and `@media (max-width: ...)` matching Adventurer Card.
- [ ] Import `quest-reception.css` into `index.html`.

### Phase 4: Interactive Component Implementation (`dist/quest-reception.mjs`)
- [ ] Create `createQuestReception(...)` factory function.
- [ ] Implement dropzone detection and resting quest container.
- [ ] Implement withdrawal: allow dragging a resting quest back out onto the board before submission.
- [ ] Implement bell click / keyboard trigger:
  - Depress plunger and wobble bell.
  - Display receptionist speech bubble.
  - If quest present: trigger stamp animation, trigger blue mana flight to Adventurer Card, commit `setItemStatus('done')` and `setArchived(true)`, and slide paper away.
  - If tray empty: trigger idle bell chime and playful idle receptionist greeting.
- [ ] Expose public methods: `mount`, `checkDrop`, `placeQuest`, `ringBell`, `destroy`.

### Phase 5: App Integration & Wiring (`dist/app.mjs`)
- [ ] Mount `questReception` inside `#board-scroll` on the left desk rim.
- [ ] In `dist/app.mjs` drag handlers: check if dragged quest is released over the reception tray dropzone.
- [ ] Connect submission completion to `adventurerCard.flyMana({ origin, deltaXp })` and `renderCounts()`.
- [ ] Update `package.json` `check` script to include new modules.

### Phase 6: Verification & Polish
- [ ] Run `npm run check`.
- [ ] Run `node --test tests/quest-reception.test.mjs`.
- [ ] Run full test suite (`npm test`).
- [ ] Update `docs/verification.md` with results.
- [ ] Push commit to GitHub `main`.
