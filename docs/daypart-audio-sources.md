# Time-of-day ambience recordings

Imported and verified on 2026-11-17. Each original author's Freesound page explicitly identifies its recording as [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). The primary pages link that dedication and permit redistribution and editing, including commercial use. The [CC0 legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode) is the governing text. Attribution below is retained as provenance and does not imply endorsement.

The runtime files are local recordings: morning birds, daytime wind through leaves, an evening fireplace, and rural nighttime insects. The author describes the bird recording as an early-spring urban garden; the wind recording as wind and foliage; the fire recording as an indoor fireplace; and the night recording as Australian crickets and other insects. These descriptions guided selection. No music, generated tones, voices, or other sound layers were added during preparation. This is not a listening-verified guarantee that every incidental distant sound is absent.

## Original sources

| Phase | Primary author/license page | Author | Downloaded public HQ preview | Download SHA-256 |
| --- | --- | --- | --- | --- |
| Morning | [Morning Birds in a Quiet Urban Garden, #798842](https://freesound.org/people/WhisperingEarth/sounds/798842/) | WhisperingEarth | [798842_17200815-hq.mp3](https://cdn.freesound.org/previews/798/798842_17200815-hq.mp3) | `1839c3ffb2da81d02ae5bb354999f55b61515508c319e720a9b5c57d2e24bca9` |
| Day | [Wind(leaves).WAV, #475448](https://freesound.org/people/o_ciz/sounds/475448/) | o_ciz | [475448_7009965-hq.mp3](https://cdn.freesound.org/previews/475/475448_7009965-hq.mp3) | `32334db89c207004f5f290ec94d775670ffa846f3f63e33da3065bed5346def8` |
| Evening | [Fire place (open door) XY 60 cm away, #802230](https://freesound.org/people/Sadiquecat/sounds/802230/) | Sadiquecat | [802230_5287430-hq.mp3](https://cdn.freesound.org/previews/802/802230_5287430-hq.mp3) | `9cb490a167690490534cf4c948a768e922115d0a28b5f8442518ad50b76cae7b` |
| Night | [Night Crickets Ambience on Rural Property, #320145](https://freesound.org/people/OwlStorm/sounds/320145/) | OwlStorm; preferred credit Ashe Kirk / Owlish Media | [320145_140737-hq.mp3](https://cdn.freesound.org/previews/320/320145_140737-hq.mp3) | `0c9e5a14c7a5ff20de0bbecfa85fb93fe5d53a79917c5370163a391ae171a74e` |

These are Freesound's public MP3 previews, rather than the account-gated original uploads. Their decoded lengths are respectively 40.298667, 168.280000, 280.524938, and 82.517528 seconds. All are stereo; the first three decode at 48,000 Hz and the night preview at 44,100 Hz. Preview file sizes are 912,480; 3,776,592; 7,611,888; and 1,900,442 bytes. The phases use recordings from four separate author pages.

Primary-page HTML, the CC0 deed/legal-code HTML, downloaded source MP3s, exact source metadata and hashes (`sources.json`), measured outputs (`processing.json`), and preparation scripts are retained in `.local/daypart-source/`. The source pages and license pages were fetched as inert metadata; only audio and metadata were downloaded and no remote code was executed. They are not runtime dependencies. [License-dayparts.txt](../dist/audio/ambience/License-dayparts.txt) accompanies the distributed WAVs.

## Reproduction and processing

From the project root, `python .local/daypart-source/download-sources.py` restores absent source previews and checks their exact SHA-256 values before accepting them. A changed upstream preview requires a new provenance review. `python .local/daypart-source/prepare-loops.py` rebuilds all four assets; `--only morning`, `--only day`, `--only evening`, or `--only night` rebuilds one. The preparation uses the existing local NumPy, SciPy, and SoundFile packages; it introduces no runtime package dependency.

The script averages stereo channels to mono, takes the excerpt below, resamples using a polyphase filter, applies a second-order high-pass and fourth-order low-pass with forward/backward filtering, and bakes a 2.5-second linear tail-to-head crossfade into the buffer. The output starts at the sample immediately following the blended head, so there is no fade to silence or arbitrary hard splice at loop wrap. Crossfading shortens each excerpt by 2.5 seconds. Each output is peak-normalized to -12 dBFS and written as mono, 22,050 Hz, 16-bit PCM WAV. No dynamic compressor or limiter is used.

| Phase | Source excerpt | High-pass / low-pass | Runtime duration | Frames / bytes | Peak / RMS dBFS |
| --- | --- | --- | ---: | --- | --- |
| Morning | 4–40 s | 110 / 7,500 Hz | 33.500000 s | 738,675 / 1,477,394 | -12.000 / -34.655 |
| Day | 25–75 s | 120 / 6,500 Hz | 47.500000 s | 1,047,375 / 2,094,794 | -12.000 / -28.360 |
| Evening | 130–180 s | 90 / 6,500 Hz | 47.500000 s | 1,047,375 / 2,094,794 | -12.000 / -30.486 |
| Night | 2–48 s | 180 / 7,500 Hz | 43.500000 s | 959,175 / 1,918,394 | -12.000 / -33.549 |

| Runtime file | SHA-256 |
| --- | --- |
| `dist/audio/ambience/morning.wav` | `57c171448252a3477504aa0f804619dc0c1d4486ced52c73218850ed056af0a3` |
| `dist/audio/ambience/day.wav` | `6daa86e4fb85f9d84c1d79a7346e509789c11401de79fc769df1574e50b0001f` |
| `dist/audio/ambience/evening.wav` | `b18f17f1f4dce7a246e538a5921be45cf531240794bb439cd2119fe2549185ef` |
| `dist/audio/ambience/night.wav` | `27666602aa0b650fdfbde2b793f8de65ab328fb02d2a5e4305a87090af50c277` |

## Signal verification and limits

SoundFile independently decoded each delivered WAV, verifying its format, length, finite samples and conservative peak. The loop-wrap step is compared with the same file's ordinary adjacent sample differences below. The crossfade is already baked into the recordings and needs no runtime timer.

| Phase | Absolute sample step at wrap | Within-file 99th-percentile adjacent step | Wrap step's percentile |
| --- | ---: | ---: | ---: |
| Morning | 0.000916 | 0.047951 | 17.989% |
| Day | 0.000031 | 0.050903 | 0.249% |
| Evening | 0.000214 | 0.003998 | 16.421% |
| Night | 0.008331 | 0.056885 | 74.273% |

All four joins fall below their recording's 99th-percentile adjacent step. These are numerical seam checks; they do not establish perceived loudness, absence of audible seam artifacts, or a listening-approved mix with rain, tavern and desk effects. Natural sparse bird calls and insect chirps retain their source dynamics, so identical peaks do not imply identical perceived levels. No subjective listening was performed during asset preparation.

The preparation script checks the pre-existing rain/tavern SHA-256 values before and after processing, and never writes either file. Their hashes remain `d6f74c438c7a637e7ac828fabf47fa2c111f7befc2fab66ea7db581fc9efdc3b` and `ec203f7cda3750607b5fe7fd1e7c817583c76065b9dcb7a5750ef9a4faf73a9a` respectively.

## Runtime routing

The automatic sound selector follows the computer's local clock: morning06:00–09:59, day10:00–15:59, evening16:00–18:59, night19:00–05:59. Explicit sound previews are independent of explicit light previews. The app opts into automatic sound by default while retaining saved global mute and common ambient volume. The manual rain/tavern engine is unchanged and continues independently.

Each time voice has a linear phase envelope with a maximum gain of0.45. A shared gain bus applies common ambient volume × time-layer volume to all current/outgoing voices, smoothing changes over180ms. A prepared incoming file crossfades with the old recording over2.5seconds; no more than two time voices exist. Mute/off/zero shorten fades; hidden/destroy stop and disconnect immediately. Playback requires an initial user gesture. Native loop playback uses no per-loop JavaScript timer. One minute-boundary controller timer refreshes the real clock while visible if either lighting or sound is automatic.
