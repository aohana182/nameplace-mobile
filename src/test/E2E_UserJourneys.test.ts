import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './mockSchema';
import Pin from '../model/Pin';
import Tag from '../model/Tag';
import PinTag from '../model/PinTag';
import { synchronize } from '@nozbe/watermelondb/sync';

describe('E2E User Journeys (Simulated)', () => {
  let database: Database;

  beforeEach(() => {
    database = new Database({
      adapter: new LokiJSAdapter({ schema, useWebWorker: false, useIncrementalIndexedDB: false }),
      modelClasses: [Pin, Tag, PinTag],
    });
  });

  it('Journey 1: Handles offline pin creation successfully', async () => {
    // 1. Simulate offline state (pushChanges will be skipped or handle failure)
    const pushChanges = jest.fn().mockRejectedValue(new Error('Network Error'));

    await database.write(async () => {
      await database.get<Pin>('pins').create((p) => {
        p.name = 'Alex at Coffee Shop';
        p.lat = 52.52; p.lng = 13.40;
        p.userId = 'u1';
      });
    });

    // 2. Verify local state is updated immediately (0ms latency)
    const pins = await database.get<Pin>('pins').query().fetch();
    expect(pins.length).toBe(1);
    expect(pins[0].name).toBe('Alex at Coffee Shop');

    // 3. Verify sync fails but local data survives
    await expect(synchronize({
      database,
      pullChanges: async () => { throw new Error('Offline'); },
      pushChanges,
    })).rejects.toThrow();

    const pinsPostSyncFail = await database.get<Pin>('pins').query().fetch();
    expect(pinsPostSyncFail.length).toBe(1);
  });

  it('Journey 4: Detail edits persist locally and prepare for sync', async () => {
    let pin: Pin = null as any;
    // 1. Initial creation
    await database.write(async () => {
      pin = await database.get<Pin>('pins').create((p) => {
        p.name = 'Original Name';
        p.lat = 0; p.lng = 0; p.userId = 'u1';
      });
    });

    // 2. User edits pin
    await database.write(async () => {
      await pin.update((p: any) => {
        p.name = 'Updated Name';
        p.description = 'Added a note';
      });
    });

    // 3. Verify updated state
    const updatedPin = await database.get<Pin>('pins').find(pin.id);
    expect(updatedPin.name).toBe('Updated Name');
    expect(updatedPin.description).toBe('Added a note');
    // It stays 'created' because it hasn't been synced to the server yet.
    // WatermelonDB optimizes by sending the final state as a single 'create'.
    expect(updatedPin.syncStatus).toBe('created'); 
  });
});
