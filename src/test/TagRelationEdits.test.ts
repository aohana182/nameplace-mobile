import { Database, Q } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './mockSchema';
import Pin from '../model/Pin';
import Tag from '../model/Tag';
import PinTag from '../model/PinTag';

describe('Pin Tag Relations Integration: Edit Deltas', () => {
  let database: Database;

  beforeEach(() => {
    database = new Database({
      adapter: new LokiJSAdapter({ schema, useWebWorker: false, useIncrementalIndexedDB: false }),
      modelClasses: [Pin, Tag, PinTag],
    });
  });

  it('correctly calculates changes and batch updates pin-tag relationships on pin edit', async () => {
    const pinsCollection = database.get<Pin>('pins');
    const tagsCollection = database.get<Tag>('tags');
    const pinTagsCollection = database.get<PinTag>('pin_tags');

    let pin: Pin = null as any;
    let tagA: Tag = null as any;
    let tagB: Tag = null as any;
    let tagC: Tag = null as any;

    // 1. Create Pin with initial Tag A and Tag B
    await database.write(async () => {
      tagA = await tagsCollection.create(t => { t.name = 'Friend'; t.color = 'blue'; t.isSystem = true; });
      tagB = await tagsCollection.create(t => { t.name = 'Work'; t.color = 'purple'; t.isSystem = true; });
      tagC = await tagsCollection.create(t => { t.name = 'Gym'; t.color = 'red'; t.isSystem = false; });

      pin = await pinsCollection.create(p => {
        p.name = 'Barista Alex';
        p.lat = 52.5; p.lng = 13.4;
      });

      await pinTagsCollection.create(pt => { pt.pin.set(pin); pt.tag.set(tagA); });
      await pinTagsCollection.create(pt => { pt.pin.set(pin); pt.tag.set(tagB); });
    });

    // Verify initial state
    let initialRelations = await pinTagsCollection.query(Q.where('pin_id', pin.id)).fetch();
    expect(initialRelations.length).toBe(2);
    let initialTagIds = initialRelations.map(r => r.tag.id);
    expect(initialTagIds).toContain(tagA.id);
    expect(initialTagIds).toContain(tagB.id);

    // 2. Simulate User Editing Pin Details & Tags:
    // User wants to keep Tag B, remove Tag A, and add Tag C.
    const selectedTagIds = [tagB.id, tagC.id];

    await database.write(async () => {
      // Fetch current relation rows in SQLite
      const currentRelations = await pinTagsCollection
        .query(Q.where('pin_id', pin.id))
        .fetch();

      // Diff
      const relationsToDelete = currentRelations.filter(r => !selectedTagIds.includes(r.tag.id));
      const currentTagIds = currentRelations.map(r => r.tag.id);
      const tagIdsToAdd = selectedTagIds.filter(id => !currentTagIds.includes(id));

      const deletes = relationsToDelete.map(r => r.prepareDestroyPermanently());
      
      const creates = tagIdsToAdd.map(tagId => {
        const tagRecord = [tagA, tagB, tagC].find(t => t.id === tagId);
        return pinTagsCollection.prepareCreate((pt: PinTag) => {
          pt.pin.set(pin);
          pt.tag.set(tagRecord!);
        });
      });

      // Batch transaction execute
      await database.batch(...deletes, ...creates);
    });

    // 3. Assert relations are correctly updated in SQLite
    const updatedRelations = await pinTagsCollection.query(Q.where('pin_id', pin.id)).fetch();
    expect(updatedRelations.length).toBe(2);
    
    const updatedTagIds = updatedRelations.map(r => r.tag.id);
    expect(updatedTagIds).not.toContain(tagA.id); // Tag A relation is deleted
    expect(updatedTagIds).toContain(tagB.id);     // Tag B relation is preserved
    expect(updatedTagIds).toContain(tagC.id);     // Tag C relation is created
  });
});
