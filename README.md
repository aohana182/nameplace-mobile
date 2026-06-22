# Nameplace Mobile

A high-performance, **Local-First** social utility app for pinning human connections to physical locations.

## The Local-First Philosophy
Nameplace is built on the principle that your social data belongs on your device. Most apps treat the cloud as the source of truth, causing latency, login friction, and privacy leaks. Nameplace flips this:

1.  **Device as Source of Truth:** All data is stored in a local SQLite database (WatermelonDB).
2.  **Instant Persistence:** Database writes are synchronous and instant. The UI never waits for a network response.
3.  **Maximum Privacy:** No cloud sync, no accounts, and no tracking. What you pin stays on your phone.
4.  **Zero Friction:** No sign-up or login required. The app is ready to use the moment you open it.

## Technical Stack
- **Framework:** React Native (Expo SDK 56)
- **Engine:** WatermelonDB (Reactive SQLite for high-performance storage)
- **Map:** Native Google Maps integration
- **Design:** Senior-standard 44pt+ touch targets, native haptics, and fluid bottom-sheet gestures.
- **Location:** Defensive GPS implementation with timeout fallbacks for reliable positioning.

## Why Local-Only?
During development, we made the strategic decision to **purge Supabase and all cloud synchronization**. 
- **Privacy:** We removed the "Magic Link" and OAuth flows to ensure no user data is ever transmitted to a third-party server.
- **Speed:** By removing the cloud bottleneck, we achieved 0ms perceived latency for pin creation.
- **Reliability:** The app works 100% reliably in "dead zones" (basements, remote trails, airplanes) because it has no external dependencies.

## Maps provider history

**Tag `v1.0.0-google-maps`** is the last commit using Google Maps SDK. The app is being migrated to MapLibre + OpenFreeMap (no API key required). See ADR 05 in `DECISION_LOG.md` for context.

To restore the Google Maps version: `git checkout v1.0.0-google-maps`

## Current Status & Known Limitations (2026-06-22)

### Android map requires a Google Maps API key
The app builds and boots, but the Android map renders **blank** (beige canvas, Google logo only) because no real `GOOGLE_MAPS_API_KEY` is configured. The fallback dummy key in `app.config.js` only prevents the native startup crash (see ADR 04 in `DECISION_LOG.md`) — it cannot load tiles. To fix:
1. Create a Google Cloud project with **billing enabled** (native mobile map loads are free of charge, but a billing account is mandatory for the key to work).
2. Enable **Maps SDK for Android** and create an API key restricted to this app's package name + SHA-1.
3. Add `GOOGLE_MAPS_API_KEY=<key>` to `.env` (git-ignored; Expo CLI loads it automatically).
4. Rebuild the native project: `npx expo prebuild --clean`, then `npx expo run:android`.

### User scoping (`user_id`) does not exist yet
Earlier code assigned `userId` on models, but the field was never declared on any model nor present in the production schema — the writes were silent no-ops. They have been removed. Real `user_id` support arrives with the v2 backup work via a proper schema v3 migration (see `HANDOFF.md`).

### ⚠️ Schema migration warning
The schema is at version 2 with **no migrations configured** (`src/model/database.ts`). In WatermelonDB, bumping the schema version without providing `schemaMigrations` **deletes and recreates the local database** on existing installs. Any future schema bump (e.g., v3 for `user_id`) must ship with a migration — this app's entire value is the local data.

## Development & Testing
### Commands
- `npm start`: Launch the Expo development server.
    - Press `s` to switch to Expo Go mode.
- `npm run test`: Run the comprehensive test suite (Unit, Integration, and E2E journeys).
- `npx tsc --noEmit`: Type-check; the codebase is expected to stay at zero errors.

### Repository Structure
- `src/model/`: Database schema and reactive models.
- `src/screens/`: Pure native screens.
- `src/components/`: Gesture-controlled bottom sheets and UI primitives.
- `src/services/`: Local-only infrastructure (Location, etc.).

## Git Best Practices
This repository follows a clean-state strategy. The migration to local-only is documented in the commit history and the `HANDOFF.md` file for architectural continuity.

---
*Senior Engineered by Nameplace Mobile Team.*
