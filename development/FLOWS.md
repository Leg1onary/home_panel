# Home Panel 1.2.6 acceptance

- Home: large model, four navigation tabs, favorites/room selection, reset camera, clock and theme unchanged; no dry leak chips.
- Sensors: enum closed/open and dry/wet are normalized; unexpected values always unknown, never safe. Door and leak batteries are grouped by physical sensor.
- Alerts: top warning for unknown/missing/unavailable leak sensors; prominent top leak alert for wet/on; clears on dry/off. Visible from all pages, not only Home. Button opens the correct sensor.
- Station: in Corridor everywhere; main circle pauses/resumes directly; previous/next controls respect HA feature flags and verification; details show track, volume, and correct room. No automatic commands during migration.
- Inventory migration: v4 to v5 on a pre-existing SQLite profile; exact provided mappings update automatically in live mode. Preserve settings, custom non-curated mappings, camera config, photos, and 3D. Back up original profile. Remove only known phantom camera-motion mapping. Idempotent and no database schema rewrite.
- Settings: saved bindings/checkboxes persist across reload and room switching; all three new sensor mappings/batteries present; status/diagnostics reflect real states.
- Other views: Lights opens room controls; Sensors shows climate/logical groups/camera; Systems remains read-only. Camera modal opens correct live-view entity; no simulated physical commands.
- QA: 1440x900, 1024x600, 375x812, both themes; offline, unknown-enum, no-feature media, and wet->dry transitions. No horizontal clipping, no new console errors.
- Run all existing test suites plus enum, inventory migration, alert-state and station skip readback tests.
