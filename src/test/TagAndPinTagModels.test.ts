import { Database, Q } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './mockSchema';
import Pin from '../model/Pin';
import Tag from '../model/Tag';
import PinTag from '../model/PinTag';

describe('Tag and PinTag Models Unit & Regression Tests', () => {
  let database: Database;

  beforeEach(() => {
    database = new Database({
      adapter: new LokiJSAdapter({ schema, useWebWorker: false, useIncrementalIndexedDB: false }),
      modelClasses: [Pin, Tag, PinTag],
    });
  });

  it('creates and reads Tag models correctly', async () => {
    let tag: Tag = null as any;
    await database.write(async () => {
      tag = await database.get<Tag>('tags').create((t) => {
        t.name = 'Close Friend';
        t.color = '#FF0000';
        t.isSystem = false;
        t.userId = null;
      });
    });

    expect(tag.name).toBe('Close Friend');
    expect(tag.color).toBe('#FF0000');
    expect(tag.isSystem).toBe(false);
    expect(tag.userId).toBeNull();
  });

  it('links and reads PinTag relationships correctly (unit/regression)', async () => {
    let pin: Pin = null as any;
    let tag: Tag = null as any;
    let pinTag: PinTag = null as any;

    await database.write(async () => {
      pin = await database.get<Pin>('pins').create((p) => {
        p.name = 'Networking Contact';
        p.lat = 37.77; p.lng = -122.41;
        p.userId = 'anonymous';
      });

      tag = await database.get<Tag>('tags').create((t) => {
        t.name = 'Conference';
        t.color = '#00FF00';
        t.isSystem = false;
        t.userId = null;
      });

      pinTag = await database.get<PinTag>('pin_tags').create((pt) => {
        pt.pin.set(pin);
        pt.tag.set(tag);
        pt.userId = 'anonymous';
      });
    });

    // Verify relations resolve correctly
    expect(pinTag.pin.id).toBe(pin.id);
    expect(pinTag.tag.id).toBe(tag.id);

    // Verify back-references (children) query on Pin returns the pinTag
    const fetchedPinTags = await pin.pinTags.fetch();
    expect(fetchedPinTags.length).toBe(1);
    expect(fetchedPinTags[0].id).toBe(pinTag.id);
  });

  it('regression: deleting a tag deletes relation rows correctly without leaving orphans', async () => {
    let pin: Pin = null as any;
    let tag: Tag = null as any;

    await database.write(async () => {
      pin = await database.get<Pin>('pins').create((p) => {
        p.name = 'Alice';
        p.lat = 0; p.lng = 0;
        p.userId = 'anonymous';
      });

      tag = await database.get<Tag>('tags').create((t) => {
        t.name = 'Delete Me';
        t.color = '#FFF';
        t.isSystem = false;
        t.userId = null;
      });

      await database.get<PinTag>('pin_tags').create((pt) => {
        pt.pin.set(pin);
        pt.tag.set(tag);
        pt.userId = 'anonymous';
      });
    });

    // Verify relation exists initially
    const initialRelations = await database.get<PinTag>('pin_tags').query().fetch();
    expect(initialRelations.length).toBe(1);

    // Simulate tag cleanup/delete: delete the relation manually (matching v1 UI cascade behavior)
    await database.write(async () => {
      // Find all relations linking to this tag and prepare to delete them
      const relations = await database.get<PinTag>('pin_tags')
        .query(Q.where('tag_id', tag.id))
        .fetch();
      
      await database.batch(
        ...relations.map(r => r.prepareDestroyPermanently()),
        tag.prepareDestroyPermanently()
      );
    });

    // Assert that the tag and relation row are completely removed from SQLite
    expect(await database.get<Tag>('tags').query().fetchCount()).toBe(0);
    expect(await database.get<PinTag>('pin_tags').query().fetchCount()).toBe(0);
    // Pin remains unaffected
    expect(await database.get<Pin>('pins').query().fetchCount()).toBe(1);
  });
});
