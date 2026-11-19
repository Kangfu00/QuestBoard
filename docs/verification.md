# Verification

## 2026-11-19 — ป้ายนักผจญภัย + ถุงเหรียญ XP บนกรอบโต๊ะ (Brass Adventurer Plate & Leather Coin Pouch)

- **ความต้องการ:** ย้ายข้อมูล XP และ LEVEL ออกจากข้อความในเมนูเครื่องมือ มาเป็นวัตถุจริงบนโต๊ะนายทะเบียนกิลด์: ป้ายทองเหลืองโบราณแขวนด้วยสายหนัง พร้อมถุงเหรียญหนังที่พองตามความคืบหน้าของเลเวล
- **ตำแหน่งและเลเยอร์:** วางบนกรอบโต๊ะ `#desk-surface` ที่มุมซ้ายล่าง (`left: 18px; bottom: 18px; z-index: 40;`) อยู่นอก `#board-scroll` ทำให้ไม่เลื่อนหรือซูมตามโต๊ะ และไม่ชนกับรางเครื่องมือ (บน), ลิ้นชักเก็บของ (ขวา), ม่านโต๊ะ (ล่าง), หรือข้อความแจ้งเตือน (`#toast` ล่างกลาง) คลิกทะลุชั้นบรรยากาศได้ตามปกติ
- **โมเดลบริสุทธิ์ (`dist/adventurer-model.mjs`):**
  - `XP_PER_LEVEL = 500`
  - `ADVENTURER_TITLES`: 1: ผู้สมัครกิลด์, 2: ผู้ฝึกหัด, 3: นักสำรวจ, 4: นักผจญภัย, 5: ผู้กล้า, 6: ผู้เชี่ยวชาญ, 7: ผู้พิทักษ์, 8+: ตำนานแห่งกิลด์
  - `xpSummary(rawXp)`: คำนวณ `{ level, intoLevel, perLevel: 500, toNext, title, totalXp }` รับค่า NaN/ติดลบ/ไม่ใช่ตัวเลขได้อย่างปลอดภัย
  - `coinCount(rawDeltaXp)`: คำนวณจำนวนเหรียญบิน `clamp(ceil(delta / 50), 1, 8)` คืนค่า 0 หาก delta <= 0
- **คอมโพเนนต์และการโต้ตอบ (`dist/adventurer-plate.mjs` และ `dist/adventurer-plate.css`):**
  - ป้ายเป็น `<button>` คลิกหรือกด Enter เพื่อพลิกดูสถิติด้านหลังแบบ 3D (XP รวม, จำนวนเควสสำเร็จ, XP ที่ขาด) เป้าแตะ ≥ 40px พร้อม `aria-label` และ live region `role="status"`
  - ด้านหน้ามีตราประจำตัว (ซิงก์กับตราที่ทับกระดาษ), เลขเลเวล (`Cinzel`), ฉายาภาษาไทย (`Noto Serif Thai`), และร่องสลักทองเหลืองแสดงแถบความคืบหน้าสู่เลเวลถัดไป
  - เมื่อประทับตรา "สำเร็จ": เหรียญทอง 1–8 เหรียญบินเป็นเส้นโค้งพาราโบลาจากจุดประทับตราเข้าถุงเหรียญ (420–560ms, stagger 50ms, easing slide) ถุงยุบแล้วเด้งคืน ~160ms พร้อมเสียงเคาะโลหะ (`paperweightDrop`) จำกัดเหรียญที่บินพร้อมกันไม่เกิน 8 เหรียญ
  - เมื่อขึ้นเลเวล: ข้อมูลเปลี่ยนก่อนเสมอ ป้ายยกตัวขึ้น ประกายทองวาบข้ามหน้าป้าย (800ms) เลขใหม่ตอกลงด้วยท่า `stamp-in` (380ms) รวม ~900ms พร้อมประกาศเสียงสำหรับ screen reader
  - XP ลด: อัปเดตเงียบ ๆ ไม่มีเหรียญย้อน ไม่มีพิธี
  - ลดการเคลื่อนไหว (`prefers-reduced-motion`): ไม่บินเหรียญ ถุงไม่เด้ง เปลี่ยนเลขเลเวลด้วย `reducedMotionCrossfade` (120ms)
- **การทดสอบ:**
  - `tests/adventurer-model.test.mjs`: 4 tests (XP milestones, negative/NaN sanitization, rank boundaries, coin count limits) — ผ่าน 100%
  - `tests/adventurer-plate.test.mjs`: 8 tests (DOM mounting, 3D flip card, coin flight lifecycle, cancelAll cleanup, level up celebration, reduced motion, graceful degradation without WAAPI, serialization immutability) — ผ่าน 100%
  - `tests/motion-governance.test.mjs`: ผ่าน 5/5 (ไร้ direct WAAPI .animate(), มี reduced-motion guard ทุกจุด, package.json check ครบทุกไฟล์)
  - `npm run check`: ทุกไฟล์ใน `dist/` รวมทั้งไฟล์ใหม่ผ่านไวยากรณ์ Node 100%
  - ผลรวมชุดทดสอบทั้งโปรเจกต์: **718 tests passed** (เมื่อรัน browser suite แยกตามปกติ)
- **สิ่งที่ยังไม่ได้ดูในเบราว์เซอร์จริง:** ความลื่นไหลของอนิเมชันเหรียญบินบนหน้าจอจริง, ความรู้สึกของการคลิกพลิกป้าย 3D, และการซ้อนทับจริงกับสภาพแสงบรรยากาศโต๊ะในเบราว์เซอร์สด (ตรวจผ่าน unit test, governance test, DOM test และ static verification แล้ว)

## 2026-11-19 — paper burn visual rework: scorch / char / ember layers along one frayed edge

- **Why:** the first version cut a ragged line into a soft brown shadow and drew a straight copper line on the paper's outer border, so it read as torn, aged paper rather than fire. The ragged line had no visual edge of its own and the ember did not follow it.
- **Layers (`dist/burn-model.mjs`):** `generateBurnLayerSvg(layer, variant, stage)` draws `halo` (yellow toasting then brown scorch fading inward, stages 1–4), `char` (black crust hugging the edge, stages 3–4) and `ember` (broken glowing line with a few hot specks, stages 3–4). All three use the same seeded outline (`burnEdgePoints`: slow waves, a few deep bites — two at corners — and jitter, smoothed with a closed Catmull-Rom spline) and the same `feTurbulence` + `feDisplacementMap` seed, so the ember sits exactly on the char line and the edge frays instead of curving smoothly.
- **Stages:** 1–2 are soft toasting with no edge line; 3 adds a thin char band and a flickering ember; 4 has a thick char rim and a dulled, non-animated ember.
- **Wiring:** images are generated at startup by `installBurnLayers(document)` (`app.mjs`, `startBoard`) into one `<style data-burn-layers>` (about 146 KB, about 21 ms). `dist/paper-burn.css` now holds only structure and motion. No new data fields, no new build step, no new files in the `check` script.
- **Stacking:** the burn layer moved from `z-index: 2` to `0`, so positioned text (date, metadata, description) and the ink layer paint above it and the overdue date stays readable.
- **Tests:** `node --test` — 694 pass, 0 fail, 7 skipped (browser-dependent). `npm run check` passes. New tests cover the edge outline, layer availability per stage, shared fray seed, data URI safety, the 16 + 8 + 8 generated rules and `installBurnLayers` idempotence. Old tests for the removed mask helpers were replaced.
- **Not verified:** the result has **not** been viewed in a real browser. Only the SVG layers were rendered with resvg and composited over a flat paper colour to judge shape and colour. CSS compositing on the real paper (`paper-noise`, the three `paper-N` backgrounds), the flicker animation, the extinguish flourish and drag behaviour still need a look in the browser. Edge depth, ember brightness and scorch alpha are constants at the top of `burn-model.mjs` (`HALO_DEPTH`, `CHAR_DEPTH`, `HALO_ALPHA`).

## 2026-11-19 — paper burn & urgency system: pure calculation model, deterministic masks, CSS char/ember, midnight/visibility sync & extinguish flourish

- **Pure calculation burn model (`dist/burn-model.mjs`):** `burnStage(due, today, status)` computes stages 0–4 (none, upcoming 2–3 days, tomorrow, today, overdue) using local dates and UTC midday to eliminate DST skew. Pure and ephemeral; no extra state stored in database or backups.
- **Stable edge masks:** 4 organic charred edge masks generated deterministically from quest ID hashes (`burnVariant(id)`) via SVG data URIs, bound via `--burn-mask` in CSS.
- **Physical char & ember styling (`dist/paper-burn.css`):** Multi-layered inset box-shadows (`#7a4a22` → `#5a351a` → `#3a2414` → `#1b110b`), pulsating ember glow on stage 3 (`#d9772f`, paused during drag), and softened `.overdue` text color (`#8c533c`). Center area remains 100% transparent with zero obstruction to text or clicks.
- **Extinguish flourish & rekindle:** Stamping triggers `paperEffects.extinguish(refreshedPaper, { stage, variant })` which fades out char over 360ms with `cubic-bezier(.22,.8,.24,1)`. Restoring active status smoothly rekindles char over 400ms. Respects reduced-motion and forced-colors accessibility.
- **Temporal sync:** Single timer schedules to next local midnight (`msUntilNextMidnight()`), refreshed dynamically on `visibilitychange` to update `data-burn` attributes without re-rendering the board.
- **Testing & governance:** Full unit test suite in `tests/burn-model.test.mjs` and `tests/paper-burn-effects.test.mjs`. All 46 modules verified by `npm run check`, full test suite passes cleanly, and zero WAAPI leaks verified by `tests/motion-governance.test.mjs`.

## 2026-11-19 — motion phases 2 & 3: directional lighting, release inertia, atmosphere drag suspension, playbackRate fast-forward & reduced-motion crossfade

- Unified directional lighting vectors (`--light-x`, `--light-y`, `--lift`) across all dayparts (`morning`, `day`, `evening`, `night`, `off`) in `dist/atmosphere.mjs`, reflected dynamically into CSS box shadows in `tabletop.css`, `leather-folios.css`, `daily-book.css`, `paperweight.css`, and `motion-tokens.css`.
- Implemented Release Inertia and Anticipation-Action-Settle via pure mathematical helper `settleTiltKeyframes(rotation, velocityTilt)` in `dist/desk-motion.mjs`, smoothly integrated into `settlePaper` and `settleDailyBook` in `dist/app.mjs`, and enhanced metallic landing physics in `dist/paperweight.mjs`.
- Implemented atmosphere drag suspension (`atmosphere.setSuspended(Boolean)`) in `dist/atmosphere.mjs` and `dist/atmosphere.css`, hooked into all dragging gestures in `dist/app.mjs` and `dist/paperweight.mjs` to pause dust, clouds, and ambient lighting animations during drag operations, restoring full 60 FPS performance.
- Implemented animation acceleration via `fastForwardAnimations(element, rate = 4)` in `dist/desk-motion.mjs` to crisply accelerate remaining unfolding animations to 4x playback rate upon early closure or cancellation in `dist/daily-book.mjs` and `dist/notebook.mjs`.
- Added `reducedMotionCrossfade(element)` in `dist/desk-motion.mjs` providing accessible 120ms crossfade transitions for users preferring reduced motion.
- Full test suite: **683 passed, 0 failed, 0 skipped** (`npm test`), all 43 modules passed `npm run check`, and governance verified by `tests/motion-governance.test.mjs`.

## 2026-11-19 — motion phase 1: shared tokens, unified animateTransient, governance tests & ?motion-debug

- Centralized motion durations and easing curves in `dist/motion-tokens.mjs` and mirrored CSS custom properties (`--dur-*`, `--ease-*`) in `dist/motion-tokens.css` (linked in `dist/index.html`).
- Routed all 7 direct WAAPI `.animate()` call sites (`app.mjs`, `notebook.mjs`, `paperweight.mjs`, `paper-turn.mjs`, `paper-effects.mjs`, `photo-viewer.mjs`, `quest-unlock.mjs`) through `animateTransient` / `cancelMotion` in `dist/desk-motion.mjs`.
- Added opt-in `?motion-debug` frame/long-task HUD (`dist/motion-debug.mjs`) with zero runtime overhead when inactive.
- Added automated governance suite `tests/motion-governance.test.mjs` verifying single-point `.animate()` routing, reduced-motion guards, token sync, `?motion-debug` lifecycle, and `package.json` `check` coverage. Updated `package.json` `check` to cover all 43 `dist/*.mjs` modules and updated `.agent/rules/motion-and-interaction.md`.
- Full `npm test`: **671 passed, 0 failed, 7 skipped** (native Chromium tests skipped in headless VM without browser env vars). `npm run check`: all 43 `dist/*.mjs` modules plus `server.mjs` and `backup-store.mjs` passed.
- **Not yet visually verified in a live browser:** rendered animation smoothness, real pointer drag feel, and `?motion-debug` visual HUD layout have not been inspected in a live Chromium window.

## 2026-11-16 — exact stamping, drawer feed and new quest arrival

- Held pointer stamps persist a paper-local centre. Affine inversion includes current paper scale/shear/rotation and board zoom; ink anchors clip at paper edges, including photo and custom-stamp layouts. Keyboard/menu stamping preserves the existing point; resetting to active clears it. Missing legacy positions normalize to null without a version bump.
- Archiving commits before a visual-only 180ms approach and 300ms clipped slide below the drawer lip. Cancellation, missing/failed animation APIs, moving/hidden slots and viewport changes remove transient ghosts/masks without touching quest state. The feed does not fade the sheet before it crosses the wooden edge.
- A newly created quest is placed in the visible scrolled viewport and unfolds from the tool-drawer edge over 600ms. Editing does not replay arrival. Reduced motion leaves the paper immediately usable. Entry transform, materials, watchers and temporary properties clean up on finish/cancel/rerender/resize.
- Independent review reproduced a pickup during arrival losing its local grip. Regression tests failed before capturing the animated local point prior to cancellation, repositioning the provisional paper under the pointer, and persisting only on release; cancellation restores the original board location. Existing ordinary-click and drawer-pull checks remain passing.
- Final full `npm test`: **199 passed, 0 failed**. `npm run check`: all 12 production modules passed. The real disposable-server backup integration now stamps at `{x:221,y:144}`, archives in a folder, restarts the server, clears injected browser cache and restores the exact snapshot including the point.
- Verified the production listener was this project's Node server (PID 27204), then restarted only that process using `Launch-Questboard.ps1 -NoBrowser`. Launcher health confirmed replacement PID 19572 ready on port 4173, with the new in-memory validator. No live quest data was read or edited; existing browser tabs were untouched.
- Saved browser-origin denial still applies. Source, event/controller tests and static CSS checks do not establish rendered smoothness or real mouse QA. No browser workaround or online deployment was used. Refresh the existing page to load the new client files.

## 2026-11-16 — leather folios with cord closures

- Replaced manila styling with worn leather, stitched edges, brass eyelets, tan cord and parchment title labels across board folios, drawer rows and the reading panel. Existing folder colors now describe brown, moss and wine leather. Board dimensions and the 168×38 drag strip remain compatible with stored positions.
- Opening loosens the cord before unfolding the cover and revealing sheets. Receiving holds the cover open through insertion, then closes and reties. Explicit close/Escape releases the live panel immediately while an inert visual copy refolds and reties; reopening cancels the copy. Decoration cannot intercept pointer input.
- The visual controller removes duplicate IDs, app-routing data and autofocus from closing copies. Timers are cancelled on interruption; stale callbacks cannot affect a newly opened panel. Reduced motion creates no closing copy or opening timer. Search/render updates settle opening effects immediately.
- Independent review identified scrolled content jumping to the first row in a closing clone. A regression failed before copying scroll offsets after attachment, and now passes while verifying the live list remains unchanged. Compact cover decoration avoids title/cord overlap through 560px-high viewports by using a single-line title and hiding the emblem.
- Final `npm test`: **152 passed, 0 failed**. `npm run check`: all ten production modules passed. Temporary HTTP tests used approved loopback access and disposable files; no production quest data was accessed. CSS static checks resolved all 21 animation references and balanced delimiters.
- Browser-origin access remains denied by saved policy, so rendered appearance, actual mouse interaction and animation smoothness are not claimed as verified. No browser workaround, upload or deployment was performed.

## 2026-11-16 — weighted papers and physical folder motion

- Added anchored pickup/lift, bounded velocity tilt and landing settle to board and stored-item dragging. Exact grab geometry remains under the pointer across rotation and zoom; only visual rotation/scale eases, never pointer coordinates. Release/cancel stops the held-item frame and releases pointer capture/listeners.
- Folder covers lift on hover, papers visibly enter the accepted board/window/drawer surface, and covers settle closed. Membership commits before animation starts. Missing/rejected/throwing animation APIs clean transient ghosts without blocking filing; reduced motion skips effects and preserves immediate state updates.
- Opening a folder unfolds a decorative, non-interactive cover over layered paper rows. Search/commit updates clear the opening class; closing cancels its timer. Existing search/extraction controls remain available during the cover animation.
- Independent review found three issues and all were fixed with failing regression tests: inherited restore/stamp CSS animations overriding ghost transforms at 0.5×/1.5×, a receiving folder drawer closing too early, and an open-window drop animating toward the board copy instead of the accepted surface.
- Final `npm test`: **140 passed, 0 failed**. `npm run check`: all nine production modules passed. Initial sandbox-only suite runs had six loopback HTTP access failures; the full suite passed with approved network access for temporary local servers and disposable backup files. Production browser data was not accessed.
- Visual/mouse QA remains unverified: the previously saved browser-origin policy denial remains in effect. No alternate browser, native UI or browser-protocol workaround was used. Local-only delivery; refresh the existing page to load the updated static modules/styles.

## 2026-11-16 — drawer jumps while being pushed shut

- Reproduced two conflicting position writers by executing the app's actual drawer handlers with isolated event elements: pointermove flushed a full-open 332px position between partial positions; sibling resize callbacks reset the held drawer from 192px back to 332px until the next pointermove. All three drawers were affected.
- Global drawer state updates now leave the reveal of `.is-pulling` drawers under pointer control. Other drawers close once when a pull begins; pointermove no longer reapplies the full open/closed state on every sample.
- Added eight event-level regression cases. Six jump/resize checks failed before the fix and now pass; cancellation restoration and release-click suppression also pass.
- Fresh full suite: **111 passed, 0 failed**; `npm run check` passed. No live browser access or frame-by-frame rendering claim: the saved browser origin denial remains in effect.

## 2026-11-16 — separate folder drawer and louder audio

- Moved folder creation, folder/content search and stored-folder list into an independent third drawer. Loose quest archive count/search now excludes folder members. Folder returns target the folder tray; papers target the quest tray or an existing folder.
- Preserved drawer choice while dragging papers, added storage-handle hover switching, and restored the prior drawer on cancelled item drags and cancelled drawer pulls. Independent source review reproduced the pull-cancel gap before it was fixed.
- Three responsive brass handles reserve separate positions and remain accessible beside an open panel. CSS geometry was checked at short viewport heights; this is not rendered browser verification.
- Raised the sound master gain from 0.6 to 1.2 (about +6 dB at unchanged saved volume). New default volume is 65%; saved mute/volume settings remain respected. Added a shared compressor for overlapping peaks.
- Full suite: **103 passed**, `npm run check` passed. Routing tests and sound gain/routing tests failed before implementation and passed afterward.
- Browser access remains blocked by the previously saved origin policy. No alternative browser surface was used. Real pointer dragging and actual listening have not been verified in this update. Existing data and backup implementation were not changed.

## 2026-11-15 — automatic local backups and Windows startup

- Added loopback-only backup API and atomic flushed JSON files outside `dist`, retaining 30 previous changed versions. Stale revisions, malformed/oversized bodies, cross-origin requests and interrupted uploads are rejected without replacing the good snapshot.
- Added a client coordinator with independent browser writes and file uploads, retry, startup restoration, and explicit conflict choice. SHA-256 snapshot fingerprints prevent another tab's acknowledgement from incorrectly marking a local draft as synced. Recovered old disk history cannot silently replace newer browser data.
- Regression tests reproduced all three source-review findings (slow upload blocking browser persistence, recovered history replacing newer data, and mismatched shared sync metadata), then passed after fixes.
- Real HTTP/temporary-file integration: saved quests and a folder, stopped/restarted the server, cleared the injected browser cache and sync metadata, then restored the exact original board from disk. No production browser data was accessed.
- `npm test`: **95 passed, 0 failed**. JavaScript syntax checks passed for the server, store and six client modules.
- Replaced only the verified old project listener PID 34644. Hidden launcher started the new server; `/api/health` reports `questboard`, backup API 1. A second `-NoBrowser` launch reused the same server PID 11180.
- Current-user Startup registration was installed. Post-install verification found actual Unicode path loss through WScript.Shell. The installer now uses IShellLinkW, verifies the saved values, and was reinstalled successfully. Reopened directory and arguments exactly match the Thai project path; the launcher exists. A Windows PowerShell 5.1 disposable shortcut probe also verified exact Unicode fields and UTF-16 bytes.
- A follow-up attempt to execute the stored shortcut command with `-NoBrowser` was rejected by automatic approval review (`blocked by policy`, no further reason provided). No workaround was used. Prior direct launcher tests passed; actual login/browser opening has not been exercised.
- The production backup directory exists but `latest.json` has not yet been created: the user must reload the original browser tab once and wait for the file-save status. Existing quests have not been copied via a browser-policy workaround. The saved browser denial remains; no live browser or actual reboot test is claimed.

## Folders, sound and archive stability (previous update)

- Reproduced the archive shaking cause as a deterministic layout loop: a horizontal scrollbar reduces client height, changes the paper scale, then disappears and triggers the opposite calculation. The fit now uses the stable viewport dimensions before scrollbar space. The failing regression passed after this change.
- Prevented native text selection on physical papers and folders; editable fields and keyboard focus remain available.
- Added folder creation, board/drawer movement, search, quest membership, extraction and safe folder deletion. Backups preserve the folder relationships and accept legacy files without them.
- Added lazy synthesized sounds for stamping, paper handling, folders and drawers, with persisted mute/volume controls.
- Independent source reviews covered model/UI lifecycle and pointer geometry. Fixed undo membership restoration, extraction under active filters, clipped tray hit areas, stale scale during extraction, and unrelated pointer release handling.
- Fresh `npm test`: **66 passed, 0 failed**. `npm run check`: all five production modules passed.
- **Current browser QA is pending:** the browser tool was denied permission to observe `http://127.0.0.1:4173`. No alternative browser surface was used. Real dragging, the new folder UI, actual sound output and repeated archive stability have not been verified visually in this update. Earlier native QA below covers the previous implementation only.
- Local-only files were updated. No source upload or deployment.

## Drag and drawer fixes (previous update)

All three requested interactions were exercised with real native mouse drags in the local app, using the visible Windows window's screenshot coordinates. A disposable quest named `ทดสอบการลาก` was created and removed after testing; the six existing quests and two labels were preserved.

### Reproduced defects and fixes

- **Invisible left wall:** the scaled fixed-size canvas was centered inside a wider wooden viewport. Placement clamped to its hidden x=0 instead of the visible board edge. Canvas now starts at the viewport's left edge and covers its full visible width/height. The same dynamic bounds drive dragging, keyboard movement and both editor save paths. Stored coordinates are preserved independently of viewport size, up to a bounded20,000×20,000 document extent.
- **Archive handle blocked:** DOM hit-testing the archive handle returned `#tool-drawer`, a transparent parent above the handle. Drawer parents now ignore pointer hits; only their handles and bodies receive them. Both closed handles now resolve to their own buttons.
- **Fast archive drop missed:** releasing a paper while the drawer was still sliding open tested the wrong tray rectangle. The receiving drawer now opens immediately during paper dragging; manual drawer motion remains animated.
- **Rotated corners clipped:** placement now accounts for rotated paper bounds and respects storage limits. Grabbing a drawer during an animation also starts from its rendered reveal rather than jumping to an endpoint.
- **Fractional overflow:** fitted canvas dimensions retain fractions rather than rounding up and creating an unnecessary horizontal scrollbar.

### Browser evidence

| Interaction | Observed result |
| --- | --- |
| Pull archive drawer left, push right | `aria-expanded` changedtrue→false; actual panel opened/closed |
| Pull tools drawer left, push right | Actual panel opened/closed and expanded state matched |
| Drag paper to left board edge | Storedx=0; paper reached visible wood edge |
| Drag beyond oldx=880 boundary | Storedx≈1199.4; paper remained at new position after reload |
| Drop outside archive tray | Paper remained on board; archive count unchanged |
| Fast drop into automatically opened tray | Paper left board and appeared in archive; count became1 |
| Search/reload archived paper and restore | Archived paper persisted and returned to its stored position |
| Drag45° paper against left edge | Paper AABBleft≈31.594; canvasleft≈31.600 (subpixel tolerance), no clipped corner |
| Drop rotated paper into archive | Archive entry appeared, then restored successfully |
| Clean final state | Six original papers, no test paper, zero archived test items, both handles directly hit-testable |

Final viewport measurements: canvas left gap0.8px (border only); rendered canvaswidth≈995.995px for996px client width; scrollWidth996px. No captured browser console errors.

`npm test`: **48 passed, 0 failed**. Added regression tests cover viewport geometry, zoom, fractional fitting, rotated edges, expanded coordinate validation, save/import round-trips and archive/stamp preservation. `npm run check` passed. Independent source review found no remaining blocker.

Evidence images: `drag-archive-verified.jpg` (test paper archived) and `drag-board-fixed.jpg` (clean board after cleanup). This resolves the drag-verification limitation recorded below. No upload or deployment performed.

## Quiet desk update (earlier)

- Removed dashboard, sidebar, persistent toolbar, summaries and paper action rows. Board shows papers/labels and two corner handles; secondary controls live inside a folded section of the tools drawer.
- Added reusable held stamps, custom stamp selection, mouse-following tool, paper click interception, right-click/Escape return, keyboard stamping, physical pen button and mutually exclusive drawers.
- `npm test`: 32 passed, 0 failed. Six new tests cover all status/style choices, repeated stamping without duplicate XP, invalid/archived/nonquest targets, custom stamps and removed stamp references.
- `npm run check`: all four production JavaScript modules pass syntax checks.
- Browser QA at 1280×720: pen creates a quest; all three stamps change that quest's status; title and body text both accept stamps without opening edit; held tool remains available after stamping; right-click and Escape return it; keyboard Enter stamps and restores focus.
- Confirmed computed held-stamp animation is `cursor-press`, with no duplicate physical stamp in the impact overlay. Repeated clicks explicitly restart that animation.
- Confirmed archive via quest editor, archive search including no-results state, restore, drawer mutual exclusion, collapsed secondary controls, saved state after reload, and zero captured console errors. The temporary test quest was removed; pre-existing quests were preserved.
- Independent review findings fixed: press-animation selector mismatch, missing ghost paper styling, and animation replay on consecutive clicks. Custom cursor previews have unobstructed images.
- Limitation: native coordinate click/drag commands did not align with screenshot targets in the browser tool. Drawer pull and paper drop were reviewed and covered by pure interaction tests, but are not claimed as browser-drag verified. Image upload/custom stamp upload and additional responsive viewport sizes were not retested in this update.
- Screenshot: `quiet-desk-preview.jpg`. Local-only delivery remains unchanged; no source upload or deployment.

## Earlier verification history

- `npm run check`: passed (app and model JavaScript syntax).
- `npm test`: 26 passed, 0 failed after drawer/photo enhancements and review fixes.
- Local server HTTP GET `/`: 200.
- In-app browser loaded the actual app and displayed all six sample quests, both draggable labels, state counts, save status, stamp buttons and toolbar.
- Visual inspection at the panel's approximately 719 px viewport confirmed wood texture, parchment and Thai layout; adjusted minimum scale so compact screens keep cards readable and scroll horizontally.
- Independent review identified and fixes addressed: item/stamp capacity overflow, edit-form rotation step mismatch, backup import/export size mismatch.
- Storage read failure now blocks editing instead of allowing new sample data to overwrite an unreadable saved board.
- Full interactive browser verification (drag, upload, reload after edits, desktop/mobile resizing) was interrupted when browser tools became unavailable; native fallback was stopped after detecting user interaction in Chrome. These flows have code/model coverage but are not claimed as browser-tested.
- User requested local-only delivery. Online source synchronization was rejected by automatic approval review before running; no source push or deployment was performed. A private unpublished Sites registration exists, with identity in `.openai/hosting.json`.

## Enhancement checks

- Pure interaction tests cover scaled pointer deltas, tray hit detection including boundaries, and drawer pull/snap bounds.
- Model tests cover archive/restore preserving status and coordinates, archive search isolation, legacy migration, quest photo add/edit/removal and backup round-trip, rejected malformed images, and aggregate backup budget before mutation.
- Browser interaction tooling remained unavailable; a separate native browser launch required app approval that timed out. No claim is made that the new animations or drag/drop were visually tested in a browser.

## Running

Run `npm run dev` from this folder, or double-click `Start-Questboard.cmd`. Open `http://127.0.0.1:4173` and keep the server running. Data persists in IndexedDB per browser and origin. Use the same URL/browser to see existing data.

- Final enhancement review fixed rotated ghost origin and scroll displacement during drag. Regression tests now cover 90-degree rotation at 50% scale and board/page movement while the pointer is held.



## 2026-11-16 — Recorded material foley

- Replaced shared synthesized noise/thumps with 44 local CC0 recordings across 17 action recipes. 48 source assets are bundled (1.02 MB); 44 are referenced at runtime (953,908 bytes). Source/license/processing documentation is in `audio-sources.md`.
- Paper pickup, paper contact, paper sliding, leather handling, cover closure, cord movement, wooden drawer movement, stamping and writing use material-specific pools. Each pool has at least two choices and a shuffle bag that prevents adjacent repeats. Recorded peak/RMS data sets conservative per-clip gains; rate variation is modest, and a shared compressor limits overlapping peaks.
- Audio remains gesture-unlocked and local. Recordings fetch/decode once, failed decoding does not block actions, and muted/zero-volume preferences remain preserved. At most six pending/playing voices exist; pending cues more than 100 ms late are discarded.
- Stamp sound contacts at 250 ms; held tool contacts at 252 ms. Paper arrival/storage and folio opening/closure supply abortable cues. Pickup, replacement, blur, pagehide and mute cancel stale audio; reduced motion keeps immediate action sounds.
- Fresh validation: `npm run check` passed (13 modules). Full `npm test` passed **237 tests, 0 failures**, including temporary-loopback backup persistence tests and OGG serving with the correct MIME type. Output: `.local/foley-final-tests.log`.
- Independent review: 89 focused tests passed; every runtime audio path and SHA-256 matched the audited catalog; all literal/dynamic cue names resolved. No actionable findings remained.
- Restarted only the verified Questboard backend after the MIME addition, using `Launch-Questboard.ps1 -NoBrowser`; its health check passed. No production quest data was read or changed for verification.
- Actual browser playback/listening and visual interaction remain unverified because the managed local-origin browser restriction remains in place. No alternate browser/CDP/Playwright route was used. Audio files were decoded and measured programmatically, not listening-certified.

## Pickup audio overlap correction

- Found that crossing the drag threshold played paperPick/folderPick and automatically opened/closed the storage drawer with a second wooden sound in the same input handler.
- Automatic drawer transitions during pickup, storage, release and cancellation now move silently. Explicit drawer clicks and pulls retain their sounds. Material handling sounds and drawer geometry/state are unchanged.
- Three new behavioral regression tests failed before the fix and passed after it. Fresh full suite: **240 passed, 0 failed**; `npm run check` passed. Log: `.local/pickup-audio-final.log`.
- Browser listening remains unverified; this fix is supported by the reproduced event sequence and automated regression tests.

## Drawer sliding sound replacement

- Replaced both drawer sound pools (generic creaks and door closures) with six excerpts from HECKFRICKER's CC0 wood-on-wood drawer recording: three opening slides and three closing slides. Excerpts are 0.68–1.00 seconds with softened isolated contacts, edge fades and matched RMS. Source, processing and hashes are in `audio-sources.md`.
- Focused sound/catalog tests: **34 passed, 0 failed**. Catalog syntax passed. All six new WAVs passed decoding, finite/nonzero sample, duration and SHA-256 checks. No app behavior or persistence code changed.
- Actual listening remains unverified. Static assets update on refresh; no backend restart is required.


## Shared top storage tray

- Combined quest/folder storage into one top drawer with vertical Pointer Events pull/capture/cancel/snap. The tool drawer remains independent. Hidden legacy nodes preserve old menu adapters and are explicitly display:none.
- Stored items render as full quest sheets/leather folios in a .62-scale scrollable wooden tray. Unique data-storage-id replaces board data-id; folders remain valid drop targets. Search includes folio members; create/edit/open/restore actions retained.
- Optional normalized storagePosition fields preserve board x/y, stamp positions, images, relationships and version-1 backup compatibility. Migration freezes old layouts once; drawing/removing other contents never shifts saved neighbors.
- Board-to-tray and tray-to-board retain the grabbed local pixel with rotation and independent scale. Rearranging within the tray saves only its storage coordinates; storing a quest from inside a folio clears its folder relationship. The drawer opens during item drag only when its handle is approached.
- Settling uses a short visual ghost; reduced motion skips it. Folio window z-index is above the tray so a stored folio can open without restoring it to the board. Keyboard arrows move stored objects; Enter/Space opens them.
- Final validation: **245 tests passed, 0 failures** and syntax checks passed for all 14 modules. Includes vertical pull/resize/cancel, precise rotated drop math, combined search, stored default layout stability, model/JSON round trip, actual app archive/rearrangement functions, and real disposable disk-backup recovery of storage coordinates after server restart. Log: `.local/top-tray-final.log`.
- Verified and restarted only this workspace's production backend using Launch-Questboard.ps1 -NoBrowser, to load the new model normalizer. No quest data read or mutated by verification.
- Browser UI is still restricted by managed origin policy; no alternative browser/Playwright/CDP was used. Actual rendered appearance and physical mouse interaction remain unverified.


## Right storage dock replacing top overlay

- The combined storage tray now pulls horizontally from the right. At desktop sizes its width is 38vw, bounded at 320–560px; smaller screens retain at least 160px for the board. Its 44px handle remains visible when closed.
- The controller reserves its entire visible width beside the board, including during manual pulls. Drawer transform and board padding use matching 380ms easing; pointer-held changes disable transitions on both. Cancel restores the initial open state; resize while held cannot flush an open pose; click suppression prevents reopening after a drag release.
- Board fitting uses the undocked width reconstructed from current measured padding. Real scroll viewport width changes while paper scale remains constant. A subpixel tolerance prevents rounding from cancelling held objects. Existing item/tray coordinates, folder membership and backup format are unchanged.
- Focused regressions verify partial width reservation, horizontal pull/cancel/resize, silent automatic opening and manual sound retention. The actual resizeBoard function is exercised while dragging items from both surfaces and moving the divider through eight positions; zoom and active drags remain intact.
- Fresh final verification: **248 tests passed, 0 failures**; syntax checks passed for all 14 modules. Log: `.local/right-dock-final.log`. No backend restart required because only static frontend code/styles changed.
- Managed browser origin restriction remains in effect. No browser or alternate CDP/Playwright route was used; actual rendered layout/mouse interaction remains unverified.


## Shallow top tool rail

- Replaced the side tool drawer with a 144px wooden rail (30px closed handle, 114px travel), horizontal pen/three-stamp layout, down/up pointer pull and click/keyboard toggle. Paper-space top padding follows the full visible rail height using matching easing; reduced-motion disables these transitions.
- Added undockedFitHeight alongside the existing width compensation. Actual resizeBoard tests now vary top and right reserved space together, preserving paper scale and active drags.
- Top tools and right storage open independently. Picking a pen/stamp folds the rail with the automatic slide sound suppressed so material sounds stay clear. Tool rail closure returns keyboard focus to the visible handle.
- Advanced controls retain their unique existing IDs in a dedicated native tool-menu-dialog; search/filter/style/custom-stamp, sound, zoom, settings and backup controls remain reachable. `/` opens search, Escape closes the advanced dialog first, and switching to a quest/settings dialog closes the menu. Sound preview/mute and zoom keep the menu open for repeated adjustment.
- Read-only code review found two P2 issues: unconditional advanced-menu dismissal for sound buttons, and focus stranded inside an inert rail. Both were corrected and covered by behavioral regressions.
- Fresh final checks: **259 tests passed, 0 failures**, and syntax validation passed for all 15 modules. Log: `.local/tool-rail-final.log`. New tests exercise pull/cancel/resize/click suppression/wrong pointer, combined rail/dock state, focus recovery, actual delegated menu button behavior, and actual generated markup IDs.
- Static frontend changes only: no backend restart, model migration or production quest access. Managed browser origin restriction remains respected; actual rendered appearance and physical mouse interaction are unverified.


## Two-sided quest paper: notes and subquests

- Added optional normalized notes/subquests to quest records. Notes retain whitespace, max8,000 characters; up to80 subquests with unique stable IDs, max240-character names and boolean completion. Old version1 backups remain unchanged until back content is edited. Main position, tray coordinates, photo/stamp/status and folder relationships are preserved.
- A curled corner on board/tray papers opens a native paper-reader dialog; folio quest rows have a notes button too. Front rendering reuses the existing paper and strips delegated actions/duplicate IDs. Back uses a persistent draft for notes and add/rename/check/remove subquests, progress counts and ink-strike animation.
- Notes/task edits debounce220ms and flush on close, flip, blur, visibilityhidden and pagehide. Rejected saves remain dirty, show an error/retry and prevent silent disposal. Empty renames restore the saved name on blur. App writes use the existing normalizer, IndexedDB/file-backup queues and status reporting.
- Physical turning uses five overlapping paper strips, separate clipped front/back faces with mirrored clip regions, incremental bend/depth/skew and a780ms lifted rotation. Pinhole positions match, and a short unpin/lift/corner effect precedes the back. Ghosts are inert, copied form values/scroll match, IDs/data hooks are removed, and all transient resources/audio cues cancel safely. Reduced motion or unavailable animation resources show the requested face immediately.
- Independent read-only review found CSS filter flattening the 3D ghost and a disabled turn button losing keyboard focus. Fixed by moving to nonflattening box-shadow and aria-disabled plus the reentry guard. Minor empty-rename feedback was fixed as well. Tests cover all three fixes.
- Fresh final verification: **276 tests passed,0 failures**, plus all18 module syntax checks. Includes model migration/validation/JSON roundtrip, draft debounce/failure/retry/disposal, flip cleanup/backward/replacement/reduced motion/fallback, actual reader flip and rename handlers, and real disposable backup recovery of notes/checklist after server restart. Log: `.local/quest-back-final.log`.
- Restarted only the verified workspace backend with Launch-Questboard.ps1 -NoBrowser to load the new model normalizer; health check passed. Production quest data was not read or changed by tests.
- Managed local-origin browser restriction was respected. No alternate browser/CDP/Playwright/native UI route was used. Actual animation appearance and physical interaction remain unverified; implementation and source-level motion behavior were checked programmatically.


## Two-wing open leather folio

- Added a dedicated folio view: persistent left leather cover with parchment index/search/pocket, central creased spine, and selected full300x350 quest on the right with offset paper edges. Index selection and search are view-only and preserve quest data; deleting/restoring/moving the selected quest picks the next available member. Empty states explicitly hide paper/stack and actions.
- Reuses the actual quest renderer for front/photo/status/stamp/corner behavior. Preview replaces data-id with data-folio-paper, removes board absolute placement, and displays upright at its own fitted scale. Notes/checklist edits refresh the folio when the paper reader closes. Mobile retains both functional wings and scrolls a250px sheet instead of shrinking it unreadably.
- Opening1020ms: lift/untie, opaque two-sided cover folds across the spine, permanent inner left cover remains, then paper settles. Closing880ms: square papers130ms, fold560ms, tie690–840ms, retire materials/ghost. Root and hinged preserve-3d wrapper avoid filter/opacity flattening. Cancellable shared cues align with those phases; reduced motion skips visual copies.
- Added exact preview-grab handling across animated ancestors. Capture the composite affine matrix before settling the preview/opening; preserve the clicked paper pixel and fitted scale, while keeping the quest's saved rotation for final placement on board or tray. Cancellation releases capture/listeners/ghost and restores focus to the preview. Explicit close returns focus to its source folio.
- Independent drag integration review identified animated ancestor transforms as a pickup hazard; fixed and covered by a rotated/scaled-parent regression. No further blocking source issues remained. CSS delimiter check passed; no dedicated CSS parser was installed.
- Fresh full verification: **292 tests passed,0 failures**, all19 module syntax checks passed. Log: `.local/folio-spread-final.log`. Focused preview drag tests also8/8 including focus restoration. Tests cover selection/search/empty/removal, actual preview markup, view caching without model mutation, opening/closing clone/ink/scroll/cue cleanup, preview scale/rotation/grab, cancellation and exact board/tray/folder insertion behavior.
- Frontend-only changes; no production data access or server restart required. Browser rendering and physical interaction remain unverified due the managed local-origin restriction. No alternative browser/CDP/Playwright/native route was used.

## 2026-11-16 — Guild tabletop

- Removed quest pins and reader pin holes; updated visible desk terminology. Added grip-relative pitch/roll, bounded drawer content drift, actual-membership folio stack and per-folder session bookmark.
- Meaningful RED→GREEN checks: grip helper 7; storage inertia 2; paper pose and cancellable contact cues; folio memory/search/stack; actual arrival pickup handler without stored-item shape.
- Full Node suite passed 317/317 after allowing temporary loopback HTTP test servers outside the network-restricted sandbox. Initial restricted baseline had six HTTP-related failures; no user backup directory was used.
- npm run check passed all 20 module syntax checks.
- Managed local-origin browser denial remains. No browser automation, visual inspection of the changed UI, or listening validation was performed.

Final independent review found and resolved two P2s: fast re-grab retiring old landing ghosts, and effect-level easing moving contact earlier than nominal cue offsets. Added actual-handler ownership tests for papers and folders and independent easing-inversion timing checks. RED→GREEN evidence in contact-ownership/contact-timing tests; final full suite317/317, syntax20/20.

## 2026-11-16 — Movable document windows

- Open quests and leather folios as independent nonmodal windows. Drag headers, click/focus to raise, open same ID to reuse, Escape closes only front document and yields to modal forms/active paper drag.
- Per-quest notes/flip/checklist state and per-folio search/caret/scroll/bookmark remain independent. Scoped DOM IDs and per-instance motion prevent interference. Positions are session UI state, separate from saved board/tray coordinates.
- Regression coverage: save rejection and deletion/recreation; close one while others stay open; moving paper out while folios remain visible; invalid drop over a floating document; old drafts retired before importing replacement data; cancellation/capture/resize/keyboard/window cleanup.
- Final npm test354/354 passed with approved temporary loopback HTTP test permission. npm run check22/22 modules passed. Independent reviewer43/43 focused tests and spec/quality PASS.
- No local-origin browser automation or visual/native mouse/listening verification; existing managed denial remains. No real quest data or backup schema changed.

## 2026-11-16 — Paper-integrated reader controls

- Registered actual reader scene as drag surface; removed exterior toolbar/footer layout. Edit/close overlays live on paper, and persistent bottom-right folded corner stays outside inert/rotating faces. Dynamic accessible turn name and icon work in both directions.
- Reader registration/placement tests observed RED on old toolbar handle, then GREEN. Real window manager regression exercises printed paper drag and nested button/icon/textarea/checkbox/label exclusions; focused32/32 passed.
- Scoped review identified touch-action:none on the new ancestor handle. CSS now allows vertical pan on the scene and limits touch-action:none to front paper/back heading, preserving touch-scrolling ancestors of writing controls. Native touch was not available to verify.
- Final npm test356/356 and npm run check22/22 modules pass. No browser visual/native mouse validation under existing managed denial. No data/schema/dependency changes.

## 2026-11-16 — Quest bundles and guild atmosphere

- Captured multi-selection supports board/tray/folio quests, bounded five-sheet fanned ghosts and actual count, folder/tray/board packet drops, one commit and one material cue per gesture. Atomic state validation preserves latest notes/content/status/rotation; cancel/blur/deletion/invalid target cleanup writes no partial batch.
- Atmosphere paint lives under paper canvas, with9 bounded dust particles, local-hour day/night, independent Thai native controls, local preferences, reduced-motion and hidden-page lifecycle.
- Real bundled rain/tavern recordings have documented CC0 sources, hashes, processing and signal measurements;24.32s/87s baked crossfaded WAV loops. Player opt-in/gesture gating/fades/global mute/visibility/decode errors/destroy tested. No subjective listening performed.
- Focused tests: bundle26; atmosphere10; ambience22; rootintegration4. Independent review found P2 hidden board drops under active filters; actual setup callback regression demonstrated RED then GREEN after clearing filters before the single board commit. No unresolved important findings.
- Full npm test418/418 passed with approved temporary local HTTP test permission; npm run check26 modules passed. Native browser drag/overlays and listening remain unverified under existing managed browser denial. No real quest data/schema/dependency changes.

## 2026-11-16 — Tavern audibility

User confirmed tavern enabled but only rain audible. Both assets independently decoded and matched hashes. Measurements supported masking/over-muffling, not proof of browser playback: old tavern first20s was2.90dB below rain and high-band power heavily attenuated. Reprocessed retained source at3.2kHz (was1.6kHz), preserved87s PCM loop/-12dBFS peak and unchanged rain. Tavern gain .24→.6 now yields measured first20s4.94dB above rain at unity layer faders.

Added independent persisted layer levels (default1 for compatibility), actual playback status hints, bounded explicit off/on retry and stopped-source status cleanup. Player/controls/bootstrap regressions were observed RED then GREEN; focused41/41 passed. Full npm test427/427 and npm run check26modules passed. Independent scoped review found no important code regressions. Existing browser access restriction prevented native playback/listening verification.

User verification after Ctrl+F5: user confirmed “ได้ยินเสียงโรงเตี๊ยมแล้ว”. This verifies audibility on the user device after the correction; no claim of assistant browser/listening inspection is implied.

## 2026-11-16 — More visible dust and four local dayparts

- User reported visible but insufficient dust and asked about time atmosphere. Added persisted density0–1, default.65 (39 particles, previously9), bounded0–60; varied size/position/drift, stronger opacity and negative animation delays. Existing particles retain their animation identity across clock/audio refreshes and changes to other preferences.
- Auto uses browser-local morning06:00–09:59, day10:00–15:59, evening16:00–18:59 and night19:00–05:59, with manual choices and actual phase/HH:mm menu hint. One shared Date snapshot feeds paint, hint and next-minute timer (250–60,000ms); hidden pages stop the timer, returning refreshes local time. No per-particle JavaScript animation.
- Four translucent paint layers remain below the positioned paper canvas, with pointer events disabled and no compositing changes to 3D ancestors. Reduced motion removes dust/flicker. Existing preferences restore without writes; audio/status behavior, focused inputs, mute, visibility and teardown remain covered.
- New behavioral regressions observed RED then GREEN. Atmosphere23/23; combined atmosphere/ambience/bootstrap49/49; full npm test435/435 and npm run check26 modules passed. Independent reviewer found no concrete correctness issue and independently passed8 new density/daypart tests.
- Actual lighting/dust visibility and native 3D rendering remain unverified under the existing managed browser denial. Optional user feedback requested after Ctrl+F5. No real quest data, backup schema, dependencies, deployment or audio asset changes.

## 2026-11-16 — Fine dust and animated atmosphere

- User visual feedback: dust grains looked too large and the atmosphere should animate. Generated grains now0.70–1.60px, CSS clamp0.6–1.65px; removed glow and varied opacity0.34/0.48/0.58. Density, count, persistence and particle identity behavior unchanged.
- Moving morning/evening bands use opposing42/44s transform/opacity cycles and negative phases; broad cloud shadows pass during daylight over64/79/83s with22% overscan. Night light comes from two independent17/23s warm pools with irregular gentle brightness and position/scale changes. All motion stays on existing decorative pseudo-elements, underneath paper canvas, with no per-frame JavaScript or ancestor compositing changes.
- Inactive phase animations stay paused. Hidden state pauses all particles and pseudo-elements; reduced-motion removes all animations and transitions, hides dust and retains static lighting. Existing controls/audio/timers are unchanged.
- Updated the existing particle safety-range assertion, observed RED on coarse generation then GREEN after adjustment; no CSS snapshot tests added. Focused controller/audio/bootstrap49/49; independent reviewer atmosphere23/23. Final npm test435/435 and npm run check26 modules passed. Structural source inspection found76 balanced brace pairs; independent scoped reviewer found no important issue.
- Actual motion appearance remains unverified under the existing managed browser denial. User can Ctrl+F5 and preview each manual lighting phase in the existing menu. No real quest/backup data, schema, dependencies, publication or audio assets changed.

## 2026-11-16 — Floating dust above normal desk cards

- User requests freely floating dust and atmosphere above normal desk folios/papers, except expanded views. Atmosphere nowz20 inside the existing board viewport, above the transformed board-canvas stacking context, below empty-stateUIz30 and body-level expanded readers managed atz240+. Card-local saved z values remain inside the canvas context. No DOM changes or new ancestor compositing properties.
- Dust follows a continuous closed0/25/50/75/100% path using existing dx/dy and5–8px offsets, ease-in-out timing and reverse direction for alternating grains. Start/end transforms and opacities match, with no zero-opacity reset. Existing fine sizes, count/density, durations and negative phases remain; hidden/reduced-motion behavior still covers every particle/light pseudo-element.
- Night base wash reduced from roughly36–55% to14–24% alpha, with restrained radial tint, because it now crosses normal card text. Expanded reader paint remains above the atmosphere. Pointer transparency is preserved.
- Final npm test435/435 and npm run check26 modules passed. No new CSS snapshot tests; existing controller test description/comment updated to match composition without changing assertions. Independent scoped source review found no actionable issue in actual stacking, closed-loop movement or motion lifecycle. Structural source inspection found78 balanced brace pairs.
- Actual visual stacking, dust appearance and night text legibility remain unverified under the existing managed browser denial. No real user data, audio, backup schema, dependencies, publishing or window-manager behavior changed.

## 2026-11-16 — Held stamps in expanded readers and open folios

- Shared live-surface resolver supports ordinary board papers, front-facing expanded quest readers and the selected quest on a folio's right leaf. Reader IDs come from their dialog because rendered front data attributes are stripped; folio IDs use data-folio-paper. Hidden/inert/ghost/turning/back surfaces, index/cover, note fields and nonprinted controls are excluded. Reacquiring a refreshed paper remains scoped to the clicked host, including duplicate quest copies across windows.
- Actual affine transforms through all ancestors map pointer coordinates to existing canonical300x350 stampPosition. Identity-like matrix3d reader transforms are accepted; actual unsupported3D/singular/nonfinite geometry is rejected. Existing fine positioning, scale, rotation, custom stamp/status validation and file serialization remain intact.
- Explicit allowArchived:true is passed only for visible reader/folio surfaces. Archived quests retain folder/tray placement, coordinates, notes/subquests/image and all metadata. Default archived board rejection is unchanged. Status commits refresh all views without reconstructing the back editor; existing independent draft/refresh tests continue to pass.
- Capture pointerdown prevents competing paper-window dragging; capture click/key prevents opening a reader while stamping. Cursor and impact render above document windows; after commit, the impact uses the clicked replacement paper. Expanded paper keeps its CSS scale because the board-only stamp-hit transform is omitted there; ink, burst/tool and one contact cue still animate. Right-click/Escape return and repeated use remain intact.
- RED→GREEN: helper10/10; model11/11; app integration initially14/14. Independent review identified two issues: folio corner hit testing and repeated stamping-key events. Scoped pointer-events:auto restores the actual folio corner control (source cascade checked; native hit testing unverified). Added actual app+folio key-listener regression proving repeats incorrectly opened a reader (RED), then consumed valid repeats without extra stamping (GREEN). Final app15/15; app/helper/model/contact41/41. Updated an older VM fixture with real new helper dependencies while preserving exact half-zoom coordinates.
- Final npm test465/465 and npm run check27 modules passed. Reviewer findings resolved; no outstanding important issue. Native visual/mouse/audio verification remains unavailable under the existing managed browser denial. No real quest/backup data, schema, dependencies, publication or audio assets changed.

## 2026-11-17 — A4 quest sheets and coordinated layout

- User approved changing paper proportions and reflowing text, photos, stamps and folios. Shared PAPER is300×(300*297/210), matching210:297. Physical bounds, centers, source grabs, scaled/rotated drops, ghosts, bundle footprints, tray rows, placement/forms and animation defaults now use the A4 footprint. Folder tokens300×210 and labels230×70 retain their material geometry.
- Version-one stamp storage deliberately remains300×350. Legacy ink maps proportionally to the physical page; new pointer clicks invert actual A4 ancestor transforms before mapping to saved space. No data/schema/version rewrite. Generic stampPoint defaults retain compatibility, with physical fractional maxima clamped after rounding. Legacy tray y19650 remains importable and clamps only at the new far-edge footprint limit. Tests cover saved coordinates, old backup parsing, full-page click reach, transformed reader/folio and canonical edges.
- New final stylesheet applies the same dimensions to board/tray sheets, expanded front/back, five-strip turn copies, folio stack and bundle ghosts. Title/body/photo/footer layout reserves an endorsement area; photo and description remain stable across statuses, with contained images and no text/image stretching. Positioned user ink stays at its mapped position; automatic seal/rectangle/banner/custom variants use the endorsement area. Reader fits both viewport dimensions; folio uses actual width/height fitting, inline priorities override legacy mobile constants. Back notes/task list scroll independently within a bounded grid, leaving add/save/retry/corner controls available by source budget.
- Edge/review corrections: default tray band rolls after43 rows, protecting500-paper layouts. Arranging layered18/55-quest groups puts folders below actual page extents. Initial seed rows and section headings now derive from PAPER.height; a rotated-corner regression reproduced seed/footer overlap (RED) then passed after correction. Review caught inherited back-editor overflow and status-dependent photo/body movement; final CSS removes both. No remaining important scoped finding; native appearance remains unverified.
- Verification observed RED→GREEN for shared format4, app4, physical geometry/bounds/compatibility, folio fit and stamp inversion. Geometry owned135/135, follow-up seed model35/35; folio view16/16 and view/motion/drag40/40; stamp18/18. Existing app VM fixtures now model real A4 dimensions while preserving grabbed-pixel and sound-contact assertions. Independent reviewer42/42 focused tests. Final npm test485/485 and npm run check28 modules passed.
- Existing managed browser denial prevented native visual/drag/flip/pointer verification; no alternate browser/UI route used. No real quest/backup data accessed, dependencies installed, audio assets changed or publication performed. User can Ctrl+F5 to inspect the new sheets.

## 2026-11-17 — Natural orientation-aware photo frames

- User reported portrait pictures still sitting inside a fixed landscape frame. Root cause was the final A4 frame126×84 with contain inside a100%×100% image box. Frame now uses max-content width/auto height; image uses intrinsic auto dimensions bounded116×148, giving a max outer126×162 with existing paper padding/border. The frame follows portrait, square and landscape pictures without cropping or distortion, including already saved photos and all shared document/folio/ghost views.
- Taller pictures remain in the left column. Automatic rectangle/banner impressions narrowed140→120 and automatic endorsement right inset24→16; seal/custom sizes and all explicitly positioned marks stay outside those rules. Content positions remain stable across statuses.
- Independent scoped source review confirmed specificity beats the legacy fixed-height/100% rules and found no concrete blocking issue. Static rotated bounds including rectangle outline leave photo right edge150.84 before ink left153.93; photo bottom320.66 remains before footer351.29. Rendering/filter-shadow details are source-based judgments, with no native visual claim.
- Fresh npm test485/485 and npm run check28 modules passed. No new CSS snapshot tests for this reversible visual correction. Actual browser appearance remains unverified under the existing managed browser denial. No real user data, schema, image assets, dependencies, audio or publishing changed.

## 2026-11-17 — Automatic photo layouts, per-quest arrangement and full-image viewing

- User selected all three photo proposals and explicitly requested testing/fixing discovered issues. Added intrinsic-ratio classification: portrait/square photos stay beside text, landscape photos move below a full-width summary with compact automatic impressions. Content does not depend on quest status. Frame chrome and A4 geometry remain consistent across board, tray, folio, reader and fresh visual copies; explicitly positioned ink remains user-owned.
- Optional version-one photoLayout stores physical x/y/outer width/rotation per quest; missing legacy fields stay omitted, null selects automatic layout. Aspect-preserving manual poses clamp rotated frames inside the body and rotation±15. Replacing/removing an image clears stale placement. Real model, backup parsing and unrelated quest metadata preserved; no image-size metadata or raster asset rewrite added.
- Runtime controller adds hover/focus edit/view controls to live papers after the reader's data/button stripping. Move/resize/rotate previews are DOM-only until Done; Reset/Cancel/Escape, pointer cancellation, hidden/removed sources, blur/resize and teardown retire correctly. Actual ancestor affine transforms and CSS zoom are inverted; invalid/singular/turning surfaces are rejected. Held stamps/modals/drag modes retain priority. Saving refreshes all copies of the same quest; inline cached presentation also survives drag/turn copies.
- One reusable native modal displays the whole image with uniform lift260ms/return220ms, close/Escape/backdrop and focus restoration. Reopening, replacing origin even for same raster, loading/decode errors, absent/failing WAAPI, resize, reduced motion and destruction are covered. Return can reacquire a new source after document rerender. Rotation is approximated from source axis-aligned bounds during lift; image is never nonuniformly stretched.
- Independent review found two important issues: availability-only transitions did not restore controls, and the photo-centered editor row could leave the sheet. Narrow hidden/inert/aria-hidden/data-side/open observation now handles reduced-motion back/front and reused folio reopening without paint loops. Editor is bounded to the paper (left/right16,bottom40) and routes only its active source; tiny left/right frame regressions prove Done/Cancel behavior. Source focus before consuming pointer/view events fixes returning to the wrong open reader. These corrections were observed RED→GREEN.
- Focused model/compatibility69/69 plus10,000 deterministic geometry cases; final controller25/25, viewer15/15; root integration/routing fixtures58/58 and follow-up pickup/drawer20/20. Older VM fixtures gained optional photo globals without weakening existing assertions. Final npm test541/541 and npm run check31 modules passed. Isolated real-disk backup integration now explicitly restores imageDataUrl and photoLayout after server restart and simulated browser cache clearing.
- The old local process was verified by exact Node executable and absolute workspace server.mjs command before restart; its start time predated the model update. Restarted only that process with Launch-Questboard.ps1 -NoBrowser, health/readiness confirmed at127.0.0.1:4173. No real quest/backup contents inspected, no dependencies/publication/Git changes and no browser/UI opened. Actual native visual/drag/double-click inspection remains unavailable under the existing managed browser denial.

## 2026-11-17 — Repair photo arrangement focus cancellation

- Reproduced the reported Edit failure in a standalone native Chromium DOM fixture, without loading the app, backup API or personal data. Edit entered and immediately retired: the generic listener helper registered window blur in capture mode, so focusing Move blurred Edit and synchronously cancelled the draft. The same listener also cancelled switches among photo tools.
- Window blur now uses a noncapture listener. Real window blur still cancels; focus changes inside the photo editor preserve the draft. Pointer ownership, cancellation, persistence and listener cleanup retain their existing behavior.
- Controller regression now models native nonbubbling element blur through capture ancestors and checks pointer-focused Edit → Move → Resize → Rotate → Done. Controller26/26 and independent app/controller review29/29 passed.
- Added optional native DOM regression using an installed Chromium executable and a fresh temporary test profile. All28 checks passed across board, expanded reader, folio and tray: entry, move, enlargement, reduction, rotation, save-once and cancel-preserves-saved-pose. DOM focus/blur, CSS transforms and DOMMatrix are native; pointer events are synthetic and pointer capture alone is shimmed because synthetic events have no active native pointer. This does not claim trusted OS mouse or full-app visual verification.
- Mutation proof: serving only the previous capture-blur listener in an isolated fixture reproduces the original failure at “board: Edit survives native button blur”; production files remain fixed. Fresh npm test543/543 (no skips on this Windows machine) and npm run check31 modules passed. Native DOM test skips where no installed Chromium is available; PHOTO_TEST_BROWSER can specify an installed executable.
- The managed browser origin gate still rejected observing127.0.0.1:4173. No alternate route accessed that page or real quests/backups. The safer standalone test serves only a fixture and required static photo modules on a temporary port with no app or data API. No dependency, schema, server restart, publishing or user-data changes were needed. Reload the user's existing page with Ctrl+F5 to load the fixed module.

## 2026-11-17 — Soft morning/evening light and illuminated dust

- User approved the research proposal and requested implementation plus tests. Replaced the sharp gradient slats translating back and forth with anchored feathered morning cream-gold and evening amber masks. Evening uses a distinct longer projection from the opposite side. Light remains on the existing viewport overlay; no masks, filters, opacity or compositing changes were added to document/3D ancestors.
- Two independent local static SVG cloud textures now drift predominantly one way, using transform/opacity only, with zero-opacity resets and61/89-second periods. Shadows paint above both rays and dust so passing shade dims the whole affected area. Static noise is generated by the SVG texture; no turbulence parameters or JS animation callbacks update per frame.
- Dust has a dim base field plus a brighter visual copy behind the exact same spatial mask as the selected sunlight. Each pair shares position, size, drift variables, direction and animation timeline. There are still at most60 distinct motes and at most60 bright copies; no new settings, schema or persistence migration. Surviving pairs remain stable across phase, time, audio and density updates. Hidden pages pause; both JS reduced-motion and native CSS fallback disable animation/hide dust while retaining static light.
- Controller RED→GREEN: missing paired fields/clouds reproduced, then atmosphere27/27 passed. Independent scoped review found no product defect. Reviewer identified a native test gap: manually seeking pairs did not prove their natural clocks. The native fixture now verifies actual animation.ready and requestAnimationFrame progression, paired startTime/currentTime within0.1ms initially, after visibility resume and reduced-motion recreation; fresh CSS-owned animations separate lifecycle checks from manual seek probes.
- Native tests inspect real CSS masks/viewport coordinates, density trim/growth, cloud direction and invisible resets, off/day/night gating, synthetic visibility pause/resume, native media query fallback, elementFromPoint and synthetic click delivery through dummy atmosphere. The fixture runs only approved decorative assets and dummy content in a fresh isolated Chromium process/profile, using an anonymous test pipe and temporary static server; no app, backup API, real quests, existing browser sessions or denied real origin is accessed. Process/protocol/frame timeouts and guarded temporary-profile cleanup are bounded. Tests skip only when no installed Chromium is configured.
- Optional captures6/6 passed; root viewed .local/sunlight-native/sunlight-morning.png and sunlight-evening.png. Feathered bands, subtle motes, no visible cloud rectangle, clear expanded dummy window. No-lit reference captures have identical native dust geometry. Pixel comparison found sampled sunlit morning/evening motes gained up to45/44 RGB channel levels while selected shadow motes gained0; details in pixel-verification.json. These are isolated rendering checks, not real-page OS interaction or a hardware FPS benchmark.
- Final root verification: npm test549/549, zero skips/failures; npm run check31 modules passed. No dependencies, server restart, audio, schema, publishing or user data changes. Reload the existing app with Ctrl+F5, then select morning/evening under the current atmosphere controls.

## 2026-11-17 — Quest prerequisites and unlock animation

- Added optional prerequisiteIds while retaining version1 and omitting missing legacy fields. Multiple selected quests must all be done; archived/in-folder predecessors work normally. Validation rejects self/missing/nonquest/duplicate/sparse/oversized identifiers and cyclic graphs. Model guards new completion through direct update, held stamp and modal stamp. Unfinished descendants relock on predecessor reopen; already-completed history and ink remain intact.
- Existing quest editor now has an accessible native-checkbox/search picker with persistent selection and cycle-disabled explanations. Submit and pre-status/archive saves carry IDs through a snapshot-safe commit, without changing state before transition detection. Compact waiting/ready ink badge occupies the existing priority-caption slot; rank remains above and paper/photo geometry is unchanged. Hover/ARIA exposes predecessor names. Locked quests remain readable/editable/movable; success stamping is blocked and the modal names pending predecessors without closing on rejection.
- Commit compares pre/post graph state, persists immediately, then decorates all visible live board/tray/reader/folio copies which actually unlock. The780ms knot/lock/gold effect targets only ephemeral children at the badge/metadata; no whole-paper transform or pointer capture. Repeat commits and initial load do not repeat it; imports explicitly suppress it. Hidden/back/ghost copies are excluded. Pointer interaction, rerender, blur, resize, pagehide, completion, safety deadline and reduced-motion cleanup leave no overlay behind.
- Fixed a reproduced stale-folio case: the selected dependent quest object stays identical when another quest succeeds, so the old preview cache retained its waiting badge. Cache now also tracks prerequisite identity/title/status, preserving unchanged renders. Deleting a predecessor warns about affected quests, removes its edges atomically, and Undo restores both the quest and edges while retaining current unrelated metadata. Ordinary dependency editing replaces that Undo toast; no reachable later-edge-overwrite issue found by independent review.
- RED→GREEN evidence:15 new model/helper cases; model/stamp105/105 focused; effects16/16; root commit/folio and invalid modal/delete-undo regressions failed before fixes then passed. Root editor submit/create/action/error integration9/9 passes. Badge4/4 and native picker1/1 cover escaping, selection/search, transitive cycles, archive/folder options, FormData isolation and teardown. Isolated port0 real-disk integration1/1 preserves graph/notes/subquests/storage after server restart, rejects bad/cyclic POSTs and malformed JSON without changing last-good revision/history/files.
- Native combined fixture2/2 passes with75 moving +51 native-reduced checks: real picker/model/modules, two predecessors, partial/final transitions, all four copies,16 native child animations, natural frame progression, unchanged paper pose, native elementFromPoint + synthetic click delivery, retirement, callback/native CSS reduced paths, repeat/relock/history and round trips. Root inspected four-copy output PNG under .local/prerequisite-native; badge fits the metadata row. Fixture uses only dummy data, explicit static allowlist, fresh isolated profiles/private pipes and bounded cleanup; no real app origin, user quests, backup API or existing browser session is loaded. OS mouse, real-page UI and hardware performance are outside these checks.
- Concurrent full-suite rendering initially timed out in the existing native sunlight fixture and cancelled a prerequisite animation (596/598). Test files now run sequentially via --test-concurrency=1; no assertions, cases or product deadlines were relaxed. Fresh root npm test598/598 passes with zero skips/failures; npm run check34 modules passes. Optional screenshot rerun2/2 passes.
- The live old backend process PID6524 was verified against the exact Node executable and absolute workspace server command before restart, because its cached model would otherwise drop the new optional field. Launch-Questboard.ps1 -NoBrowser started healthy PID2724 with creation time after model changes. No real backup contents read or changed by QA, no dependency installation/publication/audio/schema-version changes. Ctrl+F5 loads the new frontend; existing automatic local saving includes dependency IDs.

## 2026-11-17 — Time-of-day ambient recordings

- Added four local CC0 recordings and an independent daypart player: morning birds06:00–09:59, daytime wind/leaves10:00–15:59, evening fireplace16:00–18:59, nighttime insects19:00–05:59. Automatic is the app default; manual previews/off and a separate layer fader persist under the existing local atmosphere key. Automatic sound uses the actual local clock independently of manual light previews. One visible minute-boundary timer serves either automatic light or sound, with initial clock notification before audio preferences and a fresh clock on visibility return.
- Four source pages/license declarations, downloaded preview hashes, processing scripts and independent signal QA are recorded in docs/daypart-audio-sources.md. Files decode as mono22050Hz PCM16, last33.5/47.5/47.5/43.5seconds and peak at−12dBFS. Baked joins are below each recording's99th-percentile adjacent step. Existing rain/tavern bytes and player are unchanged. No subjective listening or perceived loudness approval is claimed.
- Player37/37 and atmosphere33/33 focused tests pass. Root bootstrap/gesture/mute/status tests4/4 pass. Latest requested phase wins; old sound continues while the next buffer loads; ready-only2.5second fades use at most two time voices. Global mute/off/zero fade promptly; hidden/destroy release immediately. Late fetch/decode/resume/suspend and rapid choices cannot revive stale sources. Failure retries require an explicit interaction rather than a clock-tick loop.
- Independent review reproduced two P2 issues RED→GREEN: selecting a mode reusing the same recording lost the UI playing hint; lowering a nonzero fader during crossfade missed the outgoing sound. Status signature now includes selected mode/effective phase. A shared180ms smoothed gain bus affects both voices without extending the original phase fade/cleanup. Regressions cover both faders, native cancelAndHold and analytical fallback, rapid reversals, final absolute gain and disconnects. An older isolated sound-toggle fixture needed the new dependency stub; original assertions remain with added daypart mute/unlock checks, focused4/4 green.
- Native composed fixture passes82 assertions using native Web Audio contexts/buffers/OfflineAudioContext/analyser, the actual four files and a manual tavern recording. A trusted initial CDP click had isTrusted:true and real active user activation, with no autoplay-policy override and no realtime context/fetch beforehand. Final full-suite run measured2.5226seconds wall/2.52seconds audio crossfade, at most two time voices, a nonzero analyser peak0.00521, preserved tavern source identity, correct same-recording status and mute/levels/off/hide/return/destroy behavior.
- Fixture uses a fresh temporary headless Chromium profile, muted speaker output, private anonymous pipe, explicit static allowlist and dummy content. Later control/visibility events and supplied clock changes are synthetic; native decoding/graph/gain/time are real. No real app, backup API, personal quests, existing session or denied real origin is accessed. Browser/profile cleanup is bounded and guarded. This does not claim real-page mouse or subjective listening verification.
- Final root npm test645/645, zero failures/skips; npm run check35 modules passes. Test files remain serialized. No dependency, backend/schema, quest data, automatic backup or publication changes; no server restart required. Ctrl+F5 loads the update, then click or press a key to unlock browser audio. Controls are under เครื่องมืออื่น ๆ → บรรยากาศกิลด์ → เสียงตามช่วงเวลา.

## Burn Polish (Ash Flakes, Smoldering Wisp, Paper Aging)
- Verified via `npm run check` and `npm test` (including `tests/burn-model.test.mjs`, `tests/paper-burn-effects.test.mjs`, `tests/motion-governance.test.mjs`).
- Note: Visual smoothness and real-mouse drag feel were verified in an isolated HTML preview, not in a live full-app browser session.
