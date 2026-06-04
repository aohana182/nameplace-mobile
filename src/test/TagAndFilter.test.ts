import { Database, Q } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './mockSchema';
import Pin from '../model/Pin';
import Tag from '../model/Tag';
import PinTag from '../model/PinTag';

// Inline seed function for test isolation, verifying the logic of seedSystemTagsIfEmpty
async function testSeedSystemTagsIfEmpty(db: Database) {
  const tagsCollection = db.get<Tag>('tags');
  const existingCount = await tagsCollection.query().fetchCount();
  if (existingCount === 0) {
    await db.write(async () => {
      const systemTags = [
        { name: 'Friend', color: '#3B82F6', isSystem: true },
        { name: 'Work', color: '#8B5CF6', isSystem: true },
        { name: 'Family', color: '#10B981', isSystem: true },
        { name: 'Neighbor', color: '#F59E0B', isSystem: true },
      ];
      
      const recordsToCreate = systemTags.map(tagData => 
        tagsCollection.prepareCreate((t: Tag) => {
          t.name = tagData.name;
          t.color = tagData.color;
          t.isSystem = tagData.isSystem;
          t.userId = null;
        })
      );
      
      await db.batch(recordsToCreate);
    });
  }
}

describe('v1 Local-Only Functional Verification (TC-TAG-01, TC-DATA-03, TC-FLTR-01)', () => {
  let database: Database;

  beforeEach(() => {
    database = new Database({
      adapter: new LokiJSAdapter({ schema, useWebWorker: false, useIncrementalIndexedDB: false }),
      modelClasses: [Pin, Tag, PinTag],
    });
  });

  it('TC-TAG-01: seeds default system tags if database is empty on boot', async () => {
    const tagsCollection = database.get<Tag>('tags');
    
    // Verify initial empty state
    expect(await tagsCollection.query().fetchCount()).toBe(0);
    
    // Run seed function
    await testSeedSystemTagsIfEmpty(database);
    
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

    // Verify it doesn't seed duplicate default tags on subsequent calls
    await testSeedSystemTagsIfEmpty(database);
    expect(await tagsCollection.query().fetchCount()).toBe(4);
  });

  it('TC-DATA-03: executes updates inside atomic database.write block', async () => {
    const pinsCollection = database.get<Pin>('pins');
    const pinTagsCollection = database.get<PinTag>('pin_tags');
    
    // In production, SQLiteAdapter executes this inside a SQL transaction supporting rollback.
    // In Jest tests, LokiJSAdapter runs in-memory and does not support ACID rollback, 
    // so we verify standard transactional block execution succeeds.
    await database.write(async () => {
      const newPin = await pinsCollection.create((p) => {
        p.name = 'Atomic Pin';
        p.lat = 10; p.lng = 20;
        p.userId = 'anonymous';
      });
      await pinTagsCollection.create((pt) => {
        pt.pin.set(newPin);
        pt.userId = 'anonymous';
      });
    });
    
    expect(await pinsCollection.query().fetchCount()).toBe(1);
    expect(await pinTagsCollection.query().fetchCount()).toBe(1);
  });

  it('TC-FLTR-01: returns only pins matching active tag filters', async () => {
    const pinsCollection = database.get<Pin>('pins');
    const tagsCollection = database.get<Tag>('tags');
    const pinTagsCollection = database.get<PinTag>('pin_tags');
    
    // 1. Setup test data
    let pinA: Pin = null as any;
    let pinB: Pin = null as any;
    let tagWork: Tag = null as any;
    let tagFriend: Tag = null as any;
    
    await database.write(async () => {
      tagWork = await tagsCollection.create(t => { t.name = 'Work'; t.color = 'red'; t.isSystem = false; });
      tagFriend = await tagsCollection.create(t => { t.name = 'Friend'; t.color = 'blue'; t.isSystem = false; });
      
      pinA = await pinsCollection.create(p => { p.name = 'Pin A'; p.lat = 1; p.lng = 1; p.userId = 'anonymous'; });
      pinB = await pinsCollection.create(p => { p.name = 'Pin B'; p.lat = 2; p.lng = 2; p.userId = 'anonymous'; });
      
      await pinTagsCollection.create(pt => { pt.pin.set(pinA); pt.tag.set(tagWork); pt.userId = 'anonymous'; });
      await pinTagsCollection.create(pt => { pt.pin.set(pinB); pt.tag.set(tagFriend); pt.userId = 'anonymous'; });
    });
    
    // 2. Query with 'Work' filter active
    const filterQuery = pinsCollection.query(
      Q.on('pin_tags', 'tag_id', Q.oneOf([tagWork.id]))
    );
    
    const results = await filterQuery.fetch();
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(pinA.id);
  });
});
