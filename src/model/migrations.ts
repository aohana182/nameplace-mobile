import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

// Schema started at version 2. Any future version bumps must add a migration here
// to avoid wiping user data on upgrade.
export const migrations = schemaMigrations({ migrations: [] });
