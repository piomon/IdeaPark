import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { initDatabase, seedDemoData } from './common/db';

config();

async function bootstrap() {
  await initDatabase();
  await seedDemoData();

  const app = await NestFactory.create(AppModule);

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  const corsOrigins = process.env['CORS_ORIGIN']?.split(',') ?? ['*'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization'],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env['PORT'] ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`IdeaPark API running on http://localhost:${port}`);
  console.log('Security: helmet enabled, JWT auth active, CORS configured');
}

bootstrap();
