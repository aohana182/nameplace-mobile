import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import schema from './schema';
import { migrations } from './migrations';
import Pin from './Pin';
import Tag from './Tag';
import PinTag from './PinTag';

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'nameplace',
  jsi: false,
  migrations,
  onSetUpError: (error) => {
    console.error('WatermelonDB failed to set up', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Pin, Tag, PinTag],
});
