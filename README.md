# Nameplace Mobile

A high-performance, **Local-First** social utility app for pinning human connections to physical locations.

## The Local-First Philosophy
Nameplace is built on the principle that your social data belongs on your device. Most apps treat the cloud as the source of truth, causing latency, login friction, and privacy leaks. Nameplace flips this:

1.  **Device as Source of Truth:** All data is stored in a local SQLite database (WatermelonDB).
2.  **Instant Persistence:** Database writes are synchronous and instant. The UI never waits for a network response.
3.  **Maximum Privacy:** No cloud sync, no accounts, and no tracking. What you pin stays on your phone.
4.  **Zero Friction:** No sign-up or login required. The app is ready to use the moment you open it.

## Technical Stack
- **Framework:** React Native (Expo SDK 56)
- **Engine:** WatermelonDB (Reactive SQLite for high-performance storage)
- **Map:** Native Google Maps integration
- **Design:** Senior-standard 44pt+ touch targets, native haptics, and fluid bottom-sheet gestures.
- **Location:** Defensive GPS implementation with timeout fallbacks for reliable positioning.

## Why Local-Only?
During development, we made the strategic decision to **purge Supabase and all cloud synchronization**. 
- **Privacy:** We removed the "Magic Link" and OAuth flows to ensure no user data is ever transmitted to a third-party server.
- **Speed:** By removing the cloud bottleneck, we achieved 0ms perceived latency for pin creation.
- **Reliability:** The app works 100% reliably in "dead zones" (basements, remote trails, airplanes) because it has no external dependencies.

## Development & Testing
### Commands
- `npm start`: Launch the Expo development server.
    - Press `s` to switch to Expo Go mode.
- `npm run test`: Run the comprehensive test suite (Unit, Integration, and E2E journeys).

### Repository Structure
- `src/model/`: Database schema and reactive models.
- `src/screens/`: Pure native screens.
- `src/components/`: Gesture-controlled bottom sheets and UI primitives.
- `src/services/`: Local-only infrastructure (Location, etc.).

## Git Best Practices
This repository follows a clean-state strategy. The migration to local-only is documented in the commit history and the `HANDOFF.md` file for architectural continuity.

---
*Senior Engineered by Nameplace Mobile Team.*
