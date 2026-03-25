import type { Knex } from 'knex';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const sharedConnection = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'yourpassword',
  database: process.env.DB_NAME || 'lendsqr_wallet',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'mysql2',
    connection: sharedConnection,
    migrations: {
      directory: path.join(__dirname, 'src/database/migrations'),
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
  },
  production: {
    client: 'mysql2',
    connection: sharedConnection,
    migrations: {
      directory: path.join(__dirname, 'src/database/migrations'),
      extension: 'js',
      loadExtensions: ['.js'],
    },
  },
};

export default config;
