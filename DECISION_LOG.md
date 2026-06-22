# Decision Log: Nameplace Mobile

This document records major technical decisions, architectural context, and lessons learned during the development of Nameplace Mobile.

---

## ADR 01: Native Map Selection & Platform Configuration

### Context & Problem
We needed a maps engine to render pins, cluster tags, and support long-press connection actions. The companion app must feel premium, responsive, and maintain high UX fidelity without suffering from web-view layout jitters. 

During Android testing, the native build crashed on startup with `java.lang.IllegalStateException: API key not found` because Google Maps was loaded without a declared metadata API key.

### Decisions
1.  **Engine Choice:** Use the native **Google Maps SDK** via `react-native-maps` on Android (utilizing Google Play Services).
2.  **Why Native over Web (OSM/Leaflet) or Mapbox:**
    *   **Performance:** Native Google Maps compile to GPU-accelerated OpenGL/Vulkan layers, matching the touch latency of native bottom sheet gestures.
    *   **Platform Integration:** Leverages Android's built-in location services and battery-optimized GPS callbacks directly.
3.  **Prevention of Startup Configuration Crashes:**
    *   Inject a placeholder/development API key (`AIzaSy...`) inside `app.json` by default. 
    *   This forces the Expo compiler to populate the required `<meta-data android:name="com.google.android.geo.API_KEY" />` tag in the generated `AndroidManifest.xml`, bypassing native crashes on Android emulator/device boots when API keys are absent.


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

---

## ADR 05: Migration from Google Maps to MapLibre + OpenFreeMap

### Context & Problem
The v1.0.0 release uses Google Maps SDK via `react-native-maps` with the developer's GCP API key embedded in the APK. This means every user who downloads the app from the Play Store makes map tile requests billed to the developer's GCP account. The developer has no control over per-user costs and cannot cap or route individual users' billing.

Additionally, the API key must be rotated before first release because it was committed to git history in `.env`.

### Decisions
1. **Replace `react-native-maps` (Google Maps) with `@maplibre/maplibre-react-native`** using OpenFreeMap as the tile provider.
2. **Remove all GCP dependency:** No API key is required anywhere — not from the developer, not from the user.
3. **Accept the trade-offs:**
   - Hebrew POI label quality is lower than Google Maps (noted in ADR 01 as a previous concern).
   - For this app's use case — dropping pins at known locations — POI data is irrelevant. The map is a background surface, not a search tool.
   - OpenFreeMap tiles are free, open, and do not require billing accounts.

### Restoration point
Tag `v1.0.0-google-maps` marks the last working commit before this migration. To restore the Google Maps version: `git checkout v1.0.0-google-maps`.

---

## ADR 04: Dynamic API Key Injection for Android Google Maps

### Context & Problem
Hardcoding the Google Maps API Key in `app.json` creates a severe credential leakage hazard because `app.json` is committed to version control. Conversely, leaving the key empty causes a fatal native Android crash (`IllegalStateException: API key not found`) on emulator or device launches for custom native builds.

### Decisions
1.  **Introduce app.config.js:** Replaced static Android maps configuration in `app.json` with a dynamic `app.config.js` configuration wrapper.
2.  **Environment Variables:** Inject the API key at build-time using `process.env.GOOGLE_MAPS_API_KEY`.
3.  **Local Fallback Safe Defaults:** If no environment variable is present, default the API key value to a placeholder string (`AIzaSyDummyKeyForDevelopmentBypass123`). This bypasses the Android SDK's fatal startup check during local development, while ensuring that the real key is never committed to Git.

