import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as net from 'net';


// Force IPv4 as a priority. This fixes "Happy Eyeballs" connectivity issues 
// on Node.js 22+ when connecting to Gmail or Adjutor on certain cloud networks.
if (net.setDefaultAutoSelectFamily) {
  net.setDefaultAutoSelectFamily(false);
}
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Lendsqr Wallet API')
    .setDescription('Lendsqr Wallet MVP API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT || 3000);
  const port = process.env.PORT || 3000;
  console.log(`Lendsqr Wallet API running on port ${port}`);
  console.log(`Swagger documentation available at http://localhost:${port}/api`);
  console.log(`Swagger documentation available at http://localhost:${port}`);
}
bootstrap();
