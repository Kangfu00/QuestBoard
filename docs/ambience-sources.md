# Guild ambience recordings

Imported and verified on 2026-11-16. Both recordings are explicitly marked [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) on their original Freesound author pages. They may be redistributed and edited; attribution is retained here as provenance. Runtime playback reads only the bundled WAV files, with no account, streaming, or external network request.

## Original recordings

| Layer | Original author page | Author | Public HQ preview downloaded | Download SHA-256 |
| --- | --- | --- | --- | --- |
| Rain | [Light Rain, #167034](https://freesound.org/people/soundrecorder7/sounds/167034/) | soundrecorder7 | [167034_2328971-hq.mp3](https://cdn.freesound.org/previews/167/167034_2328971-hq.mp3) | `e96de7229dd13c42798e8bdad265123d4e1d1377135c9c54c829fe4c7cd3ed55` |
| Distant tavern | [Bar, Pub, Tavern_2.wav, #475504](https://freesound.org/people/o_ciz/sounds/475504/) | o_ciz | [475504_7009965-hq.mp3](https://cdn.freesound.org/previews/475/475504_7009965-hq.mp3) | `8ef93ac53b7a05c6891eda0959606ff4bbaf60465f598dc5011d111387496b4f` |

The rain author describes a field recording of light rain without thunder. The tavern author describes people talking in a pub. These are recordings, not synthesized voices. The tavern's distance treatment is an application edit; the source is a real pub, not a recording of a fantasy guild. No separate music layer has been added.

The files downloaded are Freesound's public MP3 previews, not the account-gated original WAV uploads. The rain preview is 470,423 bytes, 26.319819 seconds, 44.1 kHz stereo. The tavern preview is 6,679,488 bytes, 300.660 seconds, 48 kHz stereo. Original author-page HTML, downloads, machine-readable source and measurement records, and reproducible preparation scripts are retained in `.local/ambience-source/`; none is required at runtime. Only audio and source/license metadata were fetched. No downloaded code was executed.

## Processing and runtime files

`prepare-loops.py` uses locally available libsndfile, NumPy, and SciPy. It decodes each preview, averages its stereo channels to mono, resamples to 22,050 Hz with a polyphase filter, removes low rumble with a second-order 80 Hz high-pass filter, and applies a fourth-order low-pass filter. All filters are applied with forward/backward filtering. Rain uses a 7,500 Hz low-pass; tavern uses 3,200 Hz to retain more room and speech detail while keeping the background treatment. Rain uses the complete recording; tavern uses seconds 30–120. Run `python .local/ambience-source/prepare-loops.py --only tavern` to reproduce the tavern asset without rewriting rain.

A linear crossfade blends the source's tail into its head over two seconds for rain and three seconds for tavern. The blended section is baked inside the buffer, so the final sample leads into the next consecutive source sample at loop wrap. No fade to silence is inserted at that wrap. Output peak is normalized to -12 dBFS and encoded as mono 16-bit PCM WAV. Native `AudioBufferSourceNode.loop` then maintains one source per enabled layer without scheduled duplicate voices or a JavaScript loop timer.

| Runtime file | Duration | Frames / bytes | Peak / RMS dBFS | SHA-256 |
| --- | ---: | --- | --- | --- |
| `dist/audio/ambience/rain.wav` | 24.319819 s | 536,252 / 1,072,548 | -12.000 / -32.605 | `d6f74c438c7a637e7ac828fabf47fa2c111f7befc2fab66ea7db581fc9efdc3b` |
| `dist/audio/ambience/tavern.wav` | 87.000000 s | 1,918,350 / 3,836,744 | -12.000 / -30.370 | `ec203f7cda3750607b5fe7fd1e7c817583c76065b9dcb7a5750ef9a4faf73a9a` |

Measured absolute loop-wrap sample steps are 0.010498 for rain and 0.001831 for tavern, below their within-recording 99th-percentile adjacent steps of 0.042816 and 0.017365 respectively. This confirms bounded numerical joins; it is not a claim of subjective listening approval.

The initial tavern asset used a 1,600 Hz low-pass and runtime gain 0.24. Following a report that rain masked the enabled tavern layer, the tavern was reprocessed at 3,200 Hz with the same source excerpt, loop crossfade, sample format, length, and -12 dBFS peak target. Rain's bytes and hash were checked before and after and remain unchanged. The previous tavern SHA-256 was `8723617034117828f9209b912d775b37946ce859312a4c271e70a696f306953a`. The before/after audit is retained in `.local/ambience-source/tavern-3200hz-comparison.json`.

| First 20 decoded seconds | Previous tavern, 1.6 kHz | Current tavern, 3.2 kHz |
| --- | ---: | ---: |
| RMS | -32.989 dBFS | -33.108 dBFS |
| Power-weighted spectral centroid | 425.577 Hz | 432.485 Hz |
| Power above 1,600 Hz | 0.020800% | 0.229470% |
| Power above 3,200 Hz | 0.00001091% | 0.00082563% |

Spectral measurements use Welch power spectral density with Hann windows of 8,192 samples and 4,096-sample overlap; band power sums bins strictly above the indicated cutoff. The broader filter preserves approximately eleven times as much power above 1,600 Hz in this excerpt, but peak normalization makes its unweighted RMS 0.119 dB lower. The runtime gain increase from 0.24 to 0.60 supplies the level lift: at unity layer faders and master volume, first-20-second tavern RMS changes from -45.385 to -37.545 dBFS. Rain at gain 0.32 is -42.489 dBFS for the same period, changing tavern's relative level from 2.896 dB below rain to 4.944 dB above it. These signal measurements do not establish perceived loudness or a listening-approved mix.

## Playback and verification

The manual rain and tavern layers default off. A separate automatic time-of-day layer is documented in [daypart-audio-sources.md](daypart-audio-sources.md); the two-layer peak bounds below exclude that layer and desk foley. `unlock()` must be called from a user gesture, and the controller declines a call when the browser explicitly reports no active user gesture. Requested manual layers then fade over 180 ms. Their maximum linear gains before the independent 0–1 layer faders and the common ambient volume are 0.32 for rain and 0.60 for tavern; the common volume is clamped to 0–1 and defaults to 0.3. With both manual layer faders at maximum, their mathematical combined peak bound is below -12.7 dBFS at full ambient volume, and below -23.1 dBFS at the default ambient volume, even if both normalized peaks coincide. These are measured signal bounds, not a listening-approved mix.

Switching a layer off, muting globally, or setting volume to zero fades and releases its source. Rapid toggles cancel pending fade cleanup and reuse the existing source. A hidden document stops and disconnects sources immediately and suspends the context; returning restores only currently requested layers. Fetch/decode failures disable only the failed layer and suspend otherwise idle audio. An explicit layer off→on choice permits one new attempt; slider movement, visibility changes and repeated enabled settings do not trigger retries. Loading/playing/error/waiting/mute/paused/zero-volume states are reported to the controls from actual player state. `destroy()` removes the visibility listener, cancels fade timers, aborts pending fetches, releases nodes, and closes its context.

Lifecycle tests exercise gesture gating, fade cleanup, volume bounds, mute, hidden-page restoration, pending decode cancellation, rapid toggles, delayed context suspension, error isolation, and destruction against controlled Web Audio/network boundaries. Python soundfile independently decoded both runtime WAVs and measured their format, duration, peak/RMS, and loop join. No real-browser playback or subjective listening was performed in this environment.
