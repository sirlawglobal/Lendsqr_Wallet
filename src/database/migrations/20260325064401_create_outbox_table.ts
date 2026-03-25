import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('outbox', (table) => {
    table.increments('id').primary();
    table.string('event_type').notNullable(); // e.g., 'TRANSACTION_SUCCESS'
    table.json('payload').notNullable(); // The email details (recipient, message)
    table.enum('status', ['pending', 'processing', 'sent', 'failed']).defaultTo('pending').notNullable();
    table.integer('retry_count').defaultTo(0).notNullable();
    table.integer('transaction_id').unsigned().references('id').inTable('transactions').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('outbox');
}
