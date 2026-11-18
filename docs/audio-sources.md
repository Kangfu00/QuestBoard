# Desk foley sources

Imported on 2026-11-16. These are original recorded foley assets distributed by Kenney under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The official asset pages and both archive license files were checked. Attribution is optional under the supplied licenses; source provenance is retained here.

The 40 selected OGG files retain the exact bytes from the archives. No synthesis, transcoding, normalization, cropping, or pitch processing was applied to the files. Only selected audio and their License.txt files were extracted; archive shortcut files were not extracted or executed.

## Packs

- [RPG Audio](https://kenney.nl/assets/rpg-audio) — Kenney Vleugels (Kenney.nl); CC0; bundled license: `dist/audio/kenney-rpg/License.txt`.
  Original download endpoint: `https://kenney.nl/download-link/6173736574732f7270672d617564696f`. It returns a short-lived signed URL after visiting the public asset page. Download archive: `kenney_rpg-audio.zip`; SHA-256: `6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b`.
- [Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds) — Kenney (www.kenney.nl); CC0; bundled license: `dist/audio/kenney-impact/License.txt`.
  Original download endpoint: `https://kenney.nl/download-link/6173736574732f696d706163742d736f756e6473`. It returns a short-lived signed URL after visiting the public asset page. Download archive: `kenney_impact-sounds.zip`; SHA-256: `029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8`.

Raw archives and a machine-readable audit catalog are retained in `.local/audio-source/` and are not required at runtime.

## Playback notes

- Gain hints below are linear per-clip multipliers before the application master volume; they are conservative starting points, not listening-approved final mixes.
- Native RPG recordings are 48 kHz stereo; Impact recordings are 44.1 kHz stereo. Web Audio can decode/resample them to its context rate.
- The paperweight contact uses `impactMetal_light_000.ogg` and `impactMetal_light_001.ogg`, copied unchanged from the same CC0 Kenney Impact Sounds archive. Their SHA-256 values are `33b5e6e37c6e9d54e07bf5a89b12c76e879f40c1ea83cdd82714df1d6f9fec6d` and `fba69c467ddd85da7b1d82e259f936b876d9ba6a3d6f1b24bdd10468e46bfe08`.
- Some original Vorbis files decode to peaks above 0 dBFS. Apply clip gain in floating-point Web Audio before output; do not treat all source files as equally loud. The runtime should also limit overlapping voices and avoid accumulating a click sound on top of each material sound.
- `bookFlip1/2/3` provide three recorded paper gestures. Keep variants and timing separate from leather cover handling, binding pulls, wood contacts, and stamps.
- `doorOpen_1`, `doorClose_2`, and `creak1/2/3` are cabinet/wood movement candidates; the source pack does not identify a dedicated drawer recording. Their suitability for drawers requires listening in the application. Do not describe them as recordings of drawers.
- No actual quill-writing recording is included; the additional section documents pencil-on-cardboard excerpts. Metal, coins, weapons, and heavy wooden impacts were deliberately excluded from this desk selection.
- Signal measurements below were computed with libsndfile (Python soundfile) and NumPy from decoded audio. RMS covers the entire native clip, including any quiet tail. This import was checked programmatically; no claim of subjective listening is made.

## Imported files

Every runtime filename preserves its original basename. Original archive member names are shown explicitly.

| Runtime file | Original archive member | Duration (s) | Peak (dBFS) | RMS (dBFS) | Gain hint | Material/use hint |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `dist/audio/kenney-rpg/bookFlip1.ogg` | `Audio/bookFlip1.ogg` | 0.769 | 0.47 | -29.79 | 0.32 | Long page lift or unfold |
| `dist/audio/kenney-rpg/bookFlip2.ogg` | `Audio/bookFlip2.ogg` | 0.430 | -8.27 | -37.01 | 0.75 | Page slide or short page turn |
| `dist/audio/kenney-rpg/bookFlip3.ogg` | `Audio/bookFlip3.ogg` | 0.231 | -4.56 | -32.13 | 0.50 | Quick page flick or paper release |
| `dist/audio/kenney-rpg/bookOpen.ogg` | `Audio/bookOpen.ogg` | 0.154 | -11.54 | -33.65 | 0.70 | Book or folio hinge opening |
| `dist/audio/kenney-rpg/bookClose.ogg` | `Audio/bookClose.ogg` | 0.231 | 0.86 | -18.74 | 0.14 | Book or folio closure |
| `dist/audio/kenney-rpg/bookPlace1.ogg` | `Audio/bookPlace1.ogg` | 0.277 | 0.76 | -17.99 | 0.13 | Heavy folio set down, variant 1 |
| `dist/audio/kenney-rpg/bookPlace2.ogg` | `Audio/bookPlace2.ogg` | 0.354 | 0.66 | -18.22 | 0.13 | Heavy folio set down, variant 2 |
| `dist/audio/kenney-rpg/bookPlace3.ogg` | `Audio/bookPlace3.ogg` | 0.261 | 1.01 | -17.41 | 0.12 | Heavy folio set down, variant 3 |
| `dist/audio/kenney-rpg/beltHandle1.ogg` | `Audio/beltHandle1.ogg` | 0.277 | -3.29 | -28.23 | 0.35 | Binding or cord grasp, variant 1 |
| `dist/audio/kenney-rpg/beltHandle2.ogg` | `Audio/beltHandle2.ogg` | 0.477 | -4.17 | -31.97 | 0.50 | Binding or cord grasp, variant 2 |
| `dist/audio/kenney-rpg/cloth1.ogg` | `Audio/cloth1.ogg` | 0.661 | -3.49 | -24.56 | 0.25 | Soft material sweep, variant 1 |
| `dist/audio/kenney-rpg/cloth2.ogg` | `Audio/cloth2.ogg` | 0.415 | -7.94 | -28.71 | 0.40 | Soft material sweep, variant 2 |
| `dist/audio/kenney-rpg/cloth3.ogg` | `Audio/cloth3.ogg` | 0.477 | -10.09 | -29.28 | 0.45 | Soft material sweep, variant 3 |
| `dist/audio/kenney-rpg/cloth4.ogg` | `Audio/cloth4.ogg` | 0.384 | -14.64 | -34.60 | 0.65 | Soft material sweep, variant 4 |
| `dist/audio/kenney-rpg/clothBelt.ogg` | `Audio/clothBelt.ogg` | 0.723 | -4.31 | -31.09 | 0.45 | Flexible binding pull, variant 1 |
| `dist/audio/kenney-rpg/clothBelt2.ogg` | `Audio/clothBelt2.ogg` | 0.753 | -6.69 | -31.17 | 0.45 | Flexible binding pull, variant 2 |
| `dist/audio/kenney-rpg/dropLeather.ogg` | `Audio/dropLeather.ogg` | 0.415 | -0.12 | -18.72 | 0.13 | Leather cover set down |
| `dist/audio/kenney-rpg/handleSmallLeather.ogg` | `Audio/handleSmallLeather.ogg` | 0.338 | -11.62 | -35.73 | 0.80 | Leather cover lift, variant 1 |
| `dist/audio/kenney-rpg/handleSmallLeather2.ogg` | `Audio/handleSmallLeather2.ogg` | 0.307 | -16.47 | -39.92 | 1.00 | Leather cover lift, variant 2 |
| `dist/audio/kenney-rpg/creak1.ogg` | `Audio/creak1.ogg` | 0.661 | -6.69 | -25.76 | 0.25 | Wooden movement detail, variant 1 |
| `dist/audio/kenney-rpg/creak2.ogg` | `Audio/creak2.ogg` | 0.830 | -7.04 | -25.98 | 0.25 | Wooden movement detail, variant 2 |
| `dist/audio/kenney-rpg/creak3.ogg` | `Audio/creak3.ogg` | 0.338 | -7.41 | -21.69 | 0.15 | Short wooden movement detail |
| `dist/audio/kenney-rpg/doorOpen_1.ogg` | `Audio/doorOpen_1.ogg` | 0.919 | 0.58 | -20.21 | 0.12 | Wooden cabinet movement candidate |
| `dist/audio/kenney-rpg/doorOpen_2.ogg` | `Audio/doorOpen_2.ogg` | 1.413 | 1.00 | -22.65 | 0.14 | Long wooden cabinet movement candidate |
| `dist/audio/kenney-rpg/doorClose_1.ogg` | `Audio/doorClose_1.ogg` | 0.675 | 1.29 | -17.26 | 0.10 | Wooden cabinet closure candidate |
| `dist/audio/kenney-rpg/doorClose_2.ogg` | `Audio/doorClose_2.ogg` | 0.612 | -2.41 | -18.84 | 0.13 | Wooden cabinet closure candidate |
| `dist/audio/kenney-rpg/doorClose_3.ogg` | `Audio/doorClose_3.ogg` | 0.714 | 1.40 | -13.07 | 0.06 | Loud wooden cabinet closure; use sparingly |
| `dist/audio/kenney-rpg/doorClose_4.ogg` | `Audio/doorClose_4.ogg` | 0.603 | 0.35 | -18.16 | 0.12 | Wooden cabinet closure candidate |
| `dist/audio/kenney-impact/impactWood_light_000.ogg` | `Audio/impactWood_light_000.ogg` | 0.266 | -1.12 | -22.31 | 0.20 | Small wooden tool return, variant 1 |
| `dist/audio/kenney-impact/impactWood_light_001.ogg` | `Audio/impactWood_light_001.ogg` | 0.266 | -0.94 | -24.06 | 0.25 | Small wooden tool return, variant 2 |
| `dist/audio/kenney-impact/impactWood_light_002.ogg` | `Audio/impactWood_light_002.ogg` | 0.266 | -1.12 | -22.09 | 0.20 | Small wooden tool return, variant 3 |
| `dist/audio/kenney-impact/impactWood_light_003.ogg` | `Audio/impactWood_light_003.ogg` | 0.266 | -0.93 | -23.75 | 0.25 | Small wooden tool return, variant 4 |
| `dist/audio/kenney-impact/impactWood_light_004.ogg` | `Audio/impactWood_light_004.ogg` | 0.266 | -1.19 | -24.72 | 0.25 | Small wooden tool return, variant 5 |
| `dist/audio/kenney-impact/impactWood_medium_000.ogg` | `Audio/impactWood_medium_000.ogg` | 0.333 | -1.03 | -22.60 | 0.28 | Wooden stamp contact, variant 1 |
| `dist/audio/kenney-impact/impactWood_medium_001.ogg` | `Audio/impactWood_medium_001.ogg` | 0.333 | -1.05 | -22.55 | 0.28 | Wooden stamp contact, variant 2 |
| `dist/audio/kenney-impact/impactWood_medium_002.ogg` | `Audio/impactWood_medium_002.ogg` | 0.333 | -1.08 | -22.62 | 0.28 | Wooden stamp contact, variant 3 |
| `dist/audio/kenney-impact/impactWood_medium_003.ogg` | `Audio/impactWood_medium_003.ogg` | 0.333 | -1.04 | -22.74 | 0.28 | Wooden stamp contact, variant 4 |
| `dist/audio/kenney-impact/impactWood_medium_004.ogg` | `Audio/impactWood_medium_004.ogg` | 0.333 | -1.13 | -22.16 | 0.28 | Wooden stamp contact, variant 5 |
| `dist/audio/kenney-impact/impactSoft_medium_000.ogg` | `Audio/impactSoft_medium_000.ogg` | 0.118 | -0.96 | -14.33 | 0.08 | Damped contact under paper, variant 1 |
| `dist/audio/kenney-impact/impactSoft_medium_001.ogg` | `Audio/impactSoft_medium_001.ogg` | 0.183 | -0.93 | -14.92 | 0.09 | Damped contact under paper, variant 2 |

## Imported-file checksums

| Runtime file | SHA-256 |
| --- | --- |
| `dist/audio/kenney-rpg/bookFlip1.ogg` | `fa81ac2fedc8c641661b87e349630a36c9800e795e0c800e029214efdbe26a7d` |
| `dist/audio/kenney-rpg/bookFlip2.ogg` | `3409042acbfaebc24c1a6327dc073e36f9250841712e96c5040da566a97df73c` |
| `dist/audio/kenney-rpg/bookFlip3.ogg` | `c85db5dceb3f1df073e960630277eaa88a5afda0477c1ddd68dad707621767be` |
| `dist/audio/kenney-rpg/bookOpen.ogg` | `953390534377222bee89ac8cd9e60a58fdc037c71a4d7c18c43cd647c7f34ba8` |
| `dist/audio/kenney-rpg/bookClose.ogg` | `81e976532565f4372abd14e83d2684195fa548d0a28d345de221e56052454f32` |
| `dist/audio/kenney-rpg/bookPlace1.ogg` | `26f3ce60fbde85b678b0ad7f6624d80535fe540d88232ad1e38e47a96662d977` |
| `dist/audio/kenney-rpg/bookPlace2.ogg` | `831874e8fd142d4d0a03ff009f1f83966338a7878c0f6f38c613ae5b80dd731e` |
| `dist/audio/kenney-rpg/bookPlace3.ogg` | `b1afa711e1cabfe5b2c56e20e20e0f9d82142d067727447fa992ddc43dbdb06e` |
| `dist/audio/kenney-rpg/beltHandle1.ogg` | `2ef665bd8b65dbe669f4560be38a6d8f04a162e618b15a49e3e71b58e558aab0` |
| `dist/audio/kenney-rpg/beltHandle2.ogg` | `f3b692d5c83263c25bce779805b212dbab515d18a603c695fc6a1e8650cf5366` |
| `dist/audio/kenney-rpg/cloth1.ogg` | `ddb93a3671233f95da0e0b10367f082f7eb42fa6caaddcf776410aa8833c747d` |
| `dist/audio/kenney-rpg/cloth2.ogg` | `8a7451193c38bc05483aec25dd193e163a15d44cf7fff04ac7912573231b0201` |
| `dist/audio/kenney-rpg/cloth3.ogg` | `a48632d17a4f1416541d261a32a31612e01267144c407fa3ecab3ff410f0085b` |
| `dist/audio/kenney-rpg/cloth4.ogg` | `e7ab9a6c4466dea874196c61f59bf1da05cfe58748f42fadd695d441a154a99b` |
| `dist/audio/kenney-rpg/clothBelt.ogg` | `f29560a2aea95bbfeb643e1e8f56ec2b6f7e32f32ce4e140645a36db81de3253` |
| `dist/audio/kenney-rpg/clothBelt2.ogg` | `d545b1d9f20e6188140aaf551a96f1e82fe0d15f7ca066fac8b065e1231e0038` |
| `dist/audio/kenney-rpg/dropLeather.ogg` | `097e1d3b74949b0145fda0519d40b7e0773ab82ec4858727f95be830927e1a45` |
| `dist/audio/kenney-rpg/handleSmallLeather.ogg` | `ae3cbf695aa0a8b98b5a80a835be5a3ccbd5446a24db2235cd4c3cd6fc92ed96` |
| `dist/audio/kenney-rpg/handleSmallLeather2.ogg` | `a66f6db5918ad016c28a9f2768f127a7f39b5fa04481e5a3b4e78ebe2a1c282d` |
| `dist/audio/kenney-rpg/creak1.ogg` | `8a346186fd297254248cab8e8117060a52a5cf2a84f603153a762108550ea95e` |
| `dist/audio/kenney-rpg/creak2.ogg` | `8a990afdc03aebb91d528f5385e2f95582dbfa8e2c12c71098ab01be9142294a` |
| `dist/audio/kenney-rpg/creak3.ogg` | `f9638787f95004b9d2d06f8eff8e99d4e594c21b51947daf562856fbcec905d1` |
| `dist/audio/kenney-rpg/doorOpen_1.ogg` | `4ab93bab96522d8eb109ff96dc57cb6765deb02448fe14c10472084be5bb2a0b` |
| `dist/audio/kenney-rpg/doorOpen_2.ogg` | `68962fb0458c9bac59dec3adefa9849703c7c89d34712de03dd0075d095e79e9` |
| `dist/audio/kenney-rpg/doorClose_1.ogg` | `834d29c60a8a8bfb50b158cdb6b7dfa8f02812a408a1ee9703d038dfab0b1aeb` |
| `dist/audio/kenney-rpg/doorClose_2.ogg` | `4aa4fe79836c53cd6d0cb0b22ddc33b9901429463ae1bb75131f072683f63f21` |
| `dist/audio/kenney-rpg/doorClose_3.ogg` | `d0a2540e5e1639bc2fbeef34e76f28e9f9cb8a151736a0ac4c13859994328d0e` |
| `dist/audio/kenney-rpg/doorClose_4.ogg` | `fd21c0e7a9d0317375d2561590f0770dd3380ee35507d064862cb44d6f71595b` |
| `dist/audio/kenney-impact/impactWood_light_000.ogg` | `eb45e35b4bed784d3f120de4afec4b0d6ac09d9e143cce8cfcb7d739e1b1f3c3` |
| `dist/audio/kenney-impact/impactWood_light_001.ogg` | `4b76bf3ccc8e60d19188f3165b778a7817786faa6887c55d9049bcbeef3b425f` |
| `dist/audio/kenney-impact/impactWood_light_002.ogg` | `b183cf7a5bd783817e0e4b82af34ac6658fa1927049089dadc8b15c2ecc771dc` |
| `dist/audio/kenney-impact/impactWood_light_003.ogg` | `cdfbe8af2fe7ff9ee28f337a0a989deee0f327620da456c8413644880e9d0004` |
| `dist/audio/kenney-impact/impactWood_light_004.ogg` | `e10009f67ddaeb3a59a3e1129cfc1615d84ba60ab578eae07e7092ac223f099c` |
| `dist/audio/kenney-impact/impactWood_medium_000.ogg` | `1723a9fd25103ed41af06054814e84e65f4a772bac86ab2dc927da93d9592ff5` |
| `dist/audio/kenney-impact/impactWood_medium_001.ogg` | `15271dbe8e2872dbb0ff1aeb7b12b2d2b92b7c1951c88532b9ab9158c36dfc73` |
| `dist/audio/kenney-impact/impactWood_medium_002.ogg` | `3f3f1917428b828f733a963167833c707bf88296ff158e1559c57c5cb813d799` |
| `dist/audio/kenney-impact/impactWood_medium_003.ogg` | `635c37cfcd854b187d643d450ff0397798dcc29ae94da32192b814fae6bd854c` |
| `dist/audio/kenney-impact/impactWood_medium_004.ogg` | `7ba48f2f99c91c71be420841a91f1e69c0cbc4fe887fcd7213144d67bb87b13a` |
| `dist/audio/kenney-impact/impactSoft_medium_000.ogg` | `7d3ba0bb5e60a11b5d3e558c141303dcf494256675fbf753c0d252d2cf0481e3` |
| `dist/audio/kenney-impact/impactSoft_medium_001.ogg` | `7642a4fd43e547afe4f7adfadb3dabb681c0ff512f52c1674bae30a726841faf` |

## Additional paper and writing recordings

Eight runtime WAV assets supplement the Kenney library. Each author page explicitly declares Creative Commons 0. These use public HQ MP3 previews published in Freesound’s share links; no account or original-download endpoint was used. The paper sources are real paper recordings, and the writing source is pencil on cardboard, not a recording of a quill.

Paper flips provide a dedicated pickup pool; Paper slide provides a physically distinct sliding source. Native Kenney book flips remain available for unfolding. The three writing snippets were selected using signal energy and frequency measurements; their material suitability still needs listening in the application.

| Runtime file | Source / author | Public preview | Duration (s) | Peak / RMS (dBFS) | Gain hint |
| --- | --- | --- | ---: | --- | ---: |
| `dist/audio/freesound/paperFlip1.wav` | [paper flip 1.wav](https://freesound.org/people/gynation/sounds/82377/) by gynation | [82377_605154-hq.mp3](https://cdn.freesound.org/previews/82/82377_605154-hq.mp3) | 0.438 | -4.60 / -29.08 | 0.425 |
| `dist/audio/freesound/paperFlip2.wav` | [paper flip 2.wav](https://freesound.org/people/gynation/sounds/82378/) by gynation | [82378_605154-hq.mp3](https://cdn.freesound.org/previews/82/82378_605154-hq.mp3) | 0.420 | -3.60 / -30.09 | 0.379 |
| `dist/audio/freesound/paperFlip3.wav` | [paper flip 3.wav](https://freesound.org/people/gynation/sounds/82379/) by gynation | [82379_605154-hq.mp3](https://cdn.freesound.org/previews/82/82379_605154-hq.mp3) | 0.500 | -6.60 / -34.51 | 0.534 |
| `dist/audio/freesound/paperScrape.wav` | [paper scrape 1.wav](https://freesound.org/people/gynation/sounds/82383/) by gynation | [82383_605154-hq.mp3](https://cdn.freesound.org/previews/82/82383_605154-hq.mp3) | 0.563 | -4.17 / -29.88 | 0.404 |
| `dist/audio/freesound/paperSlide.wav` | [Paper slide](https://freesound.org/people/Kingofgamers_cz/sounds/352914/) by Kingofgamers_cz | [352914_1766783-hq.mp3](https://cdn.freesound.org/previews/352/352914_1766783-hq.mp3) | 0.550 | -13.14 / -44.42 | 0.650 |
| `dist/audio/freesound/pencilScratch1.wav` | [Pencil Scratch 1](https://freesound.org/people/OwlStorm/sounds/320151/) by OwlStorm (Ashe Kirk / Owlish Media) | [320151_140737-hq.mp3](https://cdn.freesound.org/previews/320/320151_140737-hq.mp3) | 0.300 | -14.92 / -31.06 | 0.571 |
| `dist/audio/freesound/pencilScratch2.wav` | [Pencil Scratch 1](https://freesound.org/people/OwlStorm/sounds/320151/) by OwlStorm (Ashe Kirk / Owlish Media) | [320151_140737-hq.mp3](https://cdn.freesound.org/previews/320/320151_140737-hq.mp3) | 0.270 | -15.51 / -31.06 | 0.571 |
| `dist/audio/freesound/pencilScratch3.wav` | [Pencil Scratch 1](https://freesound.org/people/OwlStorm/sounds/320151/) by OwlStorm (Ashe Kirk / Owlish Media) | [320151_140737-hq.mp3](https://cdn.freesound.org/previews/320/320151_140737-hq.mp3) | 0.240 | -17.41 / -31.06 | 0.571 |

### Processing and checksums

- `dist/audio/freesound/paperFlip1.wav`: Decoded the published HQ MP3 preview to 16-bit PCM WAV; no other processing.
  Output SHA-256: `7acecfda1646a4212bf4ccb857fc6df3f8d17065725de13c726e3174bbfc20ce`. Source preview SHA-256: `6b2582c6f8b8493834737c2579c6c8da82d91f2a372d2f88ba473a6c7ddda482`.
- `dist/audio/freesound/paperFlip2.wav`: Excerpt 0.08–0.50 s of published HQ MP3; 6 ms edge fades; encoded 16-bit PCM WAV. No normalization, filtering, or pitch processing.
  Output SHA-256: `67898f03dc391e66619b0099001f2a75d2b6cec2d0c6ee3681565e1e8a105369`. Source preview SHA-256: `14243a6f8604193a11b61f452c99572d49139215c6447d3fdab46fdfb4126ef2`.
- `dist/audio/freesound/paperFlip3.wav`: Decoded the published HQ MP3 preview to 16-bit PCM WAV; no other processing.
  Output SHA-256: `005482ebdda2f78825e7ca91cda5054ef9e8da6f0aa8f8418fccefe1e21a9262`. Source preview SHA-256: `da370dab1b8f043c1d2a41d75f6f25e015a38b5a09514410b2e70d9a26990f61`.
- `dist/audio/freesound/paperScrape.wav`: Decoded the published HQ MP3 preview to 16-bit PCM WAV; no other processing.
  Output SHA-256: `17721b3f1ba381525c437b10712ac0a35df43c284f80f2739d72887be0e5fa93`. Source preview SHA-256: `5d2fd1f570fc5a8278d3dc195157e774475a9a2191468835d5cc990ad8eea95d`.
- `dist/audio/freesound/paperSlide.wav`: Excerpt 0.25–0.80 s of published HQ MP3; 6 ms edge fades; encoded 16-bit PCM WAV. No normalization, filtering, or pitch processing.
  Output SHA-256: `5161809c624d72a72229fe84f1bee7aa3b92d29a069c624148ada5e8da96c56d`. Source preview SHA-256: `87adc8b85c0b51fefc43280186d5e0fb455eb75dc6e521dd87c3352b7b8aed92`.
- `dist/audio/freesound/pencilScratch1.wav`: Excerpt 16.50–16.80 s of published HQ MP3; 220 Hz second-order high-pass; 6 ms edge fades; scaled to at most -14 dBFS peak and -31 dBFS RMS; encoded 16-bit PCM WAV.
  Output SHA-256: `5b0938d540b8c759b5c647acdf0afea3eb9d9ffabcdb19f3fdcf79f8e9b03b43`. Source preview SHA-256: `51e3f640a4ded6246060df9686848c69ef9c315599371c32e31c93ad14cbbfc5`.
- `dist/audio/freesound/pencilScratch2.wav`: Excerpt 22.50–22.77 s of published HQ MP3; 220 Hz second-order high-pass; 6 ms edge fades; scaled to at most -14 dBFS peak and -31 dBFS RMS; encoded 16-bit PCM WAV.
  Output SHA-256: `245891b2166067d2fb74852a96435a3400d377b032f42f277427dff824cfa977`. Source preview SHA-256: `51e3f640a4ded6246060df9686848c69ef9c315599371c32e31c93ad14cbbfc5`.
- `dist/audio/freesound/pencilScratch3.wav`: Excerpt 27.30–27.54 s of published HQ MP3; 220 Hz second-order high-pass; 6 ms edge fades; scaled to at most -14 dBFS peak and -31 dBFS RMS; encoded 16-bit PCM WAV.
  Output SHA-256: `b136e3a21123939f93ffb319e810e12af6b4770ef547871611b86302e4dee669`. Source preview SHA-256: `51e3f640a4ded6246060df9686848c69ef9c315599371c32e31c93ad14cbbfc5`.

### Stamp onset measurements

The five `impactWood_medium_000` through `004` samples cross 1% of their individual peak at 0.02 ms. Their maximum peaks occur at 1.70, 1.75, 1.68, 1.59, and 1.86 ms respectively. A 2 ms RMS window reaches 20% of its maximum at the start of each sample, so no initial-silence offset is needed for stamp-contact synchronization.


## Wooden drawer slide replacement

[Drawer Opening + Closing 1](https://freesound.org/people/HECKFRICKER/sounds/803213/) by HECKFRICKER, CC0 1.0. The source describes repeated wooden drawer opening/closing, wood on wood with no rails. Source page license verified and saved as `.local/audio-source/drawer-source.html`. Public HQ preview: https://cdn.freesound.org/previews/803/803213_12863902-hq.mp3 .

Replaces the runtime creak/door samples for both drawer actions with three opening and three closing excerpts. Edited to retain sliding friction and soften isolated contact peaks. No subjective listening verification was available.

- `dist/audio/freesound/drawerSlideOpen1.wav`: Excerpt 0.40-1.12s; mono mix; 90Hz highpass; soft transient limiting; 25ms edge fades; level matched with peak headroom; PCM16 WAV. Duration 0.72s; peak -12.13dBFS; RMS -26.0dBFS; SHA-256 `b54c4d4eac5a99f05c7ba991dc3f7f489ebe2c419c531d9c131b9acbaac37112`.
- `dist/audio/freesound/drawerSlideOpen2.wav`: Excerpt 4.80-5.54s; mono mix; 90Hz highpass; soft transient limiting; 25ms edge fades; level matched with peak headroom; PCM16 WAV. Duration 0.74s; peak -14.89dBFS; RMS -26.0dBFS; SHA-256 `00c10b58f3efec55ac0d9d146c9544f6365284928d04de42732d5f8d4f8640a2`.
- `dist/audio/freesound/drawerSlideOpen3.wav`: Excerpt 9.20-9.88s; mono mix; 90Hz highpass; soft transient limiting; 25ms edge fades; level matched with peak headroom; PCM16 WAV. Duration 0.68s; peak -15.68dBFS; RMS -26.0dBFS; SHA-256 `d49e6d3c61bb573e1df050fc397123da75544daf40cdc48a2436c7407fb69431`.
- `dist/audio/freesound/drawerSlideClose1.wav`: Excerpt 2.24-3.24s; mono mix; 90Hz highpass; soft transient limiting; 25ms edge fades; level matched with peak headroom; PCM16 WAV. Duration 1.00s; peak -16.32dBFS; RMS -26.0dBFS; SHA-256 `767a63254726eef30b9aaae17074c2af74a91fcbdacc0f9d28bb5cba519e7270`.
- `dist/audio/freesound/drawerSlideClose2.wav`: Excerpt 6.80-7.62s; mono mix; 90Hz highpass; soft transient limiting; 25ms edge fades; level matched with peak headroom; PCM16 WAV. Duration 0.82s; peak -17.09dBFS; RMS -26.0dBFS; SHA-256 `f8c763b3e57b64750b390537b613b798c6cf6daaba67e4abaa2f676266756535`.
- `dist/audio/freesound/drawerSlideClose3.wav`: Excerpt 10.86-11.84s; mono mix; 90Hz highpass; soft transient limiting; 25ms edge fades; level matched with peak headroom; PCM16 WAV. Duration 0.98s; peak -17.09dBFS; RMS -26.0dBFS; SHA-256 `3e189e7f40e684e233e2560b8fdf522e3132fcd9f9b8b9228ea98b0bf141eea6`.

Source SHA-256: `8b4b03d472b67b97034549f25db65324cdc6350eb65d9c8eea1bf4e7dc2f6d5c`.
