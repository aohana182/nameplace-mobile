import { database } from './database';
import Tag from './Tag';

export async function seedSystemTagsIfEmpty() {
  const tagsCollection = database.get<Tag>('tags');
  const existingCount = await tagsCollection.query().fetchCount();
  if (existingCount === 0) {
    await database.write(async () => {
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
        })
      );

      await database.batch(recordsToCreate);
    });
    console.log('[🍉] System tags seeded successfully.');
  }
}
