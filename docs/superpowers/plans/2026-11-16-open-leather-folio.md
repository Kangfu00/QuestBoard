# Open two-wing leather folio plan

**Accepted design:** Left wing is the persistent inside leather cover with folder name, searchable quest index and pocket. Right wing holds the selected full quest sheet and a few offset paper edges. Cord unties before the cover swings open; opening ends with both covers visible. Closing squares the papers, folds the cover and ties the cord.

**Architecture:** Dedicated folio view module renders the two-wing composition and manages selection/filter/preview identity without mutating quest data. App retains folder membership, drag/drop, paper-reader/edit/restore actions and existing backup flow. A separate final CSS layer supplies physical covers, spine/pocket and safe progressive motion. Existing motion controller owns cancellable open/close classes/copies and cues.

**Constraints:** Local only; old data/positions unchanged. Responsive small-screen layout and reduced motion required. No alternate browser/Playwright/CDP use while the managed origin restriction applies.

- [x] Full folio shell, stable selection/search, full-paper preview and index actions; preserve exact drag anchor at preview scale.
- [x] Persistent leather wings, central crease/pocket, full sheet stack and physical open/close choreography; cancellation-safe cues.
- [x] App integration and keyboard/drag/focus handling; empty/search/deletion cases.
- [x] Tests, syntax, code review and documentation. Actual browser rendering remains unverified.
