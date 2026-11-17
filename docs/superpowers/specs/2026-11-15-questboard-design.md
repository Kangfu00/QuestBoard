# The Questboard

A personal Thai todo app imagined as an adventurer guild notice board. The user chose warm dark wood, gold and aged parchment. Priorities are a convincing fantasy atmosphere, readable Thai content and real free placement of quest papers and labels.

## Approach

Use a buildless browser app with ES modules and CSS/SVG textures. Compared with a 3D scene, this is faster, accessible and easier to edit. Compared with a conventional column-based task app, a fixed-coordinate canvas preserves the requested freedom of placement. IndexedDB stores the board and uploaded stamps on this browser; JSON export/import provides portable backups. No account or multi-user synchronization was requested.

## Experience

- Dark guild sidebar, parchment quest cards, brass pins, wooden board, modest ornamental dividers. The board is the dominant surface. Thai body font and restrained English display serif headings.
- Quest create/edit/delete, title/details/category/priority/due date/reward XP. Statuses active, done, failed, paused.
- Pointer drag with zoom compensation, persisted position and layer order. Keyboard arrow repositioning and editable x/y/rotation provide alternatives. Labels are separate draggable objects.
- Status stamps use three selectable styles (seal, rectangle, banner) and custom uploaded raster images mapped to a status. Stamping animates and can be reversed to active.
- Search, status/category filters, zoom, arrange, and focusable dialogs. Mobile horizontal board scrolling preserves free positions.
- Seed sample quests only on first run. Empty boards remain empty. Data saves automatically; failures are visible. Import is validated before replacement and offers confirmation.

## Constraints

No copied game imagery. Keep materials low contrast behind high contrast text. No fake interactive buttons. All major controls work with keyboard. Reduced motion respected. Uploaded PNG/JPEG/WebP images <= 2 MB are decoded and resized to <= 512 pixels; no SVG/HTML uploads.

## Validation

Meaningful model tests: status transitions, clamping, filtering, serialization and invalid import. Browser QA: create/edit, drag at scale, stamp, label, reload persistence, dialogs and narrow viewport. Independent final code review.

## Follow-up: physical interactions, drawer and photos

User explicitly requested local-only operation, then requested richer stamp animations, a corner drawer pulled open by mouse, drag-to-store quests, archive search, and photographs on quest papers.

- Fixed right-edge wooden drawer with a 44 px brass handle, pointer drag to reveal, click/keyboard toggle, escape/close, and inert contents when hidden.
- During a quest drag, a fixed paper ghost follows the pointer and the drawer opens. Only releasing over the visible receiving tray archives it. Releasing elsewhere moves the quest normally; cancellation restores its position and drawer state.
- Archived quests remain in the saved collection, retaining status, photo, coordinates, and earned XP. Board filters exclude archived quests; drawer search includes only archived quests. Restore returns the same paper to the board and front layer.
- Each paper supports one raster photo. Editor accepts PNG/JPEG/WebP <=5 MB, decodes and resizes to <=960 px as WebP. Stored raster is <=2 MiB. Existing version-1 data gets archived=false and imageDataUrl=null.
- A 650 ms wooden stamp press coordinates ink appearance, scattered ink dots, and small paper movement. Archive/restore transitions respect reduced-motion preferences.
- All data remains browser-local; no source push or deployment. Aggregate backup budget is 90 MB and is checked before applying image mutations.

## Follow-up: quiet desk and held stamp tools

The user now wants an uncluttered board, with only papers and drawers visible. Replace the dashboard shell (sidebar, hero, stats, toolbar and footer) with a full viewport wooden desk. Preserve all saved quests, labels, photos, stamps and positions.

- Two compact right corner drawer handles: archive and tools. Panels are mutually exclusive and use the existing pull gesture/click keyboard toggle.
- Tool drawer contains a physical pen button that opens quest creation and three tactile stamp buttons for done/failed/paused. Appearance style and uploaded stamps remain selectable inside the drawer.
- Picking a stamp closes the drawer and attaches a visual stamp to the pointer. Primary click anywhere on a board quest stamps that quest and retains the held tool for repeated use. Dragging/edit clicks are suppressed only while holding a stamp. Right click or Escape returns it; normal context menus work when no tool is held. Keyboard Enter/Space can stamp a focused quest; touch can return via the tools drawer.
- Other controls (search/status filters, labels, arrange, stamp library, settings/backup, zoom, save status and help) live inside collapsed drawer menus.
- No permanent toolbars or card action rows. Quest title remains an edit button; header is the drag handle.
- Validation: pure held-stamp behavior tests, existing regression suite, actual browser interaction and visual QA when available. Deliver locally only.
