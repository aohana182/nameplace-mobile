import { Model, Relation } from '@nozbe/watermelondb';
import { relation } from '@nozbe/watermelondb/decorators';
import Pin from './Pin';
import Tag from './Tag';

export default class PinTag extends Model {
  static table = 'pin_tags';

  static associations = {
    pins: { type: 'belongs_to', key: 'pin_id' },
    tags: { type: 'belongs_to', key: 'tag_id' },
  } as const;

  @relation('pins', 'pin_id') pin!: Relation<Pin>;
  @relation('tags', 'tag_id') tag!: Relation<Tag>;
}
