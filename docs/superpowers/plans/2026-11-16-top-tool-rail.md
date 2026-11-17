# Top tool rail implementation plan

**Goal:** Put the pen and three stamp tools in a shallow wooden rail above the board, with advanced tools behind a separate button.

**Accepted design:** Pull down/click to open the rail; fold to a narrow handle. Reserve vertical space rather than cover papers. Keep paper scale stable. The right storage dock and top tools operate independently. Advanced controls remain accessible in a dedicated dialog so the rail stays shallow.

**Architecture:** A small vertical Pointer Events controller mirrors the storage dock lifecycle. CSS shares measured tool-space with page top padding; board fit reconstructs undocked height as well as width. Existing pen/stamp/settings bindings retain their IDs; advanced controls move to a dedicated native dialog.

- [x] Implement vertical rail geometry, pointer capture/cancel/resize and reserved height tests.
- [x] Move tools above the desk; lay out pen/stamps horizontally, move advanced controls into their own dialog and update help/shortcuts.
- [x] Decouple storage and tool open state; preserve current paper scale for combined layout changes and dragging.
- [x] Run syntax and regression tests; document browser verification limit. No model/backup/deployment changes.
