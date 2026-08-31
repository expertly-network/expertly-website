import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyMultipart from '@fastify/multipart';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.enableCors();

  // Bare @fastify/multipart, no attachFieldsToBody — the one upload route reads the file via
  // request.file() and the sibling `kind` field off its own .fields, validated manually against
  // UploadApplicationFileDto (see applications.controller.ts) rather than through the global
  // ValidationPipe/@Body(), since Fastify (unlike Express+multer) doesn't populate req.body from
  // a multipart form on its own.
  await app.register(fastifyMultipart, { limits: { fileSize: 15 * 1024 * 1024 } });

  // /v1 base path — documented in CLAUDE.md/docs/rest-api.md as the
  // convention since the auth work, only enforced now that a real feature
  // needs it. Additive changes stay under /v1; breaking ones go to /v2.
  app.setGlobalPrefix('v1');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
  );

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Expertly API')
      .setDescription('Live, generated reference — docs/rest-api.md remains the authored contract/design doc.')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
  );
  // Deliberately not gated to non-production yet — reachable at /api in every environment,
  // including once deployed. Doesn't expose real data (just route/DTO shapes), but it does hand
  // out a full map of the backend's routes to anyone with the URL. FUTURE: gate behind
  // `process.env.NODE_ENV !== 'production'` once that tradeoff is worth revisiting — see
  // docs/rest-api.md's "Live/generated API docs" note.
  SwaggerModule.setup('api', app, swaggerDocument);

  const port = Number(process.env.PORT ?? 4000);
  // Fastify defaults to binding localhost-only; '0.0.0.0' is required for it to be reachable
  // from outside the container (Docker/Coolify) the same way Express's implicit default was.
  await app.listen(port, '0.0.0.0');
  console.log(`Backend listening on port ${port}`);
}

bootstrap();
