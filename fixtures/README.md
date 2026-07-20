# Fixtures Boundary

Fixtures remain retained test data only. They are useful for regression tests,
negative controls, and preserved historical artifacts, but they are not authoritative product definitions.

The EvoBuddy product authority for bundled Buddies is the preset source under
`src/presets/buddies/<buddy>/BUDDY.md` plus preset registry metadata in
`src/presets/buddies/registry.json`. Product setup seeds those preset sources
into `.evobuddy/`; tests that need retained fixture profiles must reference
`fixtures/` explicitly.
