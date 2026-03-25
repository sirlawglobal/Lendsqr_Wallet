import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Disable foreign key checks to safely drop and recreate tables
  await knex.raw('SET FOREIGN_KEY_CHECKS=0;');

  await knex.schema.dropTableIfExists('outbox');
  await knex.schema.dropTableIfExists('transactions');
  await knex.schema.dropTableIfExists('wallets');

  await knex.schema.createTable('wallets', (table) => {
    table.increments('id').primary(); // Auto-incrementing integer
    table.string('user_id', 30).unique().notNullable()
      .references('id').inTable('users').onDelete('CASCADE'); // CUID
    table.decimal('balance', 15, 2).defaultTo(0.00);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('transactions', (table) => {
    table.increments('id').primary(); // Auto-incrementing integer
    table.string('user_id', 30).notNullable()
      .references('id').inTable('users').onDelete('CASCADE'); // CUID
    table.enum('type', ['credit', 'debit']).notNullable();
    table.decimal('amount', 15, 2).notNullable();
    table.string('reference').unique().notNullable();
    table.text('description');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('outbox', (table) => {
    table.increments('id').primary(); // Auto-incrementing integer
    table.string('event_type').notNullable();
    table.json('payload').notNullable();
    table.enum('status', ['pending', 'processing', 'sent', 'failed']).defaultTo('pending').notNullable();
    table.integer('retry_count').defaultTo(0).notNullable();
    table.integer('transaction_id').unsigned().references('id').inTable('transactions').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.raw('SET FOREIGN_KEY_CHECKS=1;');
}

export async function down(knex: Knex): Promise<void> {
  // We cannot easily down this, but we will put it here for completeness
}
