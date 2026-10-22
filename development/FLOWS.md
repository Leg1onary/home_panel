# Home Panel 1.4.0 acceptance

## 1.4.0 station hub acceptance

- Baseline: 1.3.1 station sheet only has music controls. Add Home/Music/Shopping/Signals in the existing station entry; do not add a seventh main navigation item or alter the model.
- Home: brief is composed from verified current HA state only; max100 characters fits cloud TTS. Text announcement, bounded timers, weather, My Wave use typed server-side allowlisted actions, never arbitrary services or URLs. Readback is not invented: accepted command != spoken / camera shown / timer started.
- Leave: explicit scope confirmation, only currently-on verified master-light lines, pause music if supported, then brief. No locks, water, security or arbitrary switches. Unknown lines must not be called off.
- Shopping: only todo.shopping_list, get_items response required, add and complete with HA readback. Synchronization is local-only and behind a complete destructive-effects confirmation; never automatic.
- Voice alerts run in the addon independently of browsers. Two leaks and two doors, one delivery per event, SQLite claim before sending, no retry on ambiguity, quiet hours22–08 Moscow for doors only. Auto voices require actual alice_state local marker and support; temporary volume is delegated to local YandexStation.
- New additive SQLite tables only; keep profile/settings v3/device model v1, existing bindings, camera, history, 8090. Durable request IDs prevent duplicate or ambiguous replay, also after restart.
- Test invalid payloads, off/demo/unverified/unsupported/cloud gating, no secret leaks, correct API session/origin policy, restart dedupe, door quiet hours, wet/dry rearm, no command on every UI poll, form drafts surviving polls, all four tabs, mobile/desktop dark/light, legacy controls, statistics and camera.
- All physical commands in QA target fake HA only. No claim that the owner's camera/account link, audio, shopping synchronization or alert audibility has been tested on-site.

### Observed 1.4.0 browser and runtime checks

- All six home tools, music play/pause readback, shopping add/complete/readback, explicit sync consent, saving signals, camera request consent, scoped leave with one known-on line and truthful accepted results passed against fake HA.
- Message and settings drafts survived repeated polls. 375×812 dark/light and 1440×900/1024×600 views have no horizontal overflow; long shopping labels wrap.
- With the browser context fully closed, cloud mode sent no alarm. Restoring local IDLE produced one leak announcement with temporary volume0.45. Backend restart while still wet produced no second announcement.
- An assistant action without API proof was rejected before service delivery. Existing climate detail→history, lights, sensors, systems, camera, settings and theme persistence remained functional; no page errors observed.

## 1.3.1 acceptance

- One numeric-state reader separates available HA values from last_changed, last_updated, last_reported and the panel poll time. 34 minutes, a day or no timestamp must not hide valid numeric state or fabricate a fresh report.
- Check climate cards, main pins, room readings, climate detail, well/attic facts and standby. Unknown/unavailable, wrong units, NaN, missing entity, unverified mapping and offline HA remain unavailable. Demo metadata stays labelled demo. Motion's 5-minute window is unchanged.
- Main: four compact facts replace redundant shortcuts; well/attic open provenance and filtered history. Light count opens actual known-on lines; unknown lines cannot be described as off. Room navigation works from the list; live polling refreshes it without sending commands.
- Preserve model, geometry, light/music controls, camera, statistics, settings and existing 39 bindings. Browser QA: 1024x600, 1440x900, 375x812, dark/light; no spoilers in progress messages.

### 1.3.1 observed checks

- Browser verified a 34-minute unchanged 26.9 °C with no last_reported; pin, detail, main facts and standby retain numeric readings. A missing timestamp with 0 °C remains available with unknown metadata, not a fabricated current report. Polling leaves original state timestamps unchanged and preserves disclosure state.
- Unavailable removes the climate pin; HA offline removes readings and cannot produce an all-lights-off claim. Known-on room list follows live state and links to that room. Well detail links directly to well history.

## 1.3.0 main flows and acceptance

- Home: preserve geometry, material batching, one floor surface per zone, camera fit, room picking, favorites, music, light master and theme. Add projected real-data pins, finite motion pulses and warm lit floors. No random particles or persistent WebGL loop.
- Terrace motion: enum detected expires after 5 minutes from last state/event update, NOT last_reported or polling time. Missing/offline/unknown remains unknown. Repeated on-event timestamp renews window. Native binary motion retains its explicit off/on semantics. Sheet shows last event, expiry and derived label.
- Statistics: dedicated navigation at desktop and mobile. 6h/24h/7d, temperature/humidity, room filter, hover/focus chart inspection, reload, event-type filter. Server reads only installed verified entities of the current profile. No commands.
- History: real HA API, no preview/demonstration curves presented as real. Recorder unavailable, no rows, invalid numeric readings and unavailable gaps have honest visible states. Bounded output/cache; changed binding changes scope/cache key.
- Read charts and event timeline, inspect light-line-hours with coverage, no electricity estimates. Abort/stale requests cannot overwrite a newly selected range; HA polling does not rebuild or refetch the statistics page.
- QA: 1440x900, 1024x600, 375x812, dark/light, reduced motion; orbit/zoom pins, 5-minute boundary, stale timestamp, offline, historical gaps, forbidden entity query, binding change, loading/error/empty. Run all prior flows and tests.

### Verification result

- Motion boundary, absent/future timestamps, one-hour age, report-vs-update distinction and native binary behavior covered by deterministic tests. Browser verified one-hour state, exact timestamp sheet and renewal on a fresh update.
- Browser: real fixture-backed History endpoint; 6h/24h/7d, both metrics, zone and event filters, keyboard cursor, reload, honest error/empty responses. Polling preserves the chart DOM and filters.
- Orbit, reset, room picking, theme persistence, controls and existing camera/HA safety suites retained. All sixteen suites pass, including built shared-chunk delivery and prohibition on arbitrary history entity queries.
- No commands sent to the owner's HA. Fixture data exists only under ignored `.qa`; production and preview never synthesize historical series.

- Home: large model, four navigation tabs, favorites/room selection, reset camera, clock and theme unchanged; no dry leak chips.
- Sensors: enum closed/open and dry/wet are normalized; unexpected values always unknown, never safe. Door and leak batteries are grouped by physical sensor.
- Alerts: top warning for unknown/missing/unavailable leak sensors; prominent top leak alert for wet/on; clears on dry/off. Visible from all pages, not only Home. Button opens the correct sensor.
- Station: in Corridor everywhere; main circle pauses/resumes directly; previous/next controls respect HA feature flags and verification; details show track, volume, and correct room. No automatic commands during migration.
- Inventory migration: v4 to v5 on a pre-existing SQLite profile; exact provided mappings update automatically in live mode. Preserve settings, custom non-curated mappings, camera config, photos, and 3D. Back up original profile. Remove only known phantom camera-motion mapping. Idempotent and no database schema rewrite.
- Settings: saved bindings/checkboxes persist across reload and room switching; all three new sensor mappings/batteries present; status/diagnostics reflect real states.
- Other views: Lights opens room controls; Sensors shows climate/logical groups/camera; Systems remains read-only. Camera modal opens correct live-view entity; no simulated physical commands.
- QA: 1440x900, 1024x600, 375x812, both themes; offline, unknown-enum, no-feature media, and wet->dry transitions. No horizontal clipping, no new console errors.
- Run all existing test suites plus enum, inventory migration, alert-state and station skip readback tests.
