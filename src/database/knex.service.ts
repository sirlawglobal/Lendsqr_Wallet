import { knex } from 'knex';
import { ConfigService } from '@nestjs/config';

export const createKnexInstance = (configService: ConfigService) => {
  return knex({
    client: 'mysql2',
    connection: {
      host: configService.get<string>('DB_HOST'),
      port: configService.get<number>('DB_PORT'),
      user: configService.get<string>('DB_USER'),
      password: configService.get<string>('DB_PASSWORD'),
      database: configService.get<string>('DB_NAME'),
    },
    pool: { min: 2, max: 10 },
  });
};
