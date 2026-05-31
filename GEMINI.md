# Nameplace Mobile — Local-First Expo App

## Tech Stack
- **Framework:** React Native (Expo SDK 56+)
- **Map Engine:** `react-native-maps` (Native Google Maps)
- **Local Database:** WatermelonDB (SQLite)
- **Remote Backend:** Supabase (Auth & Sync)
- **UI/Animations:** Reanimated + Gesture Handler

## Architectural Core: Local-First
1. **Source of Truth:** All reads and writes go to the local WatermelonDB first.
2. **Zero Latency:** The UI never waits for the network.
3. **Background Sync:** Local changes are synced to Supabase when online.

## Critical Conventions
- **No Direct Supabase Writes:** Always write to WatermelonDB; let the sync engine handle the rest.
- **Native Components:** Use `gorhom/bottom-sheet` and native map markers. Avoid "webby" UI patterns.
- **Biometrics:** Use `expo-local-authentication` for secure access if requested.

## Commands
- **Start:** `npx expo start`
- **Android:** `npx expo run:android`
- **Sync DB:** (Custom script to be defined)
