# Right storage drawer implementation plan

**Goal:** Move the combined physical storage tray to the right, reserving screen space for it instead of covering the board.

**Accepted design:** A shared quest/folio drawer at roughly 35–40% desktop width. The board uses the left area with its existing paper scale and scroll position. Open/close and direct horizontal pulling move the divider. Closing returns the board to its full working width apart from the visible handle. Keep search, folder creation, free placement and all saved coordinates.

**Architecture:** Replace the vertical tray controller with a horizontal dock controller. Expose reveal callbacks so CSS reserves exactly the visible drawer width. Compute board fitting against the undocked available width, using the current measured page paddings so animation does not change paper size or cancel active drags. Keep all model/backup data unchanged.

**Stack:** Existing local ES modules, CSS, Pointer Events and Node tests; no external dependencies or deployment.

- [x] Controller/geometry: horizontal pull, live reserved width, cancel/resize/click suppression; test partial reveal and paper scale stability.
- [x] CSS/app: right dock and board padding transitions; same timing/easing and reduced-motion handling; retain precise drop geometry.
- [x] Verify focused geometry/drag/backup tests and syntax. Update guidance. Browser origin restriction remains respected.
