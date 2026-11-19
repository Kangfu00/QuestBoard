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
- [x] Mount `questReception` drawer on the left desk rim (`left: 0; top: 18px;`).
- [x] In `dist/app.mjs` drag handlers: open drawer when dragged quest approaches left edge (`e.clientX <= 75`), detect tray dropzone, cleanly remove `ghost` to eliminate freezing artifacts.
- [x] Connect submission completion to `adventurerCard.flyMana({ origin, deltaXp })` and `renderCounts()`.
- [x] Update `package.json` `check` script to include new modules.

### Phase 6: Redesign to Left Slide-out Drawer & Paper Dissolve (User Feedback Iteration)
- [x] Convert fixed tray into Left Slide-out Drawer (`#reception-drawer`) with 44px handle and badge.
- [x] Resize velvet tray to comfortably fit full A4 quest paper (280px × 396px).
- [x] Fix bell visual assembly: tightly join plunger onto dome without floating gap.
- [x] Implement golden mana dissolving animation (`is-dissolving`) on submission so quest paper vanishes cleanly.
- [x] Prevent ghost freezing by explicitly removing drag ghost on placement.
- [x] Full test coverage and governance verification passing.
- [ ] Update `docs/verification.md` with results.
- [ ] Push commit to GitHub `main`.
