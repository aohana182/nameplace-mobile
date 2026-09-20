# Nameplace Mobile — Play Store Release Prep

Last updated: 2026-06-22

---

## Phase 1 — Security (Before ANY git push)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Remove `.env` from git tracking | ✅ Done | `git rm --cached .env` run |
| 1.2 | `.env` added to `.gitignore` | ✅ Already there | Line 34 of .gitignore |
| 1.3 | `.env.example` created | ✅ Done | `release/.env.example` |
| 1.4 | Scrub `.env` from git history | ⏳ TODO — YOU DO THIS | Run: `git filter-repo --path .env --invert-paths` (install with `pip install git-filter-repo`) |
| 1.5 | Rotate Google Maps API key | ⏳ TODO | Current key in git history. Go to GCP Console → delete/regenerate. Add Android app restriction (package + release SHA-1 from Phase 3.2) |

---

## Phase 2 — Code Robustness (All Done)

| # | Task | Status | File |
|---|------|--------|------|
| 2.1 | `database.write()` wrapped in try/catch | ✅ Done | AddPinBottomSheet, PinDetailsBottomSheet |
| 2.2 | AsyncStorage `.catch()` added | ✅ Done | MapScreen.tsx |
| 2.3 | Location permission denial surfaced to user | ✅ Done | MapScreen.tsx |
| 2.4 | Non-null assertion `tagRecord!` guarded | ✅ Done | Both sheet components |
| 2.5 | React Error Boundary added | ✅ Done | src/components/ErrorBoundary.tsx, App.tsx |
| 2.6 | WatermelonDB migrations enabled | ✅ Done | src/model/migrations.ts, database.ts |
| 2.7 | `seedSystemTagsIfEmpty()` awaited with .catch | ✅ Done | App.tsx |
| 2.8 | GPS coordinate validation before DB write | ✅ Done | AddPinBottomSheet.tsx |

---

## Phase 3 — Android Release Signing

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Generate production keystore | ⏳ TODO — YOU DO THIS | `keytool -genkey -v -keystore nameplace-release.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias nameplace-release` |
| 3.2 | Get release SHA-1 fingerprint | ⏳ TODO | `keytool -list -v -keystore nameplace-release.keystore -alias nameplace-release` → save SHA-1 for GCP |
| 3.3 | Add release signing config to build.gradle | ✅ Done | Uses env vars: NAMEPLACE_KEYSTORE_PATH, NAMEPLACE_STORE_PASS, NAMEPLACE_KEY_ALIAS, NAMEPLACE_KEY_PASS |
| 3.4 | Update eas.json production profile | ✅ Done | Sets distribution: store, buildType: aab |
| 3.5 | Upload keystore to EAS (for cloud fallback) | ⏳ TODO | `eas credentials` |
| 3.6 | Test local release build | ⏳ TODO | Set env vars, run: `cd android && .\gradlew.bat app:bundleRelease` |
| 3.7 | Verify signing | ⏳ TODO | `apksigner verify --print-certs app-release.aab` → must show release key, not debug |

### Local release build commands (Windows PowerShell):
```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"
$env:ANDROID_HOME = "C:\Users\avioh\Android"
$env:NAMEPLACE_KEYSTORE_PATH = "C:\path\to\nameplace-release.keystore"
$env:NAMEPLACE_STORE_PASS = "your_store_password"
$env:NAMEPLACE_KEY_ALIAS = "nameplace-release"
$env:NAMEPLACE_KEY_PASS = "your_key_password"
cd android
.\gradlew.bat app:bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

> ⚠️ android/ is gitignored. If you run `npx expo prebuild --clean`, the signing config in build.gradle
> will be regenerated and lost. Re-apply the signing config or run a prebuild before changing build.gradle.

---

## Phase 4 — Store Listing Assets

| # | Asset | Spec | Status | Notes |
|---|-------|------|--------|-------|
| 4.1 | App icon (512×512 PNG) | Square PNG | ⏳ TODO — NEW ICON NEEDED | Current icon is a placeholder. See icon requirements below. |
| 4.2 | Adaptive icon foreground | 1024×1024 PNG, content in center 66% | ⏳ TODO | Replace `assets/android-icon-foreground.png` |
| 4.3 | Adaptive icon background | 1024×1024 PNG | ⏳ TODO | Replace `assets/android-icon-background.png` (current: solid #E6F4FE) |
| 4.4 | Adaptive icon monochrome | 1024×1024 PNG, white silhouette on transparent | ⏳ TODO | Replace `assets/android-icon-monochrome.png` |
| 4.5 | Screenshots (phone) | 2–8, min 320dp wide | ⏳ TODO | Capture on S24. See list below. |
| 4.6 | Feature graphic | 1024×500 JPG/PNG | ⏳ TODO | Shown at top of store listing. |
| 4.7 | Short description | Max 80 chars | ✅ Draft ready | See `release/store-listing.md` |
| 4.8 | Full description | Max 4000 chars | ✅ Draft ready | See `release/store-listing.md` |
| 4.9 | Privacy policy | Hosted public URL | ✅ Draft ready | See `release/privacy-policy.md` — host on GitHub Pages or Notion |

### Icon design brief
The icon should communicate: **location/map + people/connection**.

Visual concept options:
- A map pin whose head contains two overlapping silhouettes or a handshake
- A stylized pin with a dot representing a person, warm color palette
- Abstract: overlapping location markers suggesting multiple people at a place

Specs for designer:
- Source: 1024×1024 px, transparent background preferred for adaptive icon foreground
- Style: flat/minimal, readable at 48×48 dp
- Colors: match app palette (`#2563EB` blue, `#0F172A` navy, `#E6F4FE` light blue)

### Screenshots to capture on S24
1. Map with 4–5 pins of different tag colors spread across a city
2. Add-pin sheet open, name and tag filled in
3. Pin detail panel showing a connection's info and tags
4. Tag filter bar active, showing filtered map
5. (Optional) Empty-state first launch with "Long-press to add your first connection" prompt

---

## Phase 5 — Play Console Setup

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | Create Play Console account / app | ⏳ TODO | play.google.com/console → Create app → "Nameplace" |
| 5.2 | Upload AAB to Internal Testing | ⏳ TODO | Upload first, then complete the forms |
| 5.3 | Data Safety form | ⏳ TODO | Location: collected, on-device only, not shared. No personal data transmitted. |
| 5.4 | Content Rating questionnaire | ⏳ TODO | IARC form — maps/social utility app |
| 5.5 | Privacy policy URL | ⏳ TODO | Host the draft from `release/privacy-policy.md` |
| 5.6 | Pass pre-launch report | ⏳ TODO | Google runs Firebase Test Lab automatically on upload |
| 5.7 | Promote to Production | ⏳ TODO | Only after internal testing passes on S24 |

---

## History Scrub — One-time (before pushing to remote)

> **Verified 2026-09-20:** no full-length Google Maps key exists in any commit of any ref; the only `AIza` strings are truncated placeholders in `app.config.js` and `DECISION_LOG.md`. What history does contain: `.env` was tracked in commit `1158c6e` (2026-05-31) with a Supabase URL and anon key, and was removed in `e88e9c7` (2026-06-22). The repo is private. Rotating the Supabase anon key is the relevant precaution if that project is ever used; the steps below scrub `.env` from history.

Original note: the API key at `AIzaSyCM9...` was believed to be in git history. Before pushing this repo to GitHub:

```bash
# Install git-filter-repo if needed:
pip install git-filter-repo

# Remove .env from all history:
git filter-repo --path .env --invert-paths

# Rotate the exposed Google Maps key in GCP Console
# Update .env with the new key
```

This rewrites history. If you have any remote branches, you'll need to force-push afterward (coordinate with any collaborators first).
