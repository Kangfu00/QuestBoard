# Desk motion implementation plan

**Goal:** Implement the three animation ideas accepted by the user: weighted papers, folders receiving papers, and unfolding folders with layered searchable contents.

**Architecture:** Keep the existing local ES-module app and data model. Transient ghosts and decorative covers animate independently of synchronous state updates. All pointer positions remain immediate; no spring controls board or drawer coordinates.

**Constraints:** Local-only; no dependencies or data migration. Honor reduced motion. Existing drawer pull fix stays intact. Browser interaction is blocked by saved managed policy, so verify with geometry/lifecycle and actual-handler tests and disclose the visual QA limit.

## Work

- [x] Add tested inverse grab geometry and anchored ghost pose at all zooms; bounded velocity tilt; safe cancellable animation lifecycle.
- [x] Integrate paper lift and settling in both board drag and stored-paper extraction. Cancel effects before re-grabbing; never retain pointer capture after release/cancel.
- [x] Add receiving flap, paper insertion and unfolded layered folder styling. Commit membership before visual effects; cleanup even when animation fails. Opening the same folder again animates, search/render updates do not.
- [x] Run regression suite and syntax checks, review independently, record outcomes in verification notes.

## Review focus

Pointer anchor under rotation/zoom; interrupted/replaced animations; missing/throwing animation API; reduced motion; rapid folder reopening/search during opening; existing drawer drag geometry; persistence independent of animation completion.

## Ownership

Root: app integration, index, integration tests and documentation. paper_motion agent: desk-motion.mjs and its tests. folder_motion_visuals agent: motion.css only. No overlapping edits.

## Completed verification

Full suite 140/140; syntax checks passed. Three independent review findings received RED→GREEN regression fixes; no deferred findings. Browser rendering remains unavailable under the saved origin policy. No data schema or backup changes.
