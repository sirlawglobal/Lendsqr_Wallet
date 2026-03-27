import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE users MODIFY COLUMN status ENUM('active', 'restricted', 'deactivated', 'pending') NOT NULL DEFAULT 'active'`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE users MODIFY COLUMN status ENUM('active', 'restricted', 'deactivated') NOT NULL DEFAULT 'active'`);
}
