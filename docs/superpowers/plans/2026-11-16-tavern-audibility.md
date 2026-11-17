# Tavern audibility correction

User reports only rain, and confirms tavern is enabled. Existing files are valid/distinct and match provenance hashes. Browser playback state is unavailable under existing managed deny, so actual playback is not inferred from asset validity.

Measured diagnosis: current default master mix puts both whole-file averages near -53dBFS, but first20s tavern is2.90dB below rain. The1.6kHz low-pass leaves only.072% whole-file tavern power above1.6kHz, versus40.87% rain;500–1600Hz levels are equal and upper speech/clink band is strongly masked. This supports an over-muffled, low-level mix hypothesis; it does not prove successful browser playback.

- [x] Reprocess retained CC0 tavern source at3.2kHz instead of1.6kHz, preserving crop/loop/format/peak; measure and document rain unchanged.
- [x] Increase tavern layer gain .24→.6 (bounded sum still below clipping at source -12dBFS peaks).
- [x] Add independent rainVolume/tavernVolume controls (0–1, default1) while retaining saved master .3 and toggle choices.
- [x] Expose real loading/playing/error/mute/wait status to the settings UI. Allow one explicit off→on retry after a failed file; repeated volume changes must not retry.
- [x] Keep autoplay/visibility/mute/cancellation guards; verify new tests RED→GREEN, full suite and module checks. Native listening/browser verification remains unavailable.

Ownership: audio asset preparation agent owns WAV/provenance, atmosphere agent owns settings/controls/tests, root owns player/app/tests/integration.
