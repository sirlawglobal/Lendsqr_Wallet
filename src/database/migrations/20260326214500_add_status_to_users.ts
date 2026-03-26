import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.enum('status', ['active', 'restricted', 'deactivated'])
      .notNullable()
      .defaultTo('active')
      .after('password_hash');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('status');
  });
}
