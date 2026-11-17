# Shared top storage tray implementation plan

**Goal:** One wooden drawer pulls down from the top and stores real quest sheets and folios in a freely arranged space.

**Architecture:** Keep the existing archive/folder relationships and backup format version. Add optional per-item storagePosition, leaving board coordinates independent. A focused storage-tray module renders the combined physical contents and handles vertical drawer motion; existing drag/model actions move items between board, tray and folders.

**Tech stack:** Local ES modules, CSS, Pointer Events, existing Node tests and local backup server.

**Accepted design:** User chose one large combined drawer at the top. Include search and create-folder inside; retain the separate tool drawer. Imported/older stored items receive deterministic default positions, with no loss of folder membership. Drag horizontally/vertically inside a scrollable wooden tray; drag out onto the board to restore. Click/touch/keyboard open and close; reduced-motion supported.

- [x] Model: normalize and persist optional storagePosition; migration, roundtrip and independent coordinates tests.
- [x] Tray module/CSS: physical item rendering, vertical pull with capture/cancel/snap; search and default layout geometry tests.
- [x] App: replace old storage UI with combined top tray; preserve folder actions; use precise tray drop positions and per-surface hit testing. No duplicate IDs.
- [x] Verification: focused tests and full suite, syntax, backup compatibility. Browser UI remains restricted; do not bypass.
