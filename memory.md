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

### 2026-06-18 — Build environment unblocked, APK running on S24

**What:** Resolved full Android build chain from scratch (no Android Studio). Installed JDK 21 (Microsoft OpenJDK via winget), Android SDK command-line tools, platform-tools, build-tools 35.0.0, NDK 27.1.12297006. APK built and installed on Samsung S24 via adb.

**Gradle version fix (MUST reapply after every `npx expo prebuild --clean`):**
- Expo 56 prebuild generates Gradle 9.3.1, but foojay 0.5.0 (bundled in `@react-native/gradle-plugin`) crashes on Gradle 9.x — it references `JvmVendorSpec.IBM_SEMERU` which was removed in Gradle 9.0.
- AGP 8.12.0 requires Gradle ≥ 8.13.
- Fix: set `distributionUrl=https\://services.gradle.org/distributions/gradle-8.13-bin.zip` in `android/gradle/wrapper/gradle-wrapper.properties`.
- Since `/android` is gitignored, this change is lost on each prebuild. Must be reapplied manually.

**Local build env:**
- JDK: `C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`
- Android SDK: `C:\Users\avioh\Android` (ANDROID_HOME)
- Build: `cd android && gradlew.bat app:assembleDebug` (set JAVA_HOME first)
- Install: `adb install android\app\build\outputs\apk\debug\app-debug.apk`
