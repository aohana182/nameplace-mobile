# Changelog

All notable changes to nameplace-mobile are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Replaced Google Maps with MapLibre + OpenFreeMap.** No API key or billing
  account required anywhere (was previously blocking Play Store release — see
  ADR 05 in `DECISION_LOG.md`). `react-native-maps` and `@gorhom/bottom-sheet`
  removed; `@maplibre/maplibre-react-native@^11.3.10` added. `MapScreen.tsx`
  rewritten against the current MapLibre RN API (named exports, `LngLat` tuple
  coordinates, `Marker`/`Camera`/`UserLocation` components — see HANDOFF.md for
  the full API translation, including a stale-docs pitfall worth reading before
  touching this file again).

### Fixed
- **Region persistence was silently defeated whenever GPS succeeded on relaunch.** The location-init effect auto-snapped the camera to the device's current GPS position on every mount (not just true first launch), overriding the just-restored camera position ~1.5s after it appeared. Pre-existing bug, carried over unchanged from the `react-native-maps` version — found via an adversarial code review, confirmed via `git show` against the pre-migration file, and verified live (camera now holds its restored position across a kill+relaunch even with a GPS fix active). Fixed by only running the auto-snap on a true first launch (no camera was restored from storage).
- **Fresh installs crashed on launch with a WatermelonDB migration error.** `src/model/migrations.ts` declared `schemaMigrations({ migrations: [] })` against a schema at `version: 2`; WatermelonDB requires migrations to statically cover `1..schema.version` even for a brand-new database. Added a no-op `{toVersion: 2, steps: []}` migration (there is no real v1 install to preserve — pre-launch app). Found via a clean emulator install; never surfaced before because prior device testing reused an S24 with an already-valid local DB.
- **Pin detail / add-pin panels self-dismissing.** Replaced `@gorhom/bottom-sheet`
  with React Native's built-in `Modal` in `AddPinBottomSheet` and
  `PinDetailsBottomSheet`. The gorhom sheet auto-closed ~1–2s after opening on
  the Reanimated 4.4 / react-native-gesture-handler 3.0 / RN 0.85 (Fabric) stack,
  with no user input — making pins appear unresponsive. A `Modal` is controlled
  solely by a `visible` boolean and cannot dismiss itself. (8aefe6b)
- **Unreliable marker taps.** Pin taps are now handled by a single
  `MapView.onMarkerPress` listener (using `event.nativeEvent.id`) instead of a
  per-`Marker` `onPress`, which was unreliable under the New Architecture. (3006353)
- **Keyboard covering the modal.** Both panels now use `KeyboardAvoidingView`
  (padding on iOS; bottom-anchored adjustResize on Android).

### Changed
- Add-pin and pin-detail panels are now mutually exclusive — opening one closes
  the other, so two sheets can never be mounted at once.
- Added an explicit close (X) button and a grab handle to both panels.

### Security
- Noted that `.env` is currently git-tracked (Supabase anon key + Google Maps
  key). To be moved to `.gitignore` with a `.env.example` provided.

## [1.0.0] — 2026-06-18

### Added
- Local-first people-pinning map (Expo 56, RN 0.85, WatermelonDB/SQLite,
  react-native-maps + Google provider).
- Drop a pin via long-press; add name, notes, and tags.
- Pin details with view / edit / delete; system and custom color-coded tags.
- Tag filter bar; map region persistence across launches.

### Build
- Android build chain established without Android Studio (JDK 21, SDK
  command-line tools, NDK 27).
- patch-package patches for Gradle 9 / foojay, RN 0.85 Hermes strict-mode
  instance fields, and react-native-maps decorator shadowing.
