# Paper-integrated reader controls

User explicitly requests dragging the opened quest on the actual paper rather than an external toolbar, with flipping at its lower-right corner.

- [x] Register `.paper-reader-scene` as the existing window manager's drag handle. Preserve control exclusions so notes, checklist, edit, close and turn do not drag.
- [x] Put edit/close discreetly on the sheet; keep the side announcement accessible, remove the external footer/bar.
- [x] Place a persistent folded-corner turn button inside the scene, outside the rotating/inert faces. Update accessible name, title and direction for both sides without removing its icon.
- [x] Extend meaningful actual-reader tests for placement, flip and independent windows; use actual manager tests to verify controls do not initiate drag.
- [x] Run focused and full Node checks, independent review and record browser verification limit. No data schema, user-data, dependency or deployment changes.

The user supplied the concrete layout. Root owns reader JS/test changes; CSS can be delegated independently. Existing local-origin browser restriction remains.
