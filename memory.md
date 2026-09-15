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

### 2026-09-15 (continued, same day) — Real-device bug reports fixed; found and eliminated the actual root cause of the bottom-sheet gap after 3 failed patches

**What:** Avi tested the MapLibre build on his S24 and reported a batch of real bugs: pins jumping during pan/zoom, keyboard covering entry fields, the bottom of every bottom sheet cut off, the locate button apparently dead, tag editing missing, and — reported four separate times across this session — a strip of map visible underneath the modal sheets instead of the sheet's own background reaching the screen edge.

**Fixed in order (commits a42573b, 7be68ef, f274a18 — already covered above — then this session's continuation):**
- Marker lag during gestures: switched from per-pin `<Marker>` (positioned by JS/UI thread, visibly lags) to a `GeoJSONSource` + `Layer type="circle"` (GL-native, same surface as map tiles, can't desync).
- Tag CRUD: added full edit/delete to `ManageTagsBottomSheet`. Caught a real production bug while writing tests for it — `database.batch(arrayOfRelations, tagModel)` (two args, first an array) throws WatermelonDB's "multiple arrays" invariant and hangs instead of rejecting; tag deletion was completely broken. Fixed by flattening to one array.
- Keyboard covering inputs: `KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined}` was a literal no-op on Android in all three sheets. Fixed to `"padding"` unconditionally.

**The bottom-sheet gap — 3 wrong fixes before the real one, each shipped and each failed on Avi's device:**
1. First guess: insets read directly inside a `<Modal>` are stale (Modal renders to a separate native window outside the root `SafeAreaProvider`'s tree). Added a `ModalSafeArea` wrapper (fresh `SafeAreaProvider` nested inside the Modal). Helped with text clipping, didn't close the gap.
2. Second guess: the Modal's Dialog window itself wasn't edge-to-edge. Added `navigationBarTranslucent` (confirmed via `adb shell dumpsys window windows` that the window's LayoutParams did become `fillxfill`) plus a `minHeight` hack on the SafeAreaProvider. The window was now genuinely full-size — the gap persisted anyway.
3. Third guess: padding needed to live on the sheet's own View, not just the ScrollView's content. Moved `paddingBottom: insets.bottom` onto the sheet. Still didn't close it — `uiautomator` bounds showed the sheet stopping ~150px short of the true screen edge regardless.

**The actual cause (found by finally reading RN's own source instead of guessing again):** `ReactModalHostView.kt` unconditionally calls `window.setSoftInputMode(SOFT_INPUT_ADJUST_RESIZE)` on the Modal's Android Dialog window, with no prop to disable it. `ADJUST_RESIZE` combined with edge-to-edge is a documented broken Android combination — the OS's own "resized" content measurement sticks short of the real window even with no keyboard open, and the shortfall happens in Android's native measure pass before React ever sees it. No JS-level styling (padding, margin, flex, minHeight) can fix a measurement that's already wrong before React's tree is even laid out. `KeyboardAvoidingView` itself was cleared of suspicion by reading its source too — at rest (no keyboard) it's just an inert `<View style={style}>`, nothing exotic.

**Real fix (commit 1bcef3a):** stop using `<Modal>` for the three bottom sheets entirely. Added `BottomSheetOverlay` — renders the sheet in-tree (absolutely positioned over `MapScreen`) instead of in a separate Dialog window, so it inherits the main Activity's window, which was already proven correct edge-to-edge (the settings/locate buttons on `MapScreen` already use `insets.top`/`insets.bottom` successfully). Replaces Modal's back-button handling with `BackHandler`, its slide transition with `Animated.timing`. Deleted `ModalSafeArea` entirely — with no separate window, `useSafeAreaInsets()` from the app-root provider is correct again, no workaround needed.

**Also this session — a UI audit against Material Design 3 found and fixed:**
- No way to discover pin creation existed except an undiscoverable long-press. Added a `+` FAB on `MapScreen` that drops a pin at the current map center.
- `AddPinBottomSheet`'s Save button lived inside scrollable content — nearly invisible above the keyboard mid-form. Moved to a sticky footer outside the `ScrollView`.
- Several icon touch targets were 40-44dp, under Material 3's 48dp minimum (close/edit/delete icons across all three sheets). Bumped to 48dp.
- Locate button gave no feedback during its up-to-10s GPS fetch. Added an `ActivityIndicator` while in flight.
- Also fixed: `centerOnMe` never called `requestLocationPermissions()` — only the initial-mount effect did, and that effect skips itself whenever a camera was restored from storage (true on nearly every relaunch after the first), so the locate button could only ever fail against a denied permission, never actually prompt for one. Unified both call sites through one `goToCurrentLocation()`.
- MapLibre's compass defaults to hidden whenever the map faces true north — looked "removed" after repositioning it to bottom-left until `compassHiddenFacingNorth={false}` was set.
- Corrected a misread instruction: settings button + tag row moved from top-right back to top-left per Avi's actual intent, after building top-right first from an earlier literal reading of his own message.

**Environment casualties this session (all diagnosed, none are app bugs):**
- Several `npx jest <file>` invocations from earlier in the session never terminated and sat consuming CPU for hours, silently degrading later test-run timing (test suite went from ~2.4s to ~10-30s, with one test's `waitFor()` starting to fail under the induced load). Found via `Get-CimInstance Win32_Process` listing zombie `node.exe` processes; killed them.
- Heavy `adb`/IME experimentation earlier in the session (clearing Gboard's app data mid-session to debug a keyboard-rendering issue) likely left the emulator's input subsystem in a nonstandard state for the rest of the session.
- The `qemu-system-x86_64` emulator process itself accumulated 25,000+ CPU-seconds from a very long continuous session and eventually entered a persistent System UI ANR crash-loop that survived two guest-OS reboots, a full emulator process kill+restart, and an `adb` server restart. Gave up chasing it — this is a session-environment failure, not a code issue.

**Verified:** `npx tsc --noEmit` clean. `npx jest --forceExit` 23/23 (confirmed via `--runInBand` and after clearing the zombie processes that the intermittent failure was environmental, not a regression — the delete/cascade code itself was untouched this session).

**NOT verified this round:** on-screen confirmation of the `BottomSheetOverlay` architecture change. The emulator became unusable before a clean screenshot could be taken. The fix is grounded directly in RN/Android source (not a guess), but real-device confirmation on the S24 is the next required step before considering the bottom-sheet-gap saga actually closed.

**Delivery:** arm64-only release APK rebuilt at `release/builds/nameplace-mobile-v1.0.0.apk` (built 2026-09-15 22:54 local). Too large (47MB) to send directly through this session's file-transfer tool each time — Avi needs to grab it from the local path himself.

**Global CLAUDE.md updated this session** (`C:\Users\avioh\.claude\CLAUDE.md`) with 4 new rules distilled from this session's mistakes: verify source before re-attempting a fix (don't patch the same bug empirically a second time), restate-and-confirm on literal/conflicting instructions before implementing, long-session environment hygiene (track background processes, watch for timing degradation as a sign of environmental not logical issues), and checkpoint verified increments mid-session rather than bundling many unverified changes into one long-lived uncommitted working tree.
