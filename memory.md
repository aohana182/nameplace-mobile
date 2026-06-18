# Project Memory — nameplace-mobile

### 2026-06-11 14:00 — Code review, type fixes, maps decision

**What:** Full code review of v1. Fixed: 50 TS errors (`npx tsc --noEmit` now clean), removed no-op `userId` writes (field was never declared on models nor in the production schema — nothing was being persisted; tests passed vacuously because `mockSchema.ts` had `user_id` columns the production schema lacks), typed `PinTag` relations as `Relation<Pin>`/`Relation<Tag>`, aligned mock schema with production, raised GPS timeout 5s→10s per PRD R1.2.

**Why:** Babel strips types so the app ran despite a broken type-check; the phantom `userId` would have misled the v2 sync work into assuming user scoping already existed.

**Decisions:**
- Maps: stay with Google Maps (`react-native-maps` + `PROVIDER_GOOGLE`) for best UX; MapLibre/OpenFreeMap considered and rejected (thinner POI data, weaker Hebrew labels). Avi chose Google despite the GCP billing-account requirement.
- `user_id` arrives properly in v2 via schema v3 migration, not before.

**Open / Next:**
- **TODO:** GCP key (`AIzaSyCM9...`) currently has API restriction (Maps SDK for Android) but NO application restriction (package name + SHA-1). Must add: Android app restriction → `com.ao18277.nameplacemobile` + debug SHA-1 before any public/production use.
- Migration footgun: schema bump without `schemaMigrations` wipes local DB — must add migrations before v3.
- Pre-existing jest warning: "worker process failed to exit gracefully" (LokiJS teardown) — cosmetic, not a failure.

### 2026-06-18 — Build environment unblocked, native compatibility fixed

**What:** Resolved full Android build chain from scratch (no Android Studio). Installed JDK 21 (Microsoft OpenJDK via winget), Android SDK command-line tools, platform-tools, build-tools 35.0.0, NDK 27.1.12297006. APK built and installed on Samsung S24 via adb.

**Native compatibility issues and robust fixes:**

1. **foojay 0.5.0 vs Gradle 9.x:** `@react-native/gradle-plugin` pins foojay toolchain resolver to 0.5.0, which references `JvmVendorSpec.IBM_SEMERU` removed in Gradle 9.0. Fixed via `patch-package` — patches `@react-native/gradle-plugin/settings.gradle.kts` to use foojay 0.9.0. Survives `npm install`. Gradle 9.3.1 (Expo's default) works again.

2. **WatermelonDB vs New Architecture:** WatermelonDB's event polyfill tries to assign to `Event.NONE` which is read-only under Fabric. Fixed by `newArchEnabled: false` in `app.json` — Expo-idiomatic, survives prebuild.

3. **SVG markers in react-native-maps:** Lucide SVG icons as `<Marker>` children crash under Fabric. Fixed by switching to native `pinColor` prop on `<Marker>` — no custom children needed.

**Local build env:**
- JDK: `C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`
- Android SDK: `C:\Users\avioh\Android` (ANDROID_HOME)
- Build: `cd android && gradlew.bat app:assembleDebug` (set JAVA_HOME and ANDROID_HOME first)
- Install: `adb install android\app\build\outputs\apk\debug\app-debug.apk`
- After any `npx expo prebuild --clean`: patch-package postinstall hook applies automatically on next `npm install`

**Current state (2026-06-18):**
- APK built successfully, ready to install on S24
- Metro bundler not yet started for this build — run `npx expo start` then connect phone
- Remaining TODO: add Android app restriction to GCP key (package + SHA-1)
- Next milestone: v1 full flow verification on device (drop pin, add name/tag, filter)
