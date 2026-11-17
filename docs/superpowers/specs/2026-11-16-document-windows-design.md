# Movable document windows

User explicitly asks to park the preceding ideas, then make opened quests/folios draggable and allow several documents to stay open together. Use the existing document art and paper/folio animations.

## Chosen approach
Use nonmodal floating document windows on the current desk. One open view per quest/folder; opening an existing document raises it instead of duplicating its edit buffer. A shared manager owns position, pointer drag and stacking only. Keep dedicated edit/create forms modal; clicking a quest title opens its front reader, with editing available from that reader.

Alternatives: one movable single viewer would miss simultaneous documents; a tabbed viewer would not allow overlapping papers. A separate desktop app is unnecessary.

## Behavior
- Drag a quest toolbar or folio header to move the UI. Controls/inputs/text remain interactive and do not start window drag.
- Clicking/focusing any document raises it above other documents. New documents cascade to reveal multiple open views.
- Closing one document leaves others and their searches, scrolls, selection and unsaved input intact. Escape closes only the foremost document and yields to native modal forms.
- One reader/editor state per quest. Closing flushes notes and refuses to close on save failure. Flush all readers on pagehide/visibility/blur. Deleted quests reconcile safely.
- Each open folio has independent search, selection, opening/closing motion. Pulling a quest out does not hide unrelated windows. Its drag ghost stays above floating windows.
- Window coordinates are UI state only, never quest board/storage coordinates. Keep headers reachable after resizing; pointer cancellation restores drag start. Positions may be remembered for this session.
- Local-only, native ES modules, no dependencies/deployment, no changes to backup schema or real user data. Respect existing reduced-motion and keyboard controls. Browser automation for the local app remains denied; synthetic DOM tests are allowed.

## Shared interface
`createDeskWindows({document,window,baseZ=240})` exports from dist/desk-windows.mjs. `register(panel,{handle,onEscape,key}={})` returns `{raise(),cancelDrag(),destroy()}`. `handle` is an element or selector scoped to panel. Manager gives panel `data-desk-window`, fixed pixel left/top, margin0, inset auto, and z-index; it does not show/hide/remove panel. `destroy` unregisters/listeners without removing panel. `raise()` and pointer/focus activation establish front order. `top` getter returns the front visible panel; `size` counts registered panels; `destroy()` cleans global listeners. `onEscape` callback may refuse close by returning false. Generic manager uses hidden/isConnected/open checks and ignores native modal dialogs.

`createPaperReader` retains open(id,{back}), close(id?), flush(), id APIs and adds refresh() and ids getter; close() closes all for compatibility, close(id) one. Inject shared `windows` manager. Root will use flush() rather than close() when opening forms.

`createFolioWindows({document,window,windows,renderQuest,icon,binding,onRead,onCue,reducedMotion})` exports from dist/folio-windows.mjs. API: open(folder,items,{focus=true}), render(items), close(id,{animate=false,returnFocus=false}={}), closeAll(options), finishOpening(panelOrId?), cancelClosing(), activeId getter. Each entry has panel.dataset.openFolder and folderTarget, independent view/motion/search, scoped unique DOM ids. Manager window registration handle .folder-window-header; Escape closes that entry with animation.
