# Guild tabletop independent review

Reviewed the current implementation against `2026-11-16-guild-tabletop-design.md` and `2026-11-16-guild-tabletop.md`. Read-only source review covered grip transforms, drawer motion, folio selection/counts, pin removal, contact cues and integration. No browser, user-data access, deployment or Git workflow was used.

## Resolved findings

- **[P2, resolved] Retire a tray landing before re-grabbing its item** — `dist/app.mjs:621–627`, with pickup at `dist/app.mjs:354–358`. Originally, dropping a paper or folder into the drawer and re-grabbing its dimmed grip before the 180 ms landing ended left both old and new ghosts visible. The old completion also undimmed the active drag's source. The landing now follows the item's abort controller, which retires the old visual synchronously before pickup. Natural completion removes the abort listener; a late old promise cannot clear the replacement gesture's source state.

- **[P2, resolved] Schedule cues against eased contact time** — `dist/app.mjs:320–325`, `dist/app.mjs:339–351`, `dist/app.mjs:623–624`. Originally, raw keyframe offsets were used as elapsed-time fractions despite effect-level ease-out: desk contact occurred at **64.25 ms** versus its **165 ms** cue, and folio contact at **75.11 ms** versus its **215 ms** cue. Effects now use linear overall timelines and easing within individual segments. Desk compression and cue match at approximately **166 ms**, folio contact at **215 ms**, and an explicit drawer contact keyframe at **144 ms**. This conclusion uses actual-function timing tests; listening is unverified.

`tests/contact-ownership.test.mjs` exercises actual pickup/settling handlers, cue controllers and motion helpers for both quest and folder. `tests/contact-timing.test.mjs` checks actual animation frames/options and cues using an independent inversion of effect easing. Both were observed RED before their fixes (**0/2** ownership, **0/3** timing), then independently rerun together after the fixes: **5/5 passed**. The root also reports **10/10** contact plus effects integration tests and **24/24** ownership plus existing drag/folio integration tests.

## Spec verdict

**Pass in the reviewed scope after corrections.** Grip transforms preserve the grabbed transform origin under zoom; drawer drift stays separate from saved storage positions and resets on the reviewed cancellation paths; folio memory survives reopening and temporary search, drops stale/deleted selections, and bounds backing sheets by full membership. Pins and placement wording follow the desk direction. Both identified re-grab and contact-alignment gaps are resolved.

## Quality verdict

**Pass in the reviewed scope; no important open findings.** The regression tests now cover the exposed races and timing mismatch. After both fixes, the root reports final `npm test` **317/317 passed** with no failures or skips, and `npm run check` passed for **20 modules**; this review independently ran the five new regressions and did not repeat the full suite. Appearance, real browser geometry and listening remain unverified because local-origin browser access is denied.
