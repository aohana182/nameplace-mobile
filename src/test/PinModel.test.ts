import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './mockSchema';
import Pin from '../model/Pin';
import Tag from '../model/Tag';
import PinTag from '../model/PinTag';

describe('Pin Model', () => {
  let database: Database;

  beforeEach(() => {
    const adapter = new LokiJSAdapter({
      schema,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
    });

    database = new Database({
      adapter,
      modelClasses: [Pin, Tag, PinTag],
    });
  });

  it('creates a pin correctly', async () => {
    let pin: any;
    await database.write(async () => {
      pin = await database.get<Pin>('pins').create((p) => {
        p.name = 'Test Pin';
        p.lat = 10;
        p.lng = 20;
        p.userId = 'user-1';
      });
    });

    expect(pin.name).toBe('Test Pin');
    expect(pin.lat).toBe(10);
    expect(pin.lng).toBe(20);
  });
});
