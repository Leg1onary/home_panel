# Native Home Assistant WebRTC bridge · 1.0.14

## Reason for the change

The owner reported that the same `camera.dvor_kamera_dvor_live_view` now works in both HA views, while the panel still alternates between apparently current and older frames. Their 1.0.13 diagnostic showed a 10.3-second buffer, 1.00x speed, 10.8-second estimated latency and `bufferSeekOverHole`. A large buffer therefore did not resolve their problem. The diagnostic alone does not prove the underlying camera PTS or explain the apparent alternating images.

The panel formerly requested HLS unconditionally. HA's camera component checks capabilities and can select WebRTC instead, so matching a subset of its HLS settings did not establish equivalent playback ([HA camera component](https://raw.githubusercontent.com/home-assistant/frontend/dev/src/components/ha-camera-stream.ts)). This release adds native capability negotiation and WebRTC signaling rather than another arbitrary buffer adjustment.

Protocol references: [HA camera frontend API](https://raw.githubusercontent.com/home-assistant/frontend/dev/src/data/camera.ts), [HA WebRTC player](https://raw.githubusercontent.com/home-assistant/frontend/dev/src/components/ha-web-rtc-player.ts), [Core signaling API](https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant/components/camera/webrtc.py).

## Architecture and limits

- The backend authenticates to the configured HA endpoint and sends only `camera/capabilities`, `camera/webrtc/get_client_config`, `camera/webrtc/offer` and `camera/webrtc/candidate`.
- Only the installed, verified camera binding in live mode is usable. The caller cannot supply an entity ID, HA endpoint, camera URL or arbitrary WS command.
- Browser signaling uses the existing panel HTTP API, not a browser HA token. HA session IDs remain internal. ICE configuration may contain legitimate TURN credentials needed by WebRTC; this is distinct from exposing HA authentication.
- WebRTC media uses the peer connection rather than the HLS proxy. Actual ICE connectivity, codec support and physical device behavior remain environment-dependent.
- Sessions have random 192-bit handles, owner checks, a 90-second inactivity limit, six-session cap, bounded payloads/candidate counts/events, and cleanup of WS requests.
- The browser uses recvonly audio/video transceivers, queues local candidates until HA reports its session, and queues remote candidates until an SDP answer is installed.
- No parallel HLS stream is started. Unsupported browsers/cameras or a 20-second startup timeout transition once to HLS; the fallback reason is visible. The explicit HLS button bypasses RTC.
- Closing or stopping removes tracks, clears srcObject, closes the peer and releases signaling; late-start responses also release their server session.

## QA inventory

- Server auth, capabilities, config filtering, scoped commands, offer subscription, candidate/answer events, cursor validation, duplicate-offer rejection, owner isolation, binding changes, expiry and close.
- HTTP CSRF and cross-site protection, route/query limits, verified-camera scope, no internal session IDs in responses.
- Browser ICE ordering, media attachment, stop-during-start, no simultaneous HLS, unsupported-browser and explicit HLS fallback.
- Real peer-to-peer generated-video test through the complete panel and HTTP-to-HA WS bridge, not just a fake RTCPeerConnection.
- Desktop and 390×844 camera controls, video fit, stop/restart/close, and fallback messages.

## Local browser reproduction

Start the LL-HLS fixture from `QA-ll-hls.md` on 3155 for fallback testing. Start `node tests/rtc-fixture.mjs` on 3165 and a test panel on 3164 with `HA_URL=http://127.0.0.1:3165`, `HA_TOKEN=rtc-fixture-only` and isolated temporary `PANEL_DATA`.

Open `http://127.0.0.1:3165/qa/peer` in a separate Chromium page. It creates a canvas capture stream with a moving marker and increasing frame counter; it never reads a camera, microphone or user file. Bind only `camera-yard` to `camera.qa_yard` in the temporary panel.

Open the camera through the actual panel UI. Confirm the WebRTC label, non-null video srcObject and advancing media time; fixture counters must show one offer and zero HLS stream calls. Stop and check that active fixture jobs return to zero. Test explicit HLS, then set `/qa/supported?value=0` on the local fixture and repeat auto startup to verify the labelled fallback. Restore support afterward. QA endpoints and fixtures are not packaged in the add-on.

Observed results: the initial actual-panel connection used one WebRTC offer and zero HLS requests, and media time subsequently advanced beyond 48 seconds. Stop returned active fixture jobs to zero. The manual HLS button played the generated LL-HLS fixture, and unsupported capability negotiation displayed “Резерв HLS: HA не предоставляет WebRTC для этой сущности”. On a final reload, forty presented-frame callbacks had media times increasing from 0.077 to 2.202 seconds with zero backwards steps. Desktop and narrow screenshots were inspected; controls and video fit without horizontal overflow. These tests use synthetic 640×360 video and do not establish compatibility with the physical camera's 1080p H.264 profile.

## Owner acceptance

Update to 1.0.14 and fully reload the page. Open Yard with the main live button, not the HLS reserve button. Report whether the status says WebRTC or “Резерв HLS” with its reason, and whether the physical camera timestamp advances continuously for 60–90 seconds.

Do not claim the real Tapo issue is solved based solely on synthetic tests. Do not install a second go2rtc app blindly: first use the capabilities and connectivity of the existing HA system.
