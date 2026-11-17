# Tavern audibility: independent scoped review

Reviewed 2026-11-16 against `2026-11-16-tavern-audibility.md`: `dist/ambience.mjs`, `dist/atmosphere.mjs`, the app factory/status wiring, controls CSS, and the corresponding new tests. No user data, browser automation, dependency changes, or product edits were performed by the reviewer.

**Verdict: no unresolved important code findings.** The tavern gain is 0.60; rain remains 0.32. Master and independent layer faders multiply and clamp separately; zero affects only the requested layer, with the existing fade/release, mute, visibility and asynchronous-start guards retained. Failed files retry on an explicit false-to-true toggle and do not retry on volume changes or repeated true settings. A working rain source remains in place during a tavern retry.

Status originates from the player rather than checkbox state. Loading, gesture wait, mute, hidden, zero-volume and load failure have distinct hints; a started source supplies playing status. The reviewed late `source.onended` cleanup now publishes its changed status, preventing a stale playing hint. Initialization safely tolerates synchronous status callbacks before the atmosphere factory returns, then explicitly supplies its latest snapshot. Status updates neither persist as preferences nor rebuild focused controls. Older saved preferences retain master volume/toggles and gain default layer levels of 1 without a storage migration write.

Independent targeted verification passed **7 tests, 0 failures** using `node --test --test-name-pattern='actual layer status|failed tavern|older preferences|faders|status updates|only real playback' tests/ambience.test.mjs tests/atmosphere.test.mjs`; 24 unrelated tests were skipped. The root agent owns full-suite and module checks.

One documentation correction was relayed: `docs/ambience-sources.md` still described failed layers as disabled for the entire controller lifetime, despite the new explicit off/on retry. This is a documentation mismatch, not an audio lifecycle blocker.

The asset agent's signal measurements support the masking hypothesis and bounded mix; this review did not repeat asset processing or listening. Player status describes its audio graph lifecycle and cannot prove sound reached the user's device. Actual browser playback, subjective audibility and visual control layout remain unverified under the existing managed local-origin browser restriction.

Root follow-up: corrected the retry documentation to explicit off/on retry, matching the player. Final full suite427/427 and26 module checks passed. User listening feedback requested after the concrete fix; no claim of native listening verification is made before that reply.

User subsequently confirmed “ได้ยินเสียงโรงเตี๊ยมแล้ว” after the refresh/listening check. Reported audibility issue resolved on the user device.
