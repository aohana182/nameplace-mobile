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

### 2026-06-18 (afternoon) — "Pins won't open" saga: diagnosis, pivots, resolution

**Symptom reported:** tapping pins opened the detail panel only intermittently (1 of 3 pins); keyboard covered the modal; long-press dropped a pin but no panel appeared. Previous session had "fixed" it with JS-layer changes that did nothing.

**Failed pivots (what NOT to repeat) — all were guessing at the wrong layer:**
1. `useCallback`/`useMemo`/`pointerEvents="box-none"` on markers — no effect.
2. Custom `<TouchableOpacity>` inside `<Marker>` — *broke pins entirely*; RN renders Marker children to a bitmap, so touchables inside never receive taps. Also lost the native pin look. Reverted.
3. Backdrop `pressBehavior="none"` + `key` prop + mutual exclusion — partial, but a lone sheet still self-closed.

**What actually worked — get GROUND TRUTH, stop theorizing:** instrumented the code with `console.log` and read `adb logcat` directly (the agent can read device logs itself — no need for user screenshots). Logs proved:
- Marker taps fired 100% reliably once switched to **`MapView.onMarkerPress`** (single stable listener; `event.nativeEvent.id` = marker `identifier`). Per-`<Marker>` `onPress` is unreliable under Fabric.
- The real failure: `@gorhom/bottom-sheet` v5 **self-dismissed ~1–2s after opening** (`onAnimate 0→-1`) with no input, backdrop off, single sheet. Unstable on the Reanimated 4.4 / RNGH 3.0 / RN 0.85 Fabric stack (peer-deps "allow" these versions but it's not battle-tested there).

**Resolution (commits 3006353 checkpoint, 8aefe6b fix):** replaced `@gorhom/bottom-sheet` with React Native's built-in **`Modal`** in both `AddPinBottomSheet` and `PinDetailsBottomSheet`. A Modal is controlled solely by a `visible` boolean → structurally cannot auto-close. Keyboard-over-modal fixed with `KeyboardAvoidingView`. Mutual exclusion added so the two panels never mount simultaneously. Verified on S24 by user: all pins open and panels stay open.

**Recommendations / open items:**
- Remove `@gorhom/bottom-sheet` from `package.json` and the dead jest mock in `UIComponentRendering.test.tsx` (no longer imported anywhere in `src/`).
- **SECURITY:** `.env` is git-tracked with Supabase anon key + Google Maps key. Add to `.gitignore`, provide `.env.example`, consider scrubbing history. (Maps key is already in the app manifest, so lower urgency, but anon key shouldn't be in VCS.)
- Process lesson: for native/runtime bugs, instrument + read device logs before changing code. Three rounds were wasted guessing.

### NEXT TODO — Google Play Store packaging (assets + production build)

Not started. Packaging the app for Play Store submission with store assets.
Decisions to settle at start (permanent ones first): final package name
(current `com.ao18277.nameplacemobile` is auto-generated), build method
(EAS cloud AAB vs local), Play Console account status. Also blockers already
on file: set `android.versionCode`, add GCP Maps key app-restriction with the
release SHA-1, privacy policy (location permission), Data Safety form.

### 2026-09-15 — MapLibre migration executed + verified on a local emulator

**What:** Carried out the MapLibre migration that Session 4 (2026-06-22) only planned. The planned API (`MapLibreGL.MapView`/`PointAnnotation`/`setCamera`) turned out to be stale — `@maplibre/maplibre-react-native` had moved to v11.3.10 with a rewritten API (`Map`/`Camera`/`Marker`, `LngLat` tuples, `flyTo`/`easeTo`/`setStop`). Verified every API call against the package's own shipped `.d.ts` files rather than the hosted docs, after catching the hosted docs' own `Camera.setStop` example quoting a field name (`centerCoordinate`) that doesn't match the actual `CameraStop` type — the docs site itself is stale/wrong in places, not just this project's 3-month-old plan.

**Why re-derive from source instead of trusting docs:** third `tsc` error in a row from copy-pasted "official" examples. Full detail and the corrected API surface are now in `HANDOFF.md`'s "START HERE" section.

**Unrelated bug found blocking verification:** `src/model/migrations.ts` (`schemaMigrations({ migrations: [] })` against `schema.version: 2`) threw a fatal runtime error on any fresh install — WatermelonDB requires static migration coverage of `1..version` even with no existing DB. Never seen before because every prior test install reused an S24 that already had a valid DB from before schema v2 existed. Fixed with a no-op migration entry.

**How verified (no S24 this session):** installed a local Android emulator from scratch (SDK had platform-tools but no `emulator`/system-image — installed both via `sdkmanager`, one AVD `nameplace_test`, Pixel 6 profile). Ran the full HANDOFF Step 6 checklist on it: tiles, pin CRUD, tag-color rendering, tag filtering, and — the one most worth re-checking after any camera-related change — region + pin-data persistence across a full `am force-stop` + cold relaunch. All passed.

**Reusable for next time:** dev-client on this emulator defaults to trying Metro over the host's real LAN IP, which this machine's network mangles (chunked-encoding parse errors — smells like AV/security-software HTTP interception, same family of issue as the TLS revocation-check failures seen earlier from plain `curl`). Fix: `adb reverse tcp:8081 tcp:8081` + relaunch via deep link forcing `10.0.2.2:8081` (the emulator-to-host loopback alias). Documented in HANDOFF.md.

**Follow-up same session — closed every gap testable on this machine:** after the first pass, went back and exercised everything not yet covered: GPS-success path (`adb emu geo fix`, confirmed `centerOnMe` actually moves the camera), permission-denied path (revoked permission via `pm revoke`, confirmed the real `Alert.alert` fires — first two attempts at this accidentally re-granted permission by tapping blind on the system dialog's "Allow" button, so used `uiautomator dump` for exact coordinates from there on), a completed delete (marker actually disappears), all 4 system tag colors verified distinct with 5 pins on screen simultaneously, notes field save/display, new custom-tag creation with a custom color, and edit-then-resave updating a marker's color live. Not tested: iOS (no Mac) and anything needing real device hardware (no S24 this session) — those are the only two gaps left, and both are hardware-access limitations, not open questions about the code.
