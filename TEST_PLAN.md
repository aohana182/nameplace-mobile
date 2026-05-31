# E2E Test Plan: Nameplace Mobile

This document defines the high-level testing scenarios (UAT) to ensure Nameplace meets the quality bar set in the PRD.

## Journey 1: The "Basement Coffee Shop" Scenario (Offline Resilience)
**Objective:** Verify that the app handles 0% connectivity without impacting the user experience.
- **Steps:**
  1. Force device into Airplane Mode.
  2. Open Nameplace.
  3. Long-press on the map to drop a pin.
  4. Fill in "Barista Alex" and save.
- **Expected Result:** Pin appears instantly on the map. No spinners. No "Network Error" alerts.

## Journey 2: The "Migration" Scenario (Cloud Sync)
**Objective:** Verify that data survives across devices.
- **Steps:**
  1. Add 3 pins on Device A while online.
  2. Log in to the same account on Device B.
  3. Trigger a manual or background sync.
- **Expected Result:** All 3 pins from Device A appear on Device B with correct coordinates and metadata.

## Journey 3: The "First Interaction" (Onboarding & GPS)
**Objective:** Verify that a new user can get to a "Map with Me" state quickly.
- **Steps:**
  1. Fresh install.
  2. Complete Magic Link Auth.
  3. Grant Location Permissions.
  4. Tap the "Center on Me" button.
- **Expected Result:** Map smoothly animates to the user's current blue dot location.

## Journey 4: The "Detail Edit" (Data Integrity)
**Objective:** Verify that local mutations are robust.
- **Steps:**
  1. Tap an existing marker.
  2. Open the Bottom Sheet.
  3. Change the name and add a multi-line note.
  4. Save and close.
  5. Re-open the same pin.
- **Expected Result:** The updated information is immediately reflected and persists after an app restart.

## Journey 5: Security & Privacy
**Objective:** Ensure user data separation.
- **Steps:**
  1. User A adds 5 pins.
  2. User A signs out.
  3. User B signs in on the same device.
- **Expected Result:** User B sees 0 pins (Data is scoped to User ID).
