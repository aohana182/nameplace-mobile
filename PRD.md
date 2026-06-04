# Product Requirement Document (PRD): Nameplace Mobile

## 1. Executive Summary
**Nameplace Mobile** is the native iOS/Android companion to the Nameplace web application (https://nameplace.lovable.app/). It is a location-first personal CRM that allows users to drop a map pin where they meet someone and record their details (names, descriptions, and custom tags). 

To ensure rapid delivery, absolute privacy, and high reliability, the project is structured in two major phases:
*   **v1 (Local-Only):** A purely local-first app using WatermelonDB/SQLite. No network connectivity, no accounts, and zero server infrastructure required.
*   **v2 (Encrypted Cloud Backup):** A zero-knowledge sync layer using client-side End-to-End Encryption (E2EE) with AES-GCM-256, backing up encrypted records to the Supabase SaaS Free Tier.

---

## 2. Release Roadmap

```
+------------------------------------------+
|            v1: Local-Only                |
| - Local WatermelonDB SQLite database      |
| - Native maps & GPS positioning          |
| - System & Custom Tag management         |
| - Map Pin Tag Filtering                  |
+--------------------+---------------------+
                     |
                     v
+------------------------------------------+
|      v2: Encrypted Cloud Backup          |
| - Email/Password Auth (Supabase SaaS)    |
| - Client-side Key Derivation (PBKDF2)    |
| - AES-GCM-256 Client-side Encryption     |
| - Background Sync to Supabase Free Tier  |
+------------------------------------------+
```

---

## 3. Phase 1: v1 (Local-Only) Requirements

### 3.1. Location-First Mapping & Pinning
* **R1.1 (Native Maps):** Display a high-performance native map (`react-native-maps`) using Google Maps on Android and Apple Maps on iOS.
* **R1.2 (Current Location):** A "Center on Me" button using a defensive GPS lookup with a 10-second timeout. Fallback to last known position on timeout or permission denial.
* **R1.3 (Pin Drop):** Long-pressing anywhere on the map drops a new pin and opens the "Add Pin" bottom sheet.
* **R1.4 (Interactive Markers):** Tapping a pin marker displays the "Pin Details" bottom sheet. Markers should reflect the color of their primary tag.

### 3.2. Contact & Tag Management
* **R2.1 (Pin Fields):** Each pin must support a Name, description/notes, and multiple tags.
* **R2.2 (System Tags):** Pre-populate default system tags (e.g., *Friend*, *Work*, *Family*, *Neighbor*). System tags are read-only and cannot be deleted.
* **R2.3 (Custom Tags):** Users can create custom tags with a name and a custom color picked from a predefined palette (matching the web app).
* **R2.4 (Tag Selection):** The "Add Pin" and "Edit Pin" interfaces must include a tag selector.
* **R2.5 (Filtering):** Users must be able to filter the pins displayed on the map by selecting one or more tags from a horizontal scrolling filter bar at the top of the map screen.

### 3.3. Database Architecture
* **R3.1 (Local Database):** WatermelonDB (SQLite) acts as the single source of truth. All reads and writes must be local and instantaneous.
* **R3.2 (Offline Integrity):** The database operations (creation, updates, deletes) must be executed inside database actions to guarantee transactional atomicity.

---

## 4. Phase 2: v2 (Encrypted Cloud Backup) Requirements

### 4.1. Secure Authentication
* **R4.1 (Email/Password Auth):** Users can register and authenticate via standard Email/Password using Supabase SaaS. Google OAuth is excluded to eliminate third-party telemetry.
* **R4.2 (Secure Token Storage):** Store authentication tokens locally using Expo `SecureStore`.
* **R4.3 (Keyring Safety):** If SecureStore fails to load the token (e.g. background execution state locked), the app must default to local-only mode. **Do not wipe local data on auth read failure.** Wiping data requires explicit, double-confirmed user action.

### 4.2. Client-Side End-to-End Encryption (E2EE)
* **R5.1 (Key Derivation):** Derive a 256-bit AES encryption key client-side from the user's password using PBKDF2/Argon2. The password and key must never leave the device.
* **R5.2 (Zero-Knowledge Payload):** Before syncing, the client encrypts the pin details (name, description, latitude, longitude, and tag IDs) using AES-GCM-256. 
* **R5.3 (Cloud Storage Structure):** The Supabase database stores only the ID, User ID, Timestamp, and the encrypted blob. The database operator cannot read the location coordinates or contact names.

### 4.3. Background Sync Engine
* **R6.1 (Sync Protocol):** Replicate encrypted database records to Supabase.
* **R6.2 (Throttling & Debouncing):** Debounce sync triggers by 5 seconds to conserve battery and data.
* **R6.3 (Stale Catch-up):** Clear sync metadata and run a full merge/pull if the device has been inactive for more than 30 days.

---

## 5. Non-Functional & UX Requirements
* **Standard Touch Targets:** Minimum interactive size of 44x44pt.
* **Haptics:** Haptic feedback via `expo-haptics` on pin drop, sheet open, and save/delete actions.
* **Stability:** Zero crashes during offline-to-online network transitions.
