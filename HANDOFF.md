# Handoff: Nameplace Mobile (Local-First with E2EE Backup Roadmap)

This file documents the status, architectural decisions, and next steps for Nameplace Mobile as we transition from **v1 (Local-Only SQLite)** to **v2 (Client-Side Encrypted Cloud Backup)**.

---

## ⚡ START HERE — Next Session (updated 2026-06-22, Session 4)

**Branch: `master`. Tag `v1.0.0-google-maps` = last working Google Maps build.**
**Restore with: `git checkout v1.0.0-google-maps`**

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

### Next task: MapLibre migration

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
4.  **Safe Native Map Fallback:** Avoided hardcoding Google Maps (`PROVIDER_GOOGLE`) on iOS to prevent app crashes on boot if Google API keys are missing in `Info.plist`. iOS gracefully runs Apple Maps, and Android runs Google Maps.

---

## 3. Global GEMINI.md Guidelines Applied
We have integrated the following diagnostics guidelines into the project:
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
