# Two-sided quest paper implementation plan

**Accepted design:** Front is the existing guild quest notice. Back contains the adventurer's notes and editable/checkable subquests. Clicking the curled corner lifts a readable sheet into view, then flips it. Its motion should bend and lift like paper, with a moving shadow and matched pinhole on both sides. Close returns to the existing board/tray position.

**Architecture:** Optional notes/subquests fields keep old version-1 backups compatible. A dedicated paper reader owns the editable back and saves through the app's normal local backup queue. A visual-only segmented flip controller owns transient clones/animations/cancellation; it never mutates quest data. Existing front edit/stamp/drag behavior stays accessible.

**Stack:** Existing local ES modules, native dialog, CSS perspective, Web Animations API, Node tests. No browser bypass or deployment.

- [x] Model validation, old-backup compatibility, creation/update and notes/subquest round trips, disk recovery.
- [x] Physical flip controller: curved strips, front/back visibility, pinhole, shadow/lift, safe interruption and reduced motion tests.
- [x] Reader/editor: notes autosave, add/rename/check/remove subquests, count/progress, validation/error handling, flush on close/pagehide and form focus.
- [x] App corner button on board/tray and access from stored folios; preserve clicked stamp coordinates, photo/actions and drag. Add sounds at paper motion cues.
- [x] Full tests, syntax and independent code review; restart verified local backend for the new model fields. Document actual browser verification limitation.
