# Test Plan & Traceability Matrix: Nameplace Mobile (v1 Local-Only)

This document maps the functional requirements defined in the v1 PRD to specific, verifiable functional test cases. It contains both manual User Acceptance Test (UAT) procedures and automated unit/integration tests.

---

## 1. Requirements Traceability Matrix (RTM)

| Req ID | Requirement Description | Test Case ID(s) | Verification Method |
| :--- | :--- | :--- | :--- |
| **R1.1** | Render the map (MapLibre + OpenFreeMap tiles) | `TC-MAP-01` | Manual (UI) |
| **R1.2** | Defensive GPS lookup & Center on Me | `TC-GPS-01`, `TC-GPS-02` | Manual (UI) & Automated (Mock Location) |
| **R1.3** | Map Long-Press drops a pin & opens Add Pin sheet | `TC-PIN-01` | Manual (UI) |
| **R1.4** | Tapping marker opens Pin Details sheet; marker color matches tag | `TC-PIN-02` | Manual (UI) |
| **R2.1** | Pins support Name, Description, and Tags | `TC-DATA-01` | Automated (Model Unit Test) |
| **R2.2** | Default system tags seeded on first boot | `TC-TAG-01` | Manual (UI) & Automated (Integration) |
| **R2.3** | Custom tags can be created with custom colors | `TC-TAG-02` | Manual (UI) |
| **R2.4** | Tags can be selected on pin add/edit | `TC-TAG-03` | Manual (UI) & Automated (Database Transaction) |
| **R2.5** | Map pins filtered by selecting tag filters in header | `TC-FLTR-01` | Manual (UI) & Automated (Query Integration) |
| **R3.1** | Local SQLite/WatermelonDB is source of truth | `TC-DATA-02` | Automated (Integration Test) |
| **R3.2** | Updates executed atomically inside SQLite transactions | `TC-DATA-03` | Automated (Transaction Test) |

---

## 2. Functional Test Cases (Manual / UAT)

### TC-MAP-01: Native Map Rendering (R1.1)
*   **Preconditions:** Device has location permissions granted and network connection.
*   **Input:** Open application.
*   **Steps:**
    1. Launch Nameplace Mobile from a cold boot.
    2. Verify map tiles load (OpenFreeMap vector tiles, no API key).
    3. Pan and zoom around the map.
*   **Expected Result:** Map panning/zooming runs fluidly at 60fps. No grey tiles or layout shifting.

### TC-GPS-01: Defensive GPS Lock & Centering (R1.2)
*   **Preconditions:** Location services are enabled.
*   **Input:** Tap "Center on Me" button.
*   **Steps:**
    1. Tap the navigation compass icon.
    2. Verify map animates and centers on the current user coordinates.
*   **Expected Result:** The map centers with a smooth animation. User coordinate blue dot is visible.

### TC-GPS-02: GPS Failure Fallbacks (R1.2)
*   **Preconditions:** Disable device location services or deny permission.
*   **Input:** Launch app or tap "Center on Me" button.
*   **Steps:**
    1. Revoke location permissions in OS settings.
    2. Open the app and tap the navigation icon.
    3. Verify a non-blocking dialog guides the user to settings.
    4. Verify the map defaults to a safe fallback coordinate (e.g. San Francisco) and does not spin or freeze.
*   **Expected Result:** Safe degradation; map is still fully interactive, allowing manual pin dropping.

### TC-PIN-01: Pin Drop & Creation UI (R1.3, R2.1, R2.4)
*   **Preconditions:** App is on map screen.
*   **Input:** Long-press on coordinates (37.7749, -122.4194). Name: "Jane Cafe Barista". description: "Met at Sightglass Coffee".
*   **Steps:**
    1. Perform a 1.5-second long press on the map.
    2. Verify haptic vibration occurs.
    3. Verify "Add Pin" bottom sheet slides up.
    4. Input Name, Notes, and tap a tag badge (e.g., "Work").
    5. Click "Save Pin".
*   **Expected Result:** Add sheet closes. A pin marker appears at the coordinates. Marker color matches the "Work" tag color.

### TC-TAG-02: Custom Tag Creation (R2.3)
*   **Preconditions:** Add Pin or Edit Pin sheet is active.
*   **Input:** Tag Name: "Running Club", Color: Purple (`#8B5CF6`).
*   **Steps:**
    1. Tap "+" or "Manage Tags" in the sheet.
    2. In the creator input, type "Running Club".
    3. Select Purple from the color palette.
    4. Tap "Create".
*   **Expected Result:** The dialog closes, the "Running Club" badge appears immediately in the tag selector, and it can be selected.

---

## 3. Automated Functional & Integration Test Cases

These assertions are written using Jest and `@testing-library/react-native` to verify functional logic programmatically.

### TC-TAG-01: System Tag Seeding (R2.2)
```typescript
it('seeds default system tags if database is empty on boot', async () => {
  const tagsCollection = database.get<Tag>('tags');
  
  // Verify initial empty state
  expect(await tagsCollection.query().fetchCount()).toBe(0);
  
  // Run seed function
  await seedSystemTagsIfEmpty();
  
  // Assert system tags exist
  const seededTags = await tagsCollection.query().fetch();
  expect(seededTags.length).toBe(4);
  
  const tagNames = seededTags.map(t => t.name);
  expect(tagNames).toContain('Friend');
  expect(tagNames).toContain('Work');
  expect(tagNames).toContain('Family');
  expect(tagNames).toContain('Neighbor');
  
  const systemFlags = seededTags.map(t => t.isSystem);
  expect(systemFlags.every(flag => flag === true)).toBe(true);
});
```

### TC-DATA-03: Transactional Atomicity (R3.2)
```typescript
it('rolls back database modifications if any step in pin association fails', async () => {
  const pinsCollection = database.get<Pin>('pins');
  const pinTagsCollection = database.get<PinTag>('pin_tags');
  
  const initialPins = await pinsCollection.query().fetchCount();
  const initialRelations = await pinTagsCollection.query().fetchCount();
  
  // Perform write transaction designed to throw mid-execution
  await expect(database.write(async () => {
    const newPin = await pinsCollection.create((p) => {
      p.name = 'Failed Pin';
      p.lat = 0; p.lng = 0;
    });
    
    // Simulate error (e.g. referencing a non-existent tag)
    throw new Error('Database write interrupted');
  })).rejects.toThrow();
  
  // Verify state rolled back (counts remain unchanged)
  expect(await pinsCollection.query().fetchCount()).toBe(initialPins);
  expect(await pinTagsCollection.query().fetchCount()).toBe(initialRelations);
});
```

### TC-FLTR-01: Filter Map Query (R2.5)
```typescript
it('returns only pins matching active tag filters', async () => {
  const pinsCollection = database.get<Pin>('pins');
  const tagsCollection = database.get<Tag>('tags');
  const pinTagsCollection = database.get<PinTag>('pin_tags');
  
  // 1. Setup test data
  let pinA, pinB, tagWork, tagFriend;
  await database.write(async () => {
    tagWork = await tagsCollection.create(t => { t.name = 'Work'; t.color = 'red'; t.isSystem = false; });
    tagFriend = await tagsCollection.create(t => { t.name = 'Friend'; t.color = 'blue'; t.isSystem = false; });
    
    pinA = await pinsCollection.create(p => { p.name = 'Pin A'; p.lat = 1; p.lng = 1; });
    pinB = await pinsCollection.create(p => { p.name = 'Pin B'; p.lat = 2; p.lng = 2; });
    
    await pinTagsCollection.create(pt => { pt.pin.set(pinA); pt.tag.set(tagWork); });
    await pinTagsCollection.create(pt => { pt.pin.set(pinB); pt.tag.set(tagFriend); });
  });
  
  // 2. Query with 'Work' filter active
  const filterQuery = pinsCollection.query(
    Q.on('pin_tags', 'tag_id', Q.oneOf([tagWork.id]))
  );
  
  const results = await filterQuery.fetch();
  expect(results.length).toBe(1);
  expect(results[0].id).toBe(pinA.id);
});
```
