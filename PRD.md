# PRD: Nameplace Mobile

## 1. Executive Summary
**Nameplace** is a social utility app that pins human connections to physical locations. The mobile app must provide a high-performance, native-feeling experience that allows users to record encounters instantly, even without internet connectivity.

## 2. Target Audience
- Networking professionals.
- Socially active individuals.
- Travelers and neighborhood residents.

## 3. Core Functional Requirements (Must-Have)
### 3.1. Location-First Pinning
- **R1:** Users must be able to drop a pin on a native Map via long-press.
- **R2:** Users must be able to "Center on Me" using device GPS.
- **R3:** Pin creation must be **Synchronous and Instant** (0ms perceived latency).

### 3.2. Local-First Data Architecture
- **R4:** All data must be stored in a local SQLite database (WatermelonDB).
- **R5:** The app must be fully functional offline (Create/Read/Update/Delete pins).

### 3.3. Bidirectional Cloud Sync
- **R6:** Local changes must sync to Supabase in the background when a connection is available.
- **R7:** Remote changes (from other devices) must be pulled down to the local DB.
- **R8:** Conflict resolution: "Last Write Wins" for the initial version.

### 3.4. Authentication
- **R9:** Secure sign-in via Supabase (Magic Links / OAuth).
- **R10:** Persistent sessions stored in device secure storage.

## 4. User Experience & Design (Non-Functional)
- **Fluidity:** 60fps map interactions and native bottom-sheet animations.
- **Branding:** Consistent use of Roboto and Roboto Slab fonts.
- **Privacy:** Data must be scoped to the authenticated user.

## 5. Success Metrics
- Average time to drop a pin: < 5 seconds.
- Sync success rate: > 99%.
- Data loss incidents: 0.
