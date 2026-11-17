# Time-based guild ambience implementation plan

> **For agentic workers:** TDD, independent file ownership, and final review. Local workspace has no Git repository; no worktree/commit steps apply.

**Goal:** Automatically change ambient recordings with morning/day/evening/night, with smooth transitions and independent rain/tavern controls.

**Spec:** User requested ambient sound changing with time. Build on the existing warm fantasy guild and four local-clock phases (06:00,10:00,16:00,19:00). Root choice: morning birds, daytime wind/leaves, evening hearth, night insects. Add a soundscape selector: auto (default), explicit four previews, off; and its own level slider. Automatic sound follows the actual computer clock independently of manually previewed lighting. Manual sound choices remain independent. Existing global mute and master ambient volume cover the new layer.

**Architecture:** Keep the existing thoroughly tested rain/tavern player unchanged. A separate small daypart recording player owns at most two voices (current/outgoing), decodes/cache local recordings, crossfades about2.5seconds when the incoming recording is ready, and respects gesture/mute/visibility/zero volume/destroy. Existing atmosphere controller supplies local-clock phase via an independent onPhaseChange callback and maintains one bounded minute timer while either light or sound is automatic. No per-frame JS, remote streaming, quest schema or dependency changes.

## Interfaces and ownership

- Audio agent owns new `dist/daypart-ambience.mjs` + own tests. Export `createDaypartAmbience({document,window,AudioContext,fetch,setTimeout,clearTimeout,onStatus})` returning `{setSettings(patch),setPhase(phase),unlock(),setMuted(value),getStatus(),destroy()}`. Settings keys soundscape(enum auto/morning/day/evening/night/off),volume,soundscapeVolume. Default engine soundscape=off for composition/backward lifecycle safety; app's atmosphere preferences opt in with defaultauto. setPhase supplies resolved real-clock phase, never persists it. Status `{soundscape:off|waiting|loading|playing|muted|paused|quiet|error}` comes from actual player state.
- Asset agent owns new `dist/audio/ambience/morning.wav`, `day.wav`, `evening.wav`, `night.wav`, source/license documentation and reproducible local prep script. Existing rain/tavern bytes untouched. Verified redistribution-friendly primary licenses, preferablyCC0. Natural distinct recordings, quiet loops without abrupt joins, conservative normalized peak and reported measurements.
- Atmosphere agent owns atmosphere.mjs/.css and atmosphere.test.mjs. Add persisted soundscape:'auto',soundscapeVolume:1. Selector plus independent fader/status and clock hint. Optional onPhaseChange({phase,time}) callback receives actual-clock phase on sync (including manual lighting/off); no settings writes or onAudioChange notifications from clock ticks. Existing one-minute timer runs when lightauto OR soundscapeauto and visible, zero after destroy/hidden. Maintain focused input values and all visual behavior.
- Root owns app integration, package/check command, docs, integration/native audio verification and final review.

## Acceptance and review focus

- Latest requested phase wins even if loads/decode resolve out of order; never start a stale source.
- Preserve old playing sound until the next file is ready; crossfade bounded voices, no stacks under rapid phase changes.
- Unlock only with user gesture; hide/destroy stop and disconnect immediately. Mute/off/zero level fade promptly and cannot be reversed by late decode. Resume only currently requested phase.
- Time auto follows every exact phase boundary, manual previews/lighting do not fight it, day rollover and hidden return refresh correctly with one timer.
- No stale playing hints, runaway retries, loss of stored preferences, restarting manual rain/tavern loops or quest/file-backup changes.

## Tasks / ledger

- [x] Recordings: four primary-author CC0 sources, reproducible local loops, independent decoding/peak/seam checks; rain/tavern hashes unchanged. See docs/daypart-audio-sources.md.
- [x] Player: 37 passing tests, including ready-only crossfade, bounded rapid previews, late decode/resume/suspend races, failure retries, both faders and cleanup.
- [x] Clock/preferences/UI: 33 passing tests, including automatic/manual phase routing, exact boundaries, one timer, visibility refresh, transient status and persistent independent controls.
- [x] Integration, native audio decoding/lifecycle checks, asset signal QA, independent review, full tests/checks and actual verification notes. Root fresh npm test645/645, no skips/failures; npm run check35 modules. Native case uses 82 assertions with a trusted initial click, real decoded recordings/graph/crossfade and synthetic subsequent controls/clock/visibility.

Independent review found two P2 regressions and both were reproduced RED before fixes: selection of a mode reusing the same recording failed to republish playing status; nonzero fader changes missed the outgoing crossfade voice. Status identity now includes mode/target/status, and all phase envelopes feed a shared 180ms smoothed master bus. Tests cover both faders, native hold and analytical fallback, rapid reversals, absolute gain and unchanged outgoing cleanup deadline. Full-suite first run also exposed an older isolated sound-toggle fixture missing the new player dependency; its original assertions remain, with extra assertions for the new player. Focused4/4 and the final645/645 pass.

Baseline:598 tests,34 syntax-checked modules from completed prerequisite feature. Npm test already serializes files to avoid native browser rendering starvation. Existing browser denies the real app origin; native tests must use fresh-profile dummy fixtures with no user quests/API/session. Automatic audio still requires a click/key gesture and respects the existing saved global mute.
