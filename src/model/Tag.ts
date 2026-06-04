import { Model, Query } from '@nozbe/watermelondb';
import { field, date, readonly, children } from '@nozbe/watermelondb/decorators';
import PinTag from './PinTag';

export default class Tag extends Model {
  static table = 'tags';

  static associations = {
    pin_tags: { type: 'has_many', foreignKey: 'tag_id' },
  } as const;

  @field('name') name!: string;
  @field('color') color!: string;
  @field('is_system') isSystem!: boolean;

  @children('pin_tags') pinTags!: Query<PinTag>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
