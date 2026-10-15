# Camera regression: buffered LL-HLS · 1.0.13

## Hypothesis and scope

The owner's real 1080p Tapo stream continues to stutter with the 1.0.11 HA-style profile, even after selecting the native TP-Link camera entity. Matching HA's HLS options does not establish that HA's camera card uses the same transport.

The panel's previous configuration allowed up to 2x playback catch-up. Its small live-edge cushion can empty under bursty delivery. The new profile intentionally trades latency for continuity: LL-HLS parts remain enabled, target live delay is eight seconds, playback catch-up is disabled, and maximum latency before live resynchronization is thirty seconds.

HLS.js uses `EXT-X-START` for initial playback before its ordinary live-sync fallback. A playlist-only loader strips this single start hint so that a server-supplied one-to-two-second offset does not defeat the intended initial cushion. No media bytes, playlist resource addresses, part tags, blocking reload parameters or backend security rules are changed.

Relevant implementation references: [HA's HLS player](https://raw.githubusercontent.com/home-assistant/frontend/dev/src/components/ha-hls-player.ts), [HLS.js latency controller](https://github.com/video-dev/hls.js/blob/v1.6.16/src/controller/latency-controller.ts), [HLS.js stream controller](https://github.com/video-dev/hls.js/blob/v1.6.16/src/controller/base-stream-controller.ts).

## QA inventory

- Assert seconds-based delay, 1x catch-up cap, preserved LL-HLS and bounded retries.
- Assert narrow removal of the start hint with CRLF, LF and final-line input.
- Assert playlist callback metadata and binary payloads remain intact.
- Compare old/new profiles through the same real panel proxy, fixture and HLS.js library, with the fixture clock reset between cases.
- Exercise the actual panel's camera open/stop flow, inspect rate/latency status, and check desktop/mobile layout.
- Keep generated fixtures and QA routes out of the production app.

## Observed A/B result

The isolated fixture releases four seconds of generated video at once, every four seconds. Each profile was sampled once per second for thirty seconds in Chromium. This deliberately stresses jitter tolerance; it is not a recording of the owner's camera.

| Metric | Previous HA-style profile | Buffered LL-HLS |
|---|---:|---:|
| Nonfatal `bufferStalledError` events | 3 | 0 |
| Waiting events after first playback | 3 | 0 |
| Minimum sampled forward buffer | 0.017 s | 4.209 s |
| Maximum sampled playback rate | 1.30x | 1.00x |
| Final dropped / total video frames | 4 / 703 | 0 / 749 |
| Part loads | 31 | 36 |
| Final estimated live latency | 4.07 s | 8.11 s |

Results support the jitter-tolerance change, not a claim that the real camera's green artifacts or decoder limitations are fixed. The test media is synthetic and lower-resolution than the owner's 1920×1080 feed. The target delay is not an end-to-end latency guarantee.

## Reproduction

Generate the media as documented in `QA-ll-hls.md`. Start the fixture with `HLS_FIXTURE=/tmp/homepanel-hls HLS_BURST=1 node tests/ll-hls-fixture.mjs`; the optional `PORT` variable changes its listening port.

Start a separate panel runtime pointing only to this fake HA and temporary preferences, bind the test camera, and serve `camera-browser.html` plus `src/camera-policy.js` as QA-only routes using browser request interception. Do not add either route to the production server. Reset the fixture and reload the harness before each run so an asynchronous start cannot satisfy a wait using the previous run's samples.

## Owner acceptance

After updating, reload the panel and open Yard. Confirm “стабильный режим” and “скорость 1.00×”; sample the diagnostics after 60–90 seconds. Check continuity, actual color artifacts, buffer, stalls and frame losses on the same device/connection used for HA. Existing bindings do not require another confirmation.

## Owner clarification and final panel checks

Before release, the owner reported that HA also stutters when opening the camera through the Yard/security view, while the view opened from the TP-Link integration's device page works. Both screenshots use the same friendly title; neither establishes the entity ID or the actual playback transport. The failing screenshot shows a timeline and a black video area, while the working screenshot shows the yard.

The owner subsequently confirmed the same `camera.dvor_kamera_dvor_live_view` entity in both HA dialogs and reported that both HA views had stopped lagging; the installed panel was still unchanged. This removes the entity-mismatch hypothesis. It does not establish the transport used by the HA dialogs or prove the panel's upcoming fix solves the real camera.

The actual panel was then opened using its stable `data-camera` control. Playback advanced beyond 25 seconds of media time, used LL-HLS parts, stayed at 1.00x with approximately eight seconds of estimated latency, and reported zero stalls. Stop removed playback and displayed the stopped message. Desktop and narrow 390×844 screenshots were inspected; no horizontal overflow or clipped camera controls was observed.

An additional panel composition check found 42 dropped / 323 total frames with the existing full-screen backdrop blur. Repeating on the same synthetic fixture without that blur produced 0 / 327 dropped frames, zero stalls, rate 1.00x and estimated latency 8.2 seconds. The camera overlay now uses plain darkening, with blur preserved for unrelated dialogs. These are individual sandbox observations, not a statistical benchmark or a guarantee for physical Android hardware.
