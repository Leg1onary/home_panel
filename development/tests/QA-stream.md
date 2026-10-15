# Home Panel 1.0.3: live camera QA

## 1.0.4 regression checks

- Native canPlayType advertises "maybe", but HLS.js/MSE must be selected; source must be a blob and video clock advance.
- HLS.js unsupported but native available: native fallback plays.
- Both unsupported: explicit capability error, no upstream session creation.
- Simulated MediaError 3: one recoverMediaError call, playback resumes; second error fails with engine/codec/resolution/code rather than retry loop.
- Stream status does not include source URLs or tokens.
- Same actual video, default engine, stop/restart/snapshot, desktop/mobile fit, missing modern APIs.
- The reported real-camera green flicker is not reproduced by the fixture; actual resolution/decoder/browser remain to be confirmed by user.

## Coverage

- «Двор» in room list: opens camera modal and auto-starts only a verified installed camera in live mode.
- Watch camera card: same player; planned cameras remain disabled.
- Video: fMP4 H.264 HLS from a local fake HA with real WS authentication and actual video decoding in Chromium.
- Controls: stop removes video and closes session; restart plays again; fullscreen enters/exits; snapshot stops playback and fetches one image.
- Closing: modal close and close-during-start do not resurrect player. Hidden page stops playback; stale server sessions expire.
- Compatibility: Chrome64 build target retained; main boot and video tested with modern APIs removed. Not a real legacy Android/WebView test.
- Failure states: missing HLS support; failing playlist; unverified camera; planned camera; invalid session; invalid upstream URL and malicious playlist URI.
- Security: proof required for session creation/deletion; session tied to profile/binding; cross-site HLS rejected; bounded playlists/segments; no arbitrary URLs, HA token or HA HLS capability in response.
- Layout: desktop 1280×800 and mobile 375×812, dark/light, no horizontal overflow; video contains image, controls remain visible.
- Persistence: unchanged schema and slug; existing integration and addon suites verify restart persistence of theme, favorites and bindings.

## Test boundaries

Fixture videos are generated under `/tmp`, never shipped. No access to user's LAN, real Tapo feed, actual Supervisor WS proxy or old Fully binary from this sandbox. HA official stream endpoints and Supervisor path were checked against docs/source; actual setup must be verified after update.
