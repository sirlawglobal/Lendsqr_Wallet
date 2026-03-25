import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('blacklisted_identities', (table) => {
    table.string('id').primary();
    table.string('identity').notNullable().unique();
    table.string('reason').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('blacklisted_identities');
}
