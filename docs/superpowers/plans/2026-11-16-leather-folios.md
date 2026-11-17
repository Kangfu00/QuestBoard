# Leather folios and cord motion

**Goal:** Replace modern manila folders with the user's approved fantasy leather document folios: worn dark leather, stitching, a small parchment title label, cream pages and a cord closure.

**Architecture:** Preserve folder data, dimensions and drag targets. Add decorative pointer-transparent cord markup and a final stylesheet. A small motion controller owns opening timers and inert closing clones, independently of the live folder's state and controls.

**Motion:** Cord loosens before cover unfolds; paper rows appear afterward. Receiving a quest keeps the cover open through insertion, then closes and reties. Explicit close/Escape immediately releases the live panel while a non-interactive clone folds and reties. Reopen cancels the closing clone; search renders stop opening effects. Reduced motion stays immediate.

**Constraints:** Local-only; no dependencies, state/schema or backup changes. Existing quests/folders/colors remain usable. Browser origin access remains denied; no bypass or visual QA claim.

- [x] Add leather/cord styling to board folios, drawer rows, open folio and closing clone.
- [x] Add tested opening/closing lifecycle controller (rapid reopen, stale callbacks, no duplicate IDs/actions, reduced motion).
- [x] Integrate decorative binding, user-facing color labels and explicit close behavior.
- [x] Verify existing drag/storage regression suite, syntax, and independent review.

**Ownership:** Root owns app/index/package/docs; leather_folio_visuals owns leather-folios.css; folio_close_motion owns folio-motion.mjs and tests/folio-motion.test.mjs.

**Result:** 152 tests passed; syntax passed for all ten modules. Independent review's closing-scroll finding fixed with a failing regression followed by a passing suite. Compact cover label clearance adjusted through 560px viewport height. No deferred findings. Browser rendering remains unverified under the saved origin denial.
