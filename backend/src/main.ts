import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // /v1 base path — documented in CLAUDE.md/docs/rest-api.md as the
  // convention since the auth work, only enforced now that a real feature
  // needs it. Additive changes stay under /v1; breaking ones go to /v2.
  app.setGlobalPrefix('v1');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
  );

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Backend listening on port ${port}`);
}

bootstrap();
