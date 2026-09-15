import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

// Schema is at version 2 with no real version-1 install ever having shipped (app is
// pre-launch, local-only). WatermelonDB's SQLiteAdapter still requires migrations to
// statically cover 1..schema.version, so this is a no-op migration purely to satisfy
// that check. Any future version bump must add a real migration here.
export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [],
    },
  ],
});
