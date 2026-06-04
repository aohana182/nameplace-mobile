# Decision Log: Nameplace Mobile

This document records major technical decisions, architectural context, and lessons learned during the development of Nameplace Mobile.

---

## ADR 01: Native Map Selection & Platform Configuration

### Context & Problem
We needed a maps engine to render pins, cluster tags, and support long-press connection actions. The companion app must feel premium, responsive, and maintain high UX fidelity without suffering from web-view layout jitters. 

During Android testing, the native build crashed on startup with `java.lang.IllegalStateException: API key not found` because Google Maps was loaded without a declared metadata API key.

### Decisions
1.  **Engine Choice:** Use **Native Map SDKs** via `react-native-maps`:
    *   **iOS:** Apple Maps (default MapKit).
    *   **Android:** Google Maps (Google Play Services).
2.  **Why Native over Web (OSM/Leaflet) or Mapbox:**
    *   **Performance:** Native maps compile to GPU-accelerated layers, matching the touch latency of native sheet gestures.
    *   **Cost & Setup Friction:** Apple Maps requires zero API keys or credit card registration on iOS, facilitating immediate test launches.
    *   **Platform Integration:** Leverages native OS location services and battery-optimized GPS updates.
3.  **Prevention of Startup Configuration Crashes:**
    *   Inject a placeholder/development API key (`AIzaSy...`) inside `app.json` by default. 
    *   This forces the Expo prebuild compiler to populate `<meta-data android:name="com.google.android.geo.API_KEY" />` in `AndroidManifest.xml`, bypassing native crashes on Android devices when keys are absent.

---

## ADR 02: Database & Offline-First Core

### Context & Problem
Nameplace must load instantly (0ms network latency) and maintain offline availability in remote locations (planes, subways, dead zones). 

### Decisions
1.  **Engine Choice:** **WatermelonDB (SQLite)**.
2.  **Why WatermelonDB over AsyncStorage or raw SQLite:**
    *   **Reactive UI binding:** Allows automated UI updates as connections are added or filters change.
    *   **Performance:** Fits large datasets by loading records lazily.
    *   **Sync Integration:** Native synchronization loops facilitate v2 E2EE cloud backup sync without custom diff engines.

---

## ADR 03: zero-Knowledge Cloud Backup (v2 Roadmap)

### Context & Problem
Users expect backups to prevent data loss, but require absolute privacy of their physical coordinates and connection records.

### Decisions
1.  **Security Default:** **Client-Side End-to-End Encryption (E2EE)**.
2.  **Why:**
    *   All coordinates, names, and description texts are encrypted client-side using **AES-256-GCM** before uploading.
    *   Keys are derived locally via **PBKDF2** from the user's password.
    *   The SaaS database (Supabase) holds only ciphertext blobs; zero-knowledge is maintained on the server.
