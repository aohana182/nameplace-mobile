# Project Memory — nameplace-mobile

### 2026-06-11 14:00 — Code review, type fixes, maps decision

**What:** Full code review of v1. Fixed: 50 TS errors (`npx tsc --noEmit` now clean), removed no-op `userId` writes (field was never declared on models nor in the production schema — nothing was being persisted; tests passed vacuously because `mockSchema.ts` had `user_id` columns the production schema lacks), typed `PinTag` relations as `Relation<Pin>`/`Relation<Tag>`, aligned mock schema with production, raised GPS timeout 5s→10s per PRD R1.2.

**Why:** Babel strips types so the app ran despite a broken type-check; the phantom `userId` would have misled the v2 sync work into assuming user scoping already existed.

**Decisions:**
- Maps: stay with Google Maps (`react-native-maps` + `PROVIDER_GOOGLE`) for best UX; MapLibre/OpenFreeMap considered and rejected (thinner POI data, weaker Hebrew labels). Avi chose Google despite the GCP billing-account requirement.
- `user_id` arrives properly in v2 via schema v3 migration, not before.

**Open / Next:**
- **Blocker:** real `GOOGLE_MAPS_API_KEY` needed in `.env` (GCP project + billing + Maps SDK for Android + key restricted to package/SHA-1), then `npx expo prebuild --clean`. Until then the Android map renders blank.
- Migration footgun: schema bump without `schemaMigrations` wipes local DB — must add migrations before v3.
- On-device verification of the map flow is impossible from this machine (needs emulator/device + real key); jest + tsc are the verified gates.
- Pre-existing jest warning: "worker process failed to exit gracefully" (LokiJS teardown) — cosmetic, not a failure.
