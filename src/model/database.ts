import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import schema from './schema';
import Pin from './Pin';
import Tag from './Tag';
import PinTag from './PinTag';

const adapter = new SQLiteAdapter({
  schema,
  // (Optional) Database name
  dbName: 'nameplace',
  // (Recommended) Handle multi-threading and concurrent access
  jsi: false,
  // (Optional) Migration logic
  // migrations,
  onSetUpError: (error) => {
    // Database failed to load -- offer the user to reload, or log to a service
    console.error('WatermelonDB failed to set up', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Pin, Tag, PinTag],
});
