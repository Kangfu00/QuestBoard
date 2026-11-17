# Separate folder drawer and louder desk sounds

User-authorized change: raise action sound volume and move folder creation/storage into a separate drawer. Preserve quiet desk, existing board data and backup behavior.

Approach: add a third mutually exclusive drawer (tools, loose quests, folders). Folder drawer owns creation, folder/content search, folder count and a folder-only return tray. Existing folder items and memberships need no migration. Keep an open folder drawer available while dragging a quest; hovering the storage handles switches receiving drawers. All three handles remain accessible on short screens.

- [x] Audio agent: increase master gain for existing saved volumes, raise new default, preserve mute/zero and avoid stacked peak clipping; test routing and controls.
- [x] Root: add failing routing tests, integrate drawer markup, state, drag targets, restoration/cancel, counts and search.
- [x] Style agent: third handle spacing and independent scrolling folder body, responsive heights.
- [x] Review changed flows, run full tests and syntax checks, update guide. Full suite103 passed. Cancelled drawer pull now restores the previously open drawer after review reproduced the gap.

Saved browser access is still denied by policy. Do not use an alternate surface or request the same approval again. Code/model/audio-graph tests and source review are allowed; real pointer and listening QA cannot be claimed this turn.
