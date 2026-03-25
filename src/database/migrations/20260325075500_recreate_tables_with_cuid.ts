import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Disable foreign key checks to safely drop and recreate tables
  await knex.raw('SET FOREIGN_KEY_CHECKS=0;');

  await knex.schema.dropTableIfExists('outbox');
  await knex.schema.dropTableIfExists('transactions');
  await knex.schema.dropTableIfExists('wallets');
  await knex.schema.dropTableIfExists('users');

  await knex.schema.createTable('users', (table) => {
    table.string('id', 30).primary(); // CUID
    table.string('name').notNullable();
    table.string('email').unique().notNullable();
    table.string('phone').unique().notNullable();
    table.string('password_hash').notNullable();
    table.enum('role', ['user', 'admin']).defaultTo('user').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('wallets', (table) => {
    table.string('id', 30).primary(); // CUID
    table.string('user_id', 30).unique().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.decimal('balance', 15, 2).defaultTo(0.00);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('transactions', (table) => {
    table.string('id', 30).primary(); // CUID
    table.string('user_id', 30).notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.enum('type', ['credit', 'debit']).notNullable();
    table.decimal('amount', 15, 2).notNullable();
    table.string('reference').unique().notNullable();
    table.text('description');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('outbox', (table) => {
    table.string('id', 30).primary(); // CUID
    table.string('event_type').notNullable();
    table.json('payload').notNullable();
    table.enum('status', ['pending', 'processing', 'sent', 'failed']).defaultTo('pending').notNullable();
    table.integer('retry_count').defaultTo(0).notNullable();
    table.string('transaction_id', 30).references('id').inTable('transactions').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.raw('SET FOREIGN_KEY_CHECKS=1;');
}

export async function down(knex: Knex): Promise<void> {
  // Not strictly needed for this recreate migration, but keeping for completeness
}
