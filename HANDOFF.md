# Handoff: Nameplace Mobile (Local-First with E2EE Backup Roadmap)

This file documents the status, architectural decisions, and next steps for Nameplace Mobile as we transition from **v1 (Local-Only SQLite)** to **v2 (Client-Side Encrypted Cloud Backup)**.

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
*   **Local changes:** All v1 changes are staged and committed.
*   **Current Branch:** `master`

---

## 5. Verification & Test Pipeline
*   **Tests:** 8 suites containing 16 unit, integration, and UI component rendering tests.
*   **Run command:** `npm run test` (All passing).

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

## 7. Next Steps (v2 E2EE Backup Implementation Plan)

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
