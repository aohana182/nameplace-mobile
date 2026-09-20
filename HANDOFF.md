# Handoff: Nameplace Mobile (Local-First with E2EE Backup Roadmap)

This file documents the status, architectural decisions, and next steps for Nameplace Mobile as we transition from **v1 (Local-Only SQLite)** to **v2 (Client-Side Encrypted Cloud Backup)**.

---

## ⚡ START HERE — Next Session (updated 2026-09-20, Session 7)

**Status: the sheet fixes are confirmed on the S24 (Avi, 2026-09-20) and merged to `master` via PR #2. Code commits: `c791da0` (height cap), `fc72e7e` (tint); tests: `90a6e89`.**

### What was fixed (confirmed on the S24 with `release/builds/nameplace-mobile-v1.0.0-sheetfix.apk`)

The bottom-sheet gap (sheet ending ~110-130dp above the screen bottom) was NOT the
`<Modal>` bug and NOT `KeyboardAvoidingView` / keyboard events. Measured on an emulator
with `uiautomator dump`: the sheet wrapper was 288px taller than the sheet inside it, with
zero keyboard events fired (confirmed with temporary logging). Cause: `maxHeight: '90%'`
on the sheet inside an auto-height wrapper. Fix: `BottomSheetOverlay` caps the wrapper at
`useWindowDimensions().height * 0.9` in px; the sheets use `flexShrink: 1`. Keyboard lift
is now `paddingBottom = keyboardDidShow.endCoordinates.height` in the overlay (KAV removed).
The tag-chip row was 10dp below the settings gear (scroll `paddingVertical: 10`); fixed with `top - 10`.

A second issue: a bright vertical strip in the middle of the dimmed map. Cause: the overlay had both
`elevation: 100` and the translucent tint, so its own shadow dimmed the map a second time everywhere except
one column. Fix: the tint now lives on the backdrop child (`fc72e7e`). Pixel-measured: every dimmed pixel is
now the single 40% tint. Tests in `src/test/BottomSheetOverlay.test.tsx`.

Verified on an x86_64 emulator: all three sheets reach the bottom, keyboard lift works.
Confirmed on the S24. If a gap ever returns, dump bounds again
(`adb shell uiautomator dump`) and compare wrapper vs. sheet bounds before changing anything.

### How to build (Windows 260-char path limit — READ THIS)

Native builds FAIL from `C:\Users\avioh\nameplace-mobile` (ninja: "Filename longer than 260
characters", gesture-handler codegen path). A `subst` drive does not help (expo autolinking
breaks at a drive root). Build from the short-path clone **`C:\bld2`** instead:

- `git pull` the branch there (changes must be committed AND pushed first)
- `cd C:\bld2\android && gradlew.bat app:assembleRelease -PreactNativeArchitectures=arm64-v8a` for the S24,
  or `=x86_64` for the emulator (the arm64 APK cannot run on the x86_64 emulator)
- set `JAVA_HOME` (JDK 21) and `ANDROID_HOME=C:\Users\avioh\Android`; `C:\bld2` needs `.env` copied from this repo
- output: `C:\bld2\android\app\build\outputs\apk\release\app-release.apk`
- `adb.exe` needs Windows-style paths (`C:/bld2/...`), not Git Bash `/c/...`

---

## Previous Session (2026-09-15, Session 6)

### (superseded) START HERE (updated 2026-09-15, Session 6)

**Branch: `master`, up to date with `origin/master`. Latest commit: `1bcef3a`.**
**Tag `v1.0.0-google-maps` = last working Google Maps build. Restore with: `git checkout v1.0.0-google-maps`**

### #1 priority: real-device confirmation of the bottom-sheet architecture change

Session 6 replaced React Native's `<Modal>` entirely for the three bottom sheets
(`AddPinBottomSheet`, `PinDetailsBottomSheet`, `ManageTagsBottomSheet`) with a new
in-tree `BottomSheetOverlay` component, after three earlier patches this session
(insets fix, window-flag fix, sheet-padding fix) all failed to close a
repeatedly-reported bug: a strip of map visible under the sheet instead of its
background reaching the true screen edge.

**Root cause, verified against RN's own source, not guessed:**
`ReactModalHostView.kt` unconditionally sets `SOFT_INPUT_ADJUST_RESIZE` on the
Modal's Android Dialog window with no prop to disable it. Combined with
edge-to-edge (required for the sheet to reach the screen edge at all), this is a
documented broken Android combination — the OS's own "resized" content
measurement sticks short of the real window even with no keyboard open, and the
shortfall happens in Android's native measure pass, before React's tree is even
laid out. No JS-level styling — padding, margin, flex, minHeight — can fix a
measurement that's already wrong before React sees it. Confirmed via
`adb shell dumpsys window windows`: the Dialog's own LayoutParams correctly
reported `fillxfill` (full display) while RN's internal content view inside it
still measured short — proof the gap was native-side, not a React styling bug.

**Fix:** `src/components/BottomSheetOverlay.tsx` (new) renders the sheet
absolutely-positioned over `MapScreen`'s own tree instead of in a separate Dialog
window, so it inherits the main Activity's window — already proven correct
edge-to-edge (the settings/locate buttons on `MapScreen` already use
`insets.top`/`insets.bottom` successfully). Handles the Android back button via
`BackHandler` (Modal's `onRequestClose` equivalent) and the slide-in entrance via
`Animated.timing` (Modal's `animationType="slide"` equivalent). `ModalSafeArea`
(the earlier workaround for stale insets inside a separate Modal window) is
deleted — with no separate window, `useSafeAreaInsets()` from the app-root
provider works correctly again.

**Verified:** `npx tsc --noEmit` clean, `npx jest --forceExit` 23/23. **NOT
verified:** on-screen confirmation on any device. The Android emulator became
unusable partway through this session (see "Emulator instability" below) before
a clean screenshot could be taken. Next session should open the app on the S24,
open all three bottom sheets, and confirm the sheet's white background reaches
the true bottom of the screen with no map/dimmed-backdrop strip visible
underneath — if it still shows the gap, the diagnosis above needs revisiting,
but it's now grounded in framework source rather than another guess.

### Also fixed this session (see `memory.md` 2026-09-15 continued entry for full detail)

- Marker lag during pan/zoom → switched to GL-native `GeoJSONSource`+`Layer`.
- Tag CRUD (edit/delete) added to `ManageTagsBottomSheet`; caught and fixed a real
  `database.batch()` misuse that silently broke tag deletion.
- Keyboard covering inputs → `KeyboardAvoidingView behavior="padding"` was a
  no-op on Android in all three sheets; fixed unconditionally.
- Locate button never called `requestLocationPermissions()` on manual taps
  (only the initial-mount effect did, which skips itself on nearly every
  relaunch) — unified into one `goToCurrentLocation()`.
- UI audit against Material Design 3: added a `+` FAB (pin creation had zero
  on-screen affordance before — long-press only), moved Save to a sticky footer
  outside the ScrollView, bumped several touch targets from 40-44dp to the
  48dp minimum, added a loading spinner to the locate button.
- Layout corrections: settings button + tag row anchor top-left (not
  top-right — an earlier literal reading of an instruction that turned out
  reversed); MapLibre compass forced always-visible (`compassHiddenFacingNorth`
  defaults to hiding it whenever the map faces north, which looked like it had
  been removed entirely).

### Emulator instability (environment issue, not a code bug)

By the end of this session the `nameplace_test` AVD had accumulated 25,000+
CPU-seconds from continuous use and entered a persistent System UI ANR
crash-loop that survived two guest-OS reboots, a full emulator process
kill+restart, and an `adb` server restart. Several zombie `npx jest` processes
from earlier in the session were also found still running hours later,
degrading test timing in the meantime (killed via
`Get-CimInstance Win32_Process | ... | Stop-Process`). Recommend starting a
**fresh emulator session** (or just the real S24) for the next round of testing
rather than continuing to fight this AVD instance.

### Delivery

arm64-only release APK at `release/builds/nameplace-mobile-v1.0.0.apk`
(rebuilt 2026-09-15 22:54 local, includes everything through commit `1bcef3a`).
47MB — too large to send through this session's file-transfer tool; grab it
from the local path directly.

---

## Previous Session (2026-09-15, Session 5) — MapLibre migration

### MapLibre migration — code done, device verification still outstanding

The migration below ("Next task: MapLibre migration") was written 2026-06-22 against
`@maplibre/maplibre-react-native` docs at the time. By 2026-09-15 (this session) the
library had moved to v11.3.10 with a **materially different API** — the namespaced
`MapLibreGL.MapView` / `MapLibreGL.Camera` / `PointAnnotation` style shown in the
plan below **does not exist in the installed version**. Verified against
`node_modules/@maplibre/maplibre-react-native/lib/typescript/module/**/*.d.ts`
(source, not docs — the hosted docs site's own JSDoc example for `Camera.setStop`
is itself stale/wrong, so trust the shipped `.d.ts` files over any guide, including
this one, next time):

- Import style: named exports, not a namespace — `import { Map, Camera, Marker, UserLocation } from '@maplibre/maplibre-react-native'`
- Map component is `Map` (aliased to `MapLibreMap` in code to avoid shadowing JS `Map`), not `MapView`
- **Requires a config plugin** the old plan omitted: `"@maplibre/maplibre-react-native"` added to `app.json` plugins array (done)
- Coordinates are `LngLat = [longitude, latitude]` tuples everywhere, not `{lng, lat}` objects
- Marker: `<Marker id={pinId} lngLat={[lng, lat]} onPress={...}><View .../></Marker>` — exactly one child required, no `pinColor` prop (custom View is the only way to color a pin now)
- Camera imperative moves: `cameraRef.current?.flyTo({ center: [lng, lat], zoom, duration })` — NOT `setCamera`, NOT `setStop({centerCoordinate, zoomLevel})` (that shape doesn't typecheck against `CameraStop`)
- Region persistence: `Map` still has `onRegionDidChange`, but there's no payload-based center/zoom on the event worth trusting — call `await mapRef.current?.getViewState()` (returns `{center, zoom, bearing, pitch, bounds}`) inside the handler instead
- User location dot: `<UserLocation animated />` as a child of `<Map>`, replacing `showsUserLocation`

**What was done this session (2026-09-15):**
- `MapScreen.tsx` rewritten against the current API (see above)
- `react-native-maps` + `@gorhom/bottom-sheet` removed from `package.json`; `@maplibre/maplibre-react-native@^11.3.10` added
- `patches/react-native-maps+1.27.2.patch` deleted (no longer needed)
- `app.config.js` deleted (only existed to inject the Google Maps key)
- `app.json`: added the MapLibre config plugin
- `.env.example`: removed `GOOGLE_MAPS_API_KEY`
- Dead `@gorhom/bottom-sheet` jest mock removed from `src/test/UIComponentRendering.test.tsx`
- `README.md` maps section updated
- Verified: `npx tsc --noEmit` clean, `npx jest` 18/18 passing, `npx expo prebuild --clean` succeeds (config plugin resolves, no native config errors)
- **Verified on a local Android emulator** (no S24 available this session — see "Local emulator setup" below for how to reproduce). Full Step 6 checklist run and confirmed:
  - Map tiles load (OpenFreeMap/`liberty` style renders correctly — streets, water, labels)
  - Long-press drops a pending marker, `AddPinBottomSheet` opens
  - Save a pin — persists to WatermelonDB and renders immediately in the tag's color (tested with "Work" → purple)
  - Tap an existing pin — `PinDetailsBottomSheet` opens with correct name/notes/tags
  - Edit mode opens pre-filled correctly; delete shows the native confirm dialog
  - Center-on-me / initial GPS snap fails gracefully on a GPS-less emulator (caught, logged, no crash — this is expected without a mock location, not a bug)
  - Tag filter toggling correctly hides/shows pins via the reactive WatermelonDB query
  - **Region AND pin data persist across a full `am force-stop` + cold relaunch** — confirms the `initialCamera` gating fix (wait for AsyncStorage before first Camera render) was necessary; without it the camera would very likely have raced back to `DEFAULT_CAMERA` on most relaunches
  - GPS success path: set a mock location (`adb emu geo fix`) and confirmed `centerOnMe`/initial snap actually moves the camera with no error
  - Permission-denied path: revoked location permission, relaunched, confirmed the system prompt's "Don't allow" leads to `Alert.alert('Location Permission Needed', ...)` firing correctly (not the generic timeout warning) — no crash
  - Delete: confirmed end-to-end, including the native confirm dialog and the marker actually disappearing from the map after confirming
  - All 4 system tag colors (Friend/Work/Family/Neighbor) verified distinct and correct on simultaneous markers (5 pins on screen at once, no rendering/memoization issues)
  - Notes field: entered text, saved, confirmed it displays correctly in `PinDetailsBottomSheet`
  - New Tag creation: created a custom "Mentor" tag with a custom color, confirmed it appears in the tag selector and renders correctly on a saved pin's marker
  - Edit-and-resave: changed a pin's tag in edit mode, saved, confirmed the marker color updated live
- **Not tested this session (needs a Mac / the physical S24, neither available here):** iOS build, and anything requiring real device hardware (real GPU rendering, real touch latency, real network conditions). Everything else practically testable from this machine has been exercised.
- **Found and fixed a second, unrelated pre-existing bug while testing**: `src/model/migrations.ts` had `schemaMigrations({ migrations: [] })` against a schema declared at `version: 2`. WatermelonDB's `SQLiteAdapter` statically requires migrations to cover `1..schema.version` even on a fresh install with no existing DB — this threw `[runtime not ready]: Diagnostic error: Missing migration` on every cold install, before ever reaching MapScreen. Never caught before because prior sessions only ever installed onto a S24 that already had an older, already-valid local DB. Fixed with a no-op `{toVersion: 2, steps: []}` migration entry (there's no real v1 install to migrate from — this app is pre-launch).
- Also note: dev-client on an emulator defaults to trying Metro at the host's real LAN IP (e.g. `192.168.8.101:8081`), which this machine's network path corrupts (chunked-transfer parse errors, likely AV/security-software HTTP interception) — use `adb reverse tcp:8081 tcp:8081` plus a cold relaunch via `adb shell am start -a android.intent.action.VIEW -d "exp+nameplace-mobile://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"` to force it onto the emulator-to-host loopback alias instead.

### Local emulator setup (added this session, for future fast iteration without the S24)
SDK lives at `C:\Users\avioh\Android` (`ANDROID_HOME`). Installed this session: `emulator` package + `system-images;android-35;google_apis;x86_64` via `sdkmanager`, one AVD named `nameplace_test` (Pixel 6 profile) via `avdmanager`. Boot with:
```
"$ANDROID_HOME/emulator/emulator.exe" -avd nameplace_test
```
Then `npx expo run:android --device nameplace_test`. See the Metro-connection note above — the first launch will likely need the `adb reverse` + deep-link fix.

---

### What was done this session (2026-06-22)

**Play Store prep — code robustness (all done):**
- All `database.write()` calls wrapped in try/catch with user-facing Alerts
- `AsyncStorage.getItem()` has `.catch()` (was an unhandled rejection crash)
- Location permission denial now surfaces an Alert instead of silently logging
- Non-null assertion `tagRecord!` replaced with explicit guards (crash risk on tag race)
- React Error Boundary added (`src/components/ErrorBoundary.tsx`, wraps App)
- WatermelonDB migrations enabled (`src/model/migrations.ts`) — schema bumps no longer wipe user data
- `seedSystemTagsIfEmpty()` properly awaited with `.catch()` in App.tsx
- GPS coordinate validation added before DB write in AddPinBottomSheet

**Security:**
- `.env` untracked from git (`git rm --cached .env`)
- `.env.example` created with placeholder values
- `eas.json` production profile filled in (distribution: store, buildType: aab)
- `android/app/build.gradle` updated with release signing config (env var-based, see `release/RELEASE_PREP.md`)

**Release assets (`release/` folder):**
- `RELEASE_PREP.md` — full todo tracker with statuses
- `store-listing.md` — humanized Play Store copy (short desc, full desc, changelog, keywords)
- `privacy-policy.md` — draft ready to host

**Decision:** Replace Google Maps with MapLibre + OpenFreeMap. No API key anywhere.
See ADR 05 in `DECISION_LOG.md` for full context.

---

### MapLibre migration plan (2026-06-22) — ⚠️ SUPERSEDED, API syntax below is wrong

> This plan was written against a `@maplibre/maplibre-react-native` API that no
> longer matches the shipped v11.3.10 package (see "START HERE" above for the
> corrected API surface, verified 2026-09-15 against the package's own `.d.ts`
> files). The **decision** (MapLibre + OpenFreeMap, no API key) and the
> **coordinate-order warning** below are still correct and worth reading. The
> **code samples** (`MapLibreGL.MapView`, `PointAnnotation`, `setCamera`) are not
> — do not copy them. Retained for the migration checklist and reasoning only.

#### Step 0 — Read first
The critical file is `src/screens/MapScreen.tsx`. Read it in full before touching anything. It uses a non-obvious pattern: pin taps go through `MapView.onMarkerPress` at the view level (not per-Marker), because per-`<Marker>` `onPress` is unreliable under Fabric (see Session 3 notes below). MapLibre has a different event model — plan the equivalent carefully before writing code.

#### Step 1 — Package changes

```bash
# Remove react-native-maps and its patch
npm uninstall react-native-maps
rm patches/react-native-maps+1.27.2.patch

# Remove @gorhom/bottom-sheet (no longer used, still in package.json)
npm uninstall @gorhom/bottom-sheet

# Install MapLibre
npm install @maplibre/maplibre-react-native
```

Also remove the dead `@gorhom/bottom-sheet` mock in `__tests__/UIComponentRendering.test.tsx`.

#### Step 2 — app.config.js and app.json

`app.config.js` currently injects `googleMaps.apiKey` into the Android config. Delete this entire file — it only existed to inject the Maps key. The static config in `app.json` is sufficient.

`app.json` plugins: remove the Google Maps-related config if any, keep `expo-location`, `@morrowdigital/watermelondb-expo-plugin`, and `./plugins/withNewArchDisabled`.

Remove `GOOGLE_MAPS_API_KEY` from `.env.example` too — it's no longer needed.

#### Step 3 — Tile source

Use OpenFreeMap. It is free, no key, no account required.

Recommended style URL: `https://tiles.openfreemap.org/styles/liberty`

Alternatives: `positron` (minimal/light), `bright` (more detailed). `liberty` is the best general-purpose option.

#### Step 4 — Rewrite MapScreen.tsx

**API translation table — read this before writing a single line:**

| Concern | react-native-maps | MapLibre |
|---|---|---|
| Map component | `<MapView>` | `<MapLibreGL.MapView>` |
| Camera/region control | `mapRef.current?.animateToRegion({latitude, longitude, latitudeDelta, longitudeDelta}, duration)` | Separate `<MapLibreGL.Camera ref={cameraRef}>` + `cameraRef.current?.setCamera({centerCoordinate: [lng, lat], zoomLevel: 14, animationDuration: 1500})` |
| Initial region | `initialRegion` prop on MapView | `defaultSettings` or `centerCoordinate` + `zoomLevel` on `<MapLibreGL.Camera>` |
| Pin markers | `<Marker identifier={id} coordinate={{latitude, longitude}} pinColor={color} />` | `<MapLibreGL.PointAnnotation id={id} coordinate={[longitude, latitude]}>` + a `<View>` child as the pin shape |
| Pin tap | `MapView.onMarkerPress(e.nativeEvent.id)` ← USE THIS, per-Marker onPress unreliable | `PointAnnotation.onSelected()` — fires per annotation, reliable |
| Long press | `MapView.onLongPress(e.nativeEvent.coordinate)` → `{latitude, longitude}` | `MapView.onLongPress(feature)` → `feature.geometry.coordinates` = `[longitude, latitude]` |
| Region change | `MapView.onRegionChangeComplete(region: Region)` | `MapView.onRegionDidChange(feature)` — different shape |
| User location dot | `showsUserLocation` prop | `<MapLibreGL.UserLocation />` child component |
| Map ready | `onMapReady` prop | `onDidFinishLoadingMap` prop |
| Map ref type | `useRef<MapView>` | `useRef<MapLibreGL.MapView>` |

**CRITICAL coordinate order difference:**
- `react-native-maps` uses `{latitude, longitude}` (lat first)
- MapLibre uses `[longitude, latitude]` (lng first — GeoJSON standard)

Every coordinate in `handleLongPress`, `handleMarkerPress`, `centerOnMe`, `animateToRegion`, and the `PinMarker` component needs the order flipped. This is the most common migration bug.

**PinMarker replacement:**

Current (react-native-maps):
```tsx
const PinMarker = memo(({ pinId, lat, lng, color }: PinMarkerProps) => (
  <Marker identifier={pinId} coordinate={{ latitude: lat, longitude: lng }} pinColor={color} />
));
```

MapLibre equivalent:
```tsx
const PinMarker = memo(({ pinId, lat, lng, color }: PinMarkerProps) => (
  <MapLibreGL.PointAnnotation
    id={pinId}
    coordinate={[lng, lat]}  // NOTE: [longitude, latitude]
    onSelected={() => handleMarkerPress(pinId)}
  >
    <View style={[styles.pin, { backgroundColor: color }]} />
  </MapLibreGL.PointAnnotation>
));
```

The `<View>` child is the visual pin. Make it a circle or teardrop shape in StyleSheet. This replaces the native `pinColor` prop.

**Long press coordinate extraction:**
```tsx
// react-native-maps:
const handleLongPress = (event: LongPressEvent) => {
  setSelectedLocation(event.nativeEvent.coordinate); // {latitude, longitude}
};

// MapLibre:
const handleLongPress = (feature: GeoJSON.Feature) => {
  const [longitude, latitude] = feature.geometry.coordinates;
  setSelectedLocation({ latitude, longitude });
};
```

**centerOnMe (animateToRegion equivalent):**
```tsx
// react-native-maps:
mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1500);

// MapLibre:
cameraRef.current?.setCamera({
  centerCoordinate: [loc.longitude, loc.latitude],
  zoomLevel: 14,
  animationDuration: 1500,
});
```

**Region persistence (onRegionChangeComplete):**
The region format changes. Either store the raw camera state (center + zoom) or convert to the existing `{latitude, longitude, latitudeDelta, longitudeDelta}` format for backwards compatibility with existing AsyncStorage entries.

Simplest approach: store `{centerCoordinate: [lng, lat], zoomLevel: number}` under a new key (`nameplace:lastCamera`) and let old `nameplace:lastRegion` entries expire naturally.

#### Step 5 — Rebuild native

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"
$env:ANDROID_HOME = "C:\Users\avioh\Android"
npx expo prebuild --clean
npm install    # re-applies patches via postinstall
npx expo run:android
```

#### Step 6 — Verify on S24

Must test each of these — these were the historical crash/regression points:
- [ ] Map tiles load (OpenFreeMap renders, not blank screen)
- [ ] Long-press drops a green pending pin, AddPinBottomSheet opens
- [ ] Save a pin — it appears on the map with correct tag color
- [ ] Tap an existing pin — PinDetailsBottomSheet opens and stays open
- [ ] Edit + Save a pin — changes persist
- [ ] Delete a pin — marker removed from map
- [ ] "Center on me" button — map animates to GPS position
- [ ] Deny location permission — Alert shown (not silent crash)
- [ ] Kill and reopen — map reopens at last viewed region, pins still there
- [ ] Tag filter — filter bar shows tags, toggling hides/shows pins

#### Cleanup items (do alongside migration)

- [ ] Remove `@gorhom/bottom-sheet` from `package.json` (already uninstalled above)
- [ ] Delete dead jest mock for it in `__tests__/UIComponentRendering.test.tsx`
- [ ] Delete `patches/react-native-maps+1.27.2.patch` after uninstall
- [ ] Delete `app.config.js` (only existed for Google Maps key injection)
- [ ] Remove `GOOGLE_MAPS_API_KEY` from `.env.example`
- [ ] Update `README.md` Known Limitations section (Google Maps key section no longer applies)

#### Outstanding Play Store items (after migration)

See `release/RELEASE_PREP.md` for the full tracker. Remaining blockers:
- New app icon (current is placeholder — see icon brief in RELEASE_PREP.md)
- Production keystore generation + GCP key rotation
- Screenshots on S24 (5 required)
- Privacy policy hosted at a public URL
- Play Console account creation

---

## ⚡ Previous Session (2026-06-18, Session 3)

**App state: working and verified on device (Samsung S24).** The long-standing
"pins won't open" bug is fixed for real this session. All pins open, panels stay
open, add-pin works, keyboard no longer covers the modal.

**What was actually wrong (and how it was fixed):**
- Pin taps were fine once moved to a single **`MapView.onMarkerPress`** listener
  (`event.nativeEvent.id`); per-`<Marker>` `onPress` is unreliable under Fabric.
- The real failure was **`@gorhom/bottom-sheet` v5 self-dismissing ~1–2s after
  opening** on the Reanimated 4.4 / RNGH 3.0 / RN 0.85 (Fabric) stack — proven via
  `adb logcat` (`onAnimate 0→-1` with no input). **Replaced gorhom with React
  Native's built-in `Modal`** in both panels; a Modal can't auto-close.
- Section 7 below (earlier "marker onPress RESOLVED" via useCallback/pointerEvents)
  was a **wrong diagnosis** — those changes did not fix it. Kept here for history only.

**Process lesson:** for native/runtime bugs, instrument with logs and read the
device logcat to get ground truth *before* editing. Multiple rounds were wasted guessing.

**Git / security status:**
- Local `master` is **8 commits ahead of `origin/master` (UNPUSHED)**. Latest:
  `9ed0de2` (next TODO) ← `e509d7c` (changelog/memory) ← `8aefe6b` (Modal fix)
  ← `3006353` (onMarkerPress checkpoint).
- ✅ Remote GitHub is clean: `.env` is **not** on `origin/master` (no keys leaked).
- ⚠️ **DO NOT `git push` until `.env` is untracked** — local `HEAD` tracks `.env`
  (Supabase anon key inside), so a push would leak it. First step before any push:
  `git rm --cached .env` + add to `.gitignore` + create `.env.example`.
- ⚠️ A GitHub PAT is embedded in the local `origin` remote URL (`.git/config`) —
  local-only, but rotate it when convenient.

**Next task (not started): Google Play Store packaging + assets.** See `memory.md`
"NEXT TODO". Settle permanent decisions first: final package name (current
`com.ao18277.nameplacemobile` is auto-generated), build method (EAS cloud AAB vs
local), Play Console account. Also: set `android.versionCode`, GCP Maps key
app-restriction with release SHA-1, privacy policy (location), Data Safety form.

**Cleanup candidate:** `@gorhom/bottom-sheet` is no longer imported in `src/`
(remove from `package.json` + the dead jest mock in `UIComponentRendering.test.tsx`).

---

## 1. Project Status & Milestone Completion

### v1 (Local-Only SQLite) — 100% Completed
The local-first foundation is fully implemented, verified, and styled to a senior engineering standard:
*   **Zero-Friction Startup:** Direct cold-boots straight to the main map screen without login walls.
*   **Relational Schema (v2):** SQLite schema supports `pins`, `tags`, and `pin_tags` junction entities for tag associations.
*   **Custom & System Tags:** Pre-seeded default tags (*Friend*, *Work*, *Family*, *Neighbor*) with a bottom-sheet panel supporting custom tag creation and color selection.
*   **Glassmorphic Tag Filtering:** Horizontal filter scroll view floating on the map using safe-area dynamically computed offsets, transparent glassmorphism layout, and tactile haptic impact triggers.
*   **Atomic Transactions:** All DB writes (pin drop, tag creations, relations) run in single atomic transactions wrapping SQLite queries.

---

## 2. Key Architectural Decisions

1.  **Direct-to-Map Navigation:** The app starts directly on the map. Signing up for backups is 100% optional, preventing onboarding abandonment.
2.  **Zero-Knowledge Cloud Backup (v2):** To resolve privacy concerns, cloud data will be encrypted client-side using **AES-256-GCM** before uploading. The Supabase SaaS server acts only as an encrypted sync blob repository.
3.  **Key Derivation:** The E2EE encryption key is derived locally using PBKDF2 from the user's master password. If they lose their password, recovery is impossible (requires clear UX warnings during password creation).
4.  **Map provider:** MapLibre + OpenFreeMap on both platforms, no API key (replaced Google Maps on 2026-09-15; see ADR 05 in `DECISION_LOG.md`).

---

## 3. Testing and tooling guidelines applied
*   **Mock Testing Caveats:** Acknowledged in our tests that LokiJS (in-memory test DB) does not support ACID transactional rollbacks. Tests verify logic queries while SQLite natively handles ACID in production.
*   **Absolute CLI Targeting:** Ensured all background test runs and Git logs use absolute path flags (`git -C`) to prevent sandboxed shell path errors.
*   **Zero-Knowledge Backups:** Cloud schemas must store only encrypted blobs.

---

## 4. Git Repositories Status
*   **Current Branch:** `master`
*   **Local is 8 commits AHEAD of `origin/master` (unpushed).** See "START HERE" for the push caveat (`.env` must be untracked first).

---

## 5. Verification & Test Pipeline
*   **Tests:** 8 suites, **18 tests** (unit, integration, UI component rendering).
*   **Run command:** `npx jest` / `npm run test` (all 18 passing as of 2026-06-18 Session 3).
*   **Type check:** `npx tsc --noEmit` clean.

---

## 6. Known Bugs Fixed (Session 2026-06-18)

### Bug: App crash on open — `Unable to load script`
**Cause:** Debug build on device requires Metro running + `adb reverse tcp:8081 tcp:8081` for USB.
**Resolution:** This is a dev workflow issue, not a code bug. Always start Metro before opening the debug build.

### Bug: `Cannot assign to read-only property` — RN 0.85 non-writable prototype clash
**Root cause (same in two files):** RN 0.85 uses `Object.defineProperty(Class.prototype, 'PROP', { value: X })` — no `writable: true`, so `writable` defaults to `false`. Babel compiles Flow instance-field annotations (`+PROP: value;` in the class body) into constructor assignments (`this.PROP = value`). In Hermes strict mode, assigning to a non-writable prototype property throws a TypeError.

**Affected files (both patched):**
- `Event.js` — constants `NONE`, `CAPTURING_PHASE`, `AT_TARGET`, `BUBBLING_PHASE`. Fires on every `new Event(...)` construction (WebSocket open, long press, any DOM event dispatch).
- `DOMException.js` — 25 error code constants (`INDEX_SIZE_ERR` etc.). Fires whenever a `DOMException` is constructed.

**Fix:** Removed all instance-level Flow annotations from both class bodies. The `Object.defineProperty` calls on the prototype already make these accessible on instances.
**Patch:** `patches/react-native+0.85.3.patch` — covers both files, applied automatically via `postinstall: patch-package`.
**After any patch change:** always restart Metro with `npx expo start --clear` — Metro caches Babel transforms per file and will serve stale output otherwise.

---

## 7. Session 2026-06-18 (Session 2) Bug Fixes

### Patches added this session
- `patches/react-native-maps+1.27.2.patch` — removes TypeScript `!`-suffixed instance field declarations from all 11 map component classes (`MapMarker`, `MapCallout`, etc.). Babel compiles `getNativeComponent!: ...` (no initializer, declaration-only) to `this.getNativeComponent = undefined` in the constructor, which shadows the prototype method injected by `decorateMapComponent`. Fix: removed those 4 lines from MapMarker and 3 lines from all other components.
- `patches/react-native+0.85.3.patch` — updated to also cover `DOMException.js` (25 instance-level Flow annotations shadowing non-writable prototype constants).

### Dependencies added
- `@react-native-async-storage/async-storage` — for region persistence. **Requires `npx expo run:android` after install** (native module, Metro hot-reload is not sufficient).

### Features added
- **Region persistence**: map reopens at the last panned location instead of San Francisco. Saves on `onRegionChangeComplete`, reads on mount from AsyncStorage key `nameplace:lastRegion`.
- **Keyboard dismissal**: `Keyboard.dismiss()` added to `AddPinBottomSheet.handleSave()` so keyboard doesn't persist into `PinDetailsBottomSheet`.
- **`moveOnMarkerPress={false}`** on MapView: prevents Google Maps camera animation on marker tap, which was consuming subsequent touches.

### Marker `onPress` reliability — ⚠️ SUPERSEDED (see Section 7.5 / START HERE)

> **This diagnosis turned out to be WRONG.** The useCallback / `pointerEvents` /
> useMemo changes below did NOT fix the user-visible bug. The real fix
> (Session 3) was `MapView.onMarkerPress` + replacing gorhom with native `Modal`.
> Retained below for history only.

**Previous diagnosis was wrong**: Blamed Fabric/New Architecture, but `withNewArchDisabled` plugin was already disabling it. The real causes were in JS-land, not native.

**Root causes identified and fixed:**

**Bug 1 — Unstable `onPress` closure triggering native bridge flushes**
`memo` on `PinMarker` prevented the component from re-rendering on unrelated DB changes, but the internal `<Marker onPress={() => onPress(pinId)} />` was still an inline lambda — a new function reference on every `PinMarker` render. Since `Marker` is a `PureComponent`, it saw the new function as a changed prop and scheduled a native prop-update batch. During that bridge flush window, the native Google Maps click listener was briefly unresponsive.

Fix: `useCallback(() => onPress(pinId), [onPress, pinId])` inside `PinMarker`. Since `onPress` is `handlePinPress` (stable, useCallback []) and `pinId` is a string constant per marker instance, `handlePress` is created once per `PinMarker` and never recreated. `<Marker>` never sees a new `onPress` prop unless the pin itself changes.

**Bug 2 — Filter bar ScrollView eating map touches**
The filter container `View` spanned full width at `top: 35` (Android) with no `pointerEvents` set. The horizontal `ScrollView` inside it captured ALL touches in that region (~35-100px from top), including taps on markers near the top of the screen. The asymmetry in the logcat test (14/17 vs 3/17) was consistent with one pin being in the ScrollView's shadow zone.

Fix: `pointerEvents="box-none"` on the filter container `View`. The View itself now passes touches through; only the actual badge `TouchableOpacity` children still receive touches.

**Bug 3 — `getPinColor` recalculating on every observable emission**
`pinTags.filter(...)` was called per-pin on every `withObservables` tick (any DB change). Even when colors didn't change semantically, the recalculation caused extra reconciliation overhead.

Fix: Replaced `getPinColor` with a `useMemo`-computed `pinColors: Record<string, string>` map, recomputed only when `pins`, `pinTags`, or `tags` actually change.

**Also added:** `identifier={pinId}` on each `<Marker>` for native identification (enables future `onMarkerPress` at the MapView level if needed).

**What was kept from previous session:** `memo` on `PinMarker`, `moveOnMarkerPress={false}`, `pinsRef` pattern for stable `handlePinPress`.

---

## 7.5 Session 3 (2026-06-18 afternoon) — "Pins won't open" RESOLVED

**Symptom:** tapping pins opened the detail panel only intermittently; keyboard
covered the modal; long-press dropped a pin but no panel appeared.

**Failed attempts (do not repeat):** useCallback/useMemo/`pointerEvents` on markers
(no effect); custom `<TouchableOpacity>` inside `<Marker>` (broke pins entirely —
RN renders marker children to a bitmap, touchables inside never get taps; reverted).

**Ground truth via `adb logcat` + `console.log` instrumentation:**
- After switching to `MapView.onMarkerPress`, every tap fired and matched the
  correct pin (`event.nativeEvent.id`). Marker dispatch was not the problem.
- A lone bottom sheet (backdrop disabled, no touch) logged `onAnimate 0 → -1`
  ~1–2s after opening — i.e. `@gorhom/bottom-sheet` was dismissing itself.

**Fixes (commits `3006353`, `8aefe6b`):**
1. `MapScreen.tsx`: pin taps via `MapView.onMarkerPress`; native `pinColor`
   markers; mutual exclusion between add/details panels (only one mounts at a time).
2. `AddPinBottomSheet.tsx` + `PinDetailsBottomSheet.tsx`: **rewritten on React
   Native's built-in `Modal`** (+ `KeyboardAvoidingView`). gorhom removed from both.

**Verified:** `tsc` clean, `jest` 18/18, confirmed on Samsung S24 by user.

---

## 8. Next Steps (v2 E2EE Backup Implementation Plan)

1.  **Install E2EE Dependencies:**
    ```bash
    npm install @supabase/supabase-js expo-secure-store expo-crypto
    ```
2.  **Write Cryptographic Helper (`src/services/crypto.ts`):**
    *   Derive 256-bit key from password via PBKDF2/Argon2.
    *   Encrypt/decrypt database row metadata to/from a unified ciphertext payload (AES-256-GCM).
3.  **Update Database Schema to Version 3:**
    *   Add `user_id` column to local models defaulting to `anonymous` for offline guests.
    *   Implement database transaction to migrate anonymous records to user UUID upon initial registration/auth.
4.  **Create Supabase Tables & RLS Policies:**
    *   Create Postgres sync tables with Row-Level Security (`auth.uid() = user_id`).
    *   Write database triggers to silently drop orphan records.
5.  **Build Auth Screens & Integrate Sync Engine:**
    *   Add login/registration screens in a native bottom sheet or separate view.
    *   Configure WatermelonDB `synchronize()` loop pointing to Supabase client.
