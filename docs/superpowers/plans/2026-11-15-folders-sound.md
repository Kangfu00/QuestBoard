# Folders, sound and archive stability

**Goal:** Fix text selection and archive freezing, add physical folders and soft local sound effects while preserving the quiet desk and existing data.

**Approach:** Extend the existing local ES-module app. Folders are board items that can live in the archive drawer or on the board. A quest belongs to at most one folder. Opening a folder shows a nonmodal paper panel with search and draggable contents. No publication or external assets.

**User-authorized scope:** Remove the blue selection shown in the attached image, fix shaking/freezing after archiving, create folders in the drawer, move quests into folders, bring folders onto the board, search/extract contents, and add action sounds. Routine choices: a single folder nesting level, existing three folder colors, quiet synthesized sounds with mute/volume in the hidden tools menu.

- [x] Reproduce archive freeze and fix the layout/event root cause with regression coverage.
- [x] Add folder model, legacy migration, validated membership and safe folder deletion (model agent).
- [x] Add physical folder visuals and lazy Web Audio effects (visuals/audio agent).
- [x] Integrate folder creation, board/drawer placement, search and pointer drag/drop of folders and members (root).
- [x] Prevent selection on physical papers while retaining editable fields and keyboard focus.
- [x] Independent source review and full suite: 66 tests passed; all five production modules parse.
- [ ] Verify real drag/drop repeatedly, folder persistence, sound controls and existing stamping. Browser permission was denied; renewed permission requested after implementation.

**Safety of data:** Moving a folder never deletes its contents. Removing a folder releases its quests to loose archive storage. Legacy version-one files normalize absent folderId to null. Folder references are validated on import.

**Checks:** Native pointer drags using current Windows screenshots; browser DOM reads to detect layout stability and overlay hit areas; model round-trips and layout regressions; manual UI cleanup of disposable test items.
