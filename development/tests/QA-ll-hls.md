# Camera LL-HLS regression · 1.0.11

## Why the previous fixture was insufficient

The finite test playlist had complete one-second fragments and `EXT-X-ENDLIST`. It tested decoding and proxy safety, not a live edge, partial segments, preload hints or blocking reloads. Home Assistant emits a different playlist when LL-HLS is enabled ([HLS views](https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant/components/stream/hls.py)).

The panel forced `lowLatencyMode:false`. The HA HLS player enables it for one or two streams, uses a 60-second back buffer, 30-second loading timeouts and a maximum live-sync playback rate of 2 ([HA frontend](https://raw.githubusercontent.com/home-assistant/frontend/dev/src/components/ha-hls-player.ts)). Version 1.0.11 follows that profile instead of adding more custom whole-segment buffer overrides.

## Test fixture

`tests/ll-hls-fixture.mjs` serves a rolling three-complete-segment window, an in-progress segment, one-second parts, six-second full segments, `EXT-X-START:-2`, preload hints and blocking `_HLS_msn`/`_HLS_part` reloads. Availability follows wall time; the fixture starts with twenty parts. It uses only generated test-pattern H.264.

Example media generation:

```sh
mkdir -p /tmp/homepanel-hls/segment
ffmpeg -f lavfi -i testsrc2=size=640x360:rate=25 -t 60 -an \
  -c:v libx264 -preset ultrafast -g 25 -keyint_min 25 -sc_threshold 0 -bf 0 \
  -f hls -hls_time 1 -hls_list_size 0 -hls_segment_type fmp4 \
  -hls_segment_filename '/tmp/homepanel-hls/segment/%d.m4s' \
  /tmp/homepanel-hls/playlist.m3u8
HLS_FIXTURE=/tmp/homepanel-hls node tests/ll-hls-fixture.mjs
```

Use a separate panel test runtime on port 3154 with `HA_URL=http://127.0.0.1:3155`, `HA_TOKEN=mock-test-only` and a temporary `PANEL_DATA`. Bind the test camera to `camera.qa_yard`. Never point the fixture at real camera files or production storage. The fixture has test-only reset/statistics routes and is not packaged in the add-on.

## A/B observation

Both cases used the same HLS.js version, progressive panel proxy, generated media, Chromium software renderer and reset fixture clock. Each was sampled for twenty seconds.

| Observation | Old 1.0.10 profile | HA-style LL profile |
|---|---|---|
| HLS errors | Two `bufferStalledError`, nonfatal | None |
| Requests | Four whole segments, zero parts | Zero whole segments, 23 parts |
| Blocking playlist requests | Three | 21 |
| First samples | Playback held at 18 s, readyState 1 | Clock advancing, readyState 4 |
| Forward buffer | Cycles from about 6 s toward 1 s | About 1–2 s, continuously replenished |
| Raw waiting events including startup | Three | Three |

The startup waiting-event counts must not be presented as elimination of all waiting events. A short LL-HLS buffer is not automatically unhealthy: continuity and replenishment matter.

## Scope

The test reproduces a policy-dependent buffering difference, not the user's actual green Tapo frames. The actual HA camera card might use a different playback transport; it has not been inspected. Long-duration operation, real 1080p/Main-profile camera data and the old Android decoder still need owner acceptance.

After updating, the panel reports detected `LL-HLS` or ordinary `HLS`, part count, buffer ahead, stalls after first playback and frame drops. The last HLS error is explicitly labelled historical. An LL-capable player continues to accept ordinary HLS playlists without a manual mode change.
