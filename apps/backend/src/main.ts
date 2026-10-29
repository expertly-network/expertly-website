import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyMultipart from '@fastify/multipart';
import { AppModule } from './app.module';

async function bootstrap() {
  // Fastify's router rejects any path param over 100 chars by default ("exceeding the max param
  // length"), and slugs are derived from full titles (articles, events, members) with no cap —
  // a long article title produced a ~115-char slug that every /articles/:slug route rejected.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ maxParamLength: 500 })
  );
  app.enableCors({
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'],
    // Pagination total on GET /v1/articles — browsers hide non-safelisted headers otherwise.
    exposedHeaders: ['X-Total-Count'],
  });

  await app.register(fastifyMultipart, { limits: { fileSize: 15 * 1024 * 1024 } });

  app.setGlobalPrefix('v1');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
  );

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('GrowXQ API')
      .setDescription('Live, generated API reference.')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
  );
  SwaggerModule.setup('api', app, swaggerDocument);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`Backend listening on port ${port}`);
}

bootstrap();
