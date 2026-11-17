# Quest bundles and guild atmosphere

User selected ideas 2 and4 from the immediately preceding list: multi-paper pickup as a temporary bundle, and living guild ambience. Other backlog ideas remain parked.

## Bundle behavior
- Select quests using Shift-click or a discreet checkbox on paper (keyboard accessible). Selection can include board, tray and open folio quests; reader windows themselves remain draggable documents, not bundle sources.
- Drag a selected quest's existing grip to lift all selected quests. Show a small fanned bundle (at most5 visual sheets) with actual selected count; dim all originals. One pickup/drop sound per gesture, not one per sheet.
- Drop into a folio or storage tray together; drop on the desk as a small offset stack. Preserve quest content/status and saved rotations. Commit all location changes atomically to latest app state and persist once.
- Cancellation, Escape, blur and pointer cancellation restore originals and positions without writes. Invalid targets/data make no partial change. One selected quest keeps existing single-drag behavior.
- Show a clear count/clear-selection affordance only while selected. Do not select from interactive writing fields or block the new paper reader controls.

## Atmosphere behavior
- Subtle window-light bands, warm night light pools and a small bounded dust layer, all decorative and pointer-events:none. No overlay may block dragging, inputs or modals.
- Lighting auto/day/night/off, dust toggle, rain and distant tavern ambience toggles, ambient volume. Controls live in the existing folded tool menu. Settings persist locally under a separate key; backup schema is unchanged.
- New sound layers default off, start only after user interaction, fade when toggled and respect global sound mute. Hidden tabs stop ambience/dust; returning resumes only requested layers. Reduced motion stops dust/flicker; static light remains readable.
- Use bundled licensed recordings for rain/tavern with provenance; no runtime streaming/account/network requirement. If unavailable, report exact limitation, not a synthesized voice described as a recording.

## Architecture/interfaces
`createQuestBundles({document,window,getState,commit,renderQuest,getDropTarget,onAssist,onTarget,onCue,isBlocked,onStart,onEnd,reducedMotion})` from dist/quest-bundles.mjs; returns `{refresh(),clear(),toggle(id),selectedIds getter,dragging getter,destroy()}`. Root renderQuest adds button[data-bundle-select=id]; controller owns selection DOM painting and captured pointer/keyboard handlers. getDropTarget(event,ids) returns null or `{type:'folder',id,element}` / `{type:'tray',origin:{left,top},scale:.62}` / `{type:'board',origin:{left,top},scale,bounds:{width,height}}`. onAssist(event) opens existing storage handle; onTarget(target) paints receiver; onStart/onEnd manage original drawer state; isBlocked yields to single drag, stamp, native forms and window gestures. Agent may refine options minimally and report exact API.

`createDeskAtmosphere({document,window,storage,now,reducedMotion,onAudioChange})` from dist/atmosphere.mjs; `{mount(parent=document.body),mountControls(container),getSettings(),setSettings(patch),destroy()}`. Settings `{lighting:'auto'|'day'|'night'|'off',dust:boolean,rain:boolean,tavern:boolean,volume:number[0,1]}`; defaults auto,true,false,false,.3. onAudioChange receives settings. It owns overlays, controls and local settings only.

`createGuildAmbience({document,window,...optional test seams})` from dist/ambience.mjs; `{setSettings({rain,tavern,volume}),unlock(),setMuted(boolean),destroy()}`. Audio module owns gesture-unlock, voice lifecycle, loaded local assets and hidden-page suspension. Root forwards atmosphere settings, global mute and first gesture unlock.

## Constraints
Existing local ES-module app, no npm dependencies or deployment; no reads/writes to real user quest storage. No backup schema changes. Existing managed local-origin browser deny remains; synthetic DOM, temporary HTTP and audio signal checks allowed. No Git repository. Preserve individual drag/folio/reader save behavior.
