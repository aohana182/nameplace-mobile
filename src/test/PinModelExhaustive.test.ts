import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './mockSchema';
import Pin from '../model/Pin';

describe('Pin Model Exhaustive', () => {
  let database: Database;

  beforeEach(() => {
    database = new Database({
      adapter: new LokiJSAdapter({ schema, useWebWorker: false, useIncrementalIndexedDB: false }),
      modelClasses: [Pin],
    });
  });

  it('updates a pin correctly', async () => {
    let pin: any;
    await database.write(async () => {
      pin = await database.get<Pin>('pins').create((p) => {
        p.name = 'Old Name';
        p.lat = 0;
        p.lng = 0;
        p.userId = 'u1';
      });
      await pin.update((p: any) => {
        p.name = 'New Name';
      });
    });
    expect(pin.name).toBe('New Name');
  });

  it('marks a pin as deleted (soft delete)', async () => {
    let pin: any;
    await database.write(async () => {
      pin = await database.get<Pin>('pins').create((p) => {
        p.name = 'To Delete';
        p.lat = 0;
        p.lng = 0;
        p.userId = 'u1';
      });
      await pin.markAsDeleted();
    });
    const pins = await database.get<Pin>('pins').query().fetch();
    expect(pins.length).toBe(0); // WatermelonDB hides deleted items from standard queries
  });

  it('handles optional description correctly', async () => {
    let pin: any;
    await database.write(async () => {
      pin = await database.get<Pin>('pins').create((p) => {
        p.name = 'No Desc';
        p.lat = 0;
        p.lng = 0;
        p.userId = 'u1';
      });
    });
    expect(pin.description).toBe(null);
  });
});
