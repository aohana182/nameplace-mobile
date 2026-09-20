# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Nameplace Mobile: Agent Context

## What this is
A local-first Android/iOS app for pinning the people you meet to the place you met them. A pin has a name, notes and tags, and lives on a map. Everything is stored in an on-device SQLite database. There is no account and no backend in v1. The only network traffic is map tiles from OpenFreeMap.

## Stack
- Expo SDK 56, React Native 0.85.3, React 19.2, TypeScript
- Map: `@maplibre/maplibre-react-native` v11 with OpenFreeMap vector tiles (no API key)
- Database: WatermelonDB on SQLite (LokiJS in tests)
- UI: in-tree bottom sheets, `expo-haptics`, `lucide-react-native`
- Tests: Jest and `@testing-library/react-native`

## Structure
- `src/screens/MapScreen.tsx`: the whole map UI, filter chips, FAB and locate button
- `src/components/`: `AddPinBottomSheet`, `PinDetailsBottomSheet`, `ManageTagsBottomSheet`, and `BottomSheetOverlay` (the shared dim-and-slide wrapper)
- `src/model/`: WatermelonDB schema, models (`Pin`, `Tag`, `PinTag`), migrations and seed
- `src/services/LocationService.ts`: GPS with a 10 s timeout
- `src/test/`: all tests
- `HANDOFF.md`: current state and how to build; read its START HERE section first
- `memory.md`: dated session log
- `DECISION_LOG.md`: architecture decisions (ADRs)

## How to run
```sh
npm install
npx expo run:android   # builds the dev client; Expo Go will not work
npm start
npm test
npx tsc --noEmit
```

## Key decisions
- **Local-first, no cloud in v1.** Supabase and all sync were removed on purpose. v2 adds an opt-in, client-side encrypted backup (see PRD.md section 4).
- **MapLibre instead of Google Maps.** No API key, no billing account. Pins are a GL circle layer, not `<Marker>` views, so they cannot lag behind the map during gestures.
- **Bottom sheets are in-tree, not `<Modal>`.** RN's `<Modal>` window forces `SOFT_INPUT_ADJUST_RESIZE`, which breaks edge-to-edge sizing on Android.
- **Sheet height is capped in pixels.** A percentage `maxHeight` inside an auto-height wrapper left a ~110dp empty strip under the sheet.
- **The dim tint sits on a non-elevated child.** An elevated translucent view casts a shadow under its own body and double-dims the map.

## Out of scope
No accounts, analytics, ads, web build or social features. Do not add a network dependency to v1 beyond map tiles.

## Gotchas
- **Native builds fail from a long path on Windows** (ninja 260-character limit). Build from a short-path clone such as `C:\bld2`. See HANDOFF.md.
- **Schema changes need a migration.** Bumping the WatermelonDB schema version without one deletes and recreates every user's database.
- **`react-native-maps` and `@gorhom/bottom-sheet` are gone.** Do not reintroduce them; some older docs still mention them as history.
- **The `android/` folder is generated** (gitignored). `npx expo prebuild --clean` regenerates it and discards manual edits to it.
- **Layout bugs need a real screen.** Jest does not compute layout. Dump view bounds with `adb shell uiautomator dump` before changing paddings or insets.
