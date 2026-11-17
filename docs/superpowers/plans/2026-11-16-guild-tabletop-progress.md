# Execution ledger — plan: 2026-11-16-guild-tabletop.md

- User accepted the preceding concrete four-part tabletop proposal; pins removal is consistent with the question in the same request. Proceed within that authorization.
- No Git repository; existing project is the user's local working app. No worktree/commits apply.
- Baseline: npm test 286 passed / 292 total. Six temporary-HTTP tests failed with loopback EACCES (backup integration returns browser-only as a consequence). No code edits at baseline.
- Preflight: grip helper and folio view use separate files; root owns app.mjs integration and drawer hooks. Independent helpers may be delegated concurrently without shared mutations.
- Browser restriction remains; no alternative browser or UI path will be used.

- Task1 complete: grip helper and CSS, RED→GREEN 7 tests, desk helper combined 20/20.
- Task2 complete: actual-member stack and per-folder bookmark memory, focused folio suite 38/38.
- Task3 complete: drawer motion hook and cancellation/reset, grip app integration, pin/hole removal, timed per-item contact cues. Caught and fixed the different board/stored drag object shapes using the actual arrival pickup handler.
- Full verification: approved temporary-HTTP run npm test 312/312; npm run check 20 modules. Independent review pending.
- Independent review found P2: re-grabbing an item during its 180ms tray landing leaves an old ghost and lets old cleanup undim the replacement gesture's source. Reviewer is adding actual-handler RED regression for quest and folder. Fix will tie visual cancellation to the existing per-item contact cue controller.

- Final review fix: item cue controller now cancels its landing ghost synchronously on re-grab; old completion cannot expose the new drag source. Actual-handler quest/folder regressions RED 0/2 → GREEN 2/2.
- Final review fix: linear effect timelines with per-segment easing make contact offsets correspond to wall time. Board contact166ms; folio215ms; tray explicit contact144ms. Timing inversion regressions RED 0/3 → GREEN 3/3.
- Final verification: npm test317/317, no failures/skips; npm run check20 modules. No unresolved important findings; no added dependencies, data migrations or server changes.
