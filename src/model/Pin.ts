import { Model, Query } from '@nozbe/watermelondb';
import { field, date, readonly, children } from '@nozbe/watermelondb/decorators';
import PinTag from './PinTag';

export default class Pin extends Model {
  static table = 'pins';

  static associations = {
    pin_tags: { type: 'has_many', foreignKey: 'pin_id' },
  } as const;

  @field('name') name!: string;
  @field('description') description!: string | null;
  @field('lat') lat!: number;
  @field('lng') lng!: number;

  @children('pin_tags') pinTags!: Query<PinTag>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
