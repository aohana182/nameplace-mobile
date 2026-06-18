# Changelog

All notable changes to nameplace-mobile are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
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
