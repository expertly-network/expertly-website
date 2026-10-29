import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { MAX_UPLOAD_FILES, MAX_UPLOAD_BYTES } from './common/upload-limits';

const logger = new Logger('Bootstrap');

// Comma-separated browser origins allowed to call the API (e.g.
// "https://growxq.com,https://www.growxq.com"). Auth is a bearer token, not a cookie, so CORS is
// defense-in-depth here — but an unset list means "any origin", which production shouldn't run.
function corsOrigins(): string[] | true {
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.length > 0) return origins;
  if (process.env.NODE_ENV === 'production') {
    logger.warn('CORS_ORIGINS is not set — allowing every origin. Set it to the frontend origin(s).');
  }
  return true;
}

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  // Interactive API docs list every route, admin ones included — off in production unless asked for.
  const swaggerEnabled = !isProduction || process.env.SWAGGER_ENABLED === 'true';

  // Fastify's router rejects any path param over 100 chars by default ("exceeding the max param
  // length"), and slugs are derived from full titles (articles, events, members) with no cap —
  // a long article title produced a ~115-char slug that every /articles/:slug route rejected.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      maxParamLength: 500,
      bodyLimit: 1024 * 1024,
    })
  );

  await app.register(fastifyHelmet, {
    // JSON API: no HTML is served except the dev-only Swagger UI, which needs inline scripts.
    contentSecurityPolicy: swaggerEnabled ? false : undefined,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  app.enableCors({
    origin: corsOrigins(),
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'],
    // Pagination total on paged list endpoints — browsers hide non-safelisted headers otherwise.
    exposedHeaders: ['X-Total-Count'],
    maxAge: 600,
  });

  // Caps apply before any route handler buffers a part: per-file size, file count, and total parts.
  await app.register(fastifyMultipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_UPLOAD_FILES, parts: MAX_UPLOAD_FILES + 10, fields: 10 },
    throwFileSizeLimit: true,
  });

  app.setGlobalPrefix('v1');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  // SIGTERM (a redeploy) waits for in-flight requests and runs onModuleDestroy hooks.
  app.enableShutdownHooks();

  if (swaggerEnabled) {
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
  }

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  logger.log(`Backend listening on port ${port}${swaggerEnabled ? ' (Swagger UI at /api)' : ''}`);
}

bootstrap().catch((err: unknown) => {
  logger.error('Backend failed to start', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
