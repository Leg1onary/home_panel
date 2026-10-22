# Home Panel 1.3.0 acceptance

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
