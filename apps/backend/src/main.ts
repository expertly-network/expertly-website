import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { AppModule } from './app.module';
import { loadApiEnv, parseCorsOrigins } from './config/env';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { MAX_UPLOAD_FILES, MAX_UPLOAD_BYTES } from './common/upload-limits';

const logger = new Logger('Bootstrap');

// Comma-separated browser origins allowed to call the API (e.g.
// "https://growxq.com,https://www.growxq.com"). Auth is a bearer token, not a cookie, so CORS is
// defense-in-depth here. Env validation already refuses to boot production without the list; an
// unset list outside production means "any origin" for local dev.
function corsOrigins(raw: string | undefined): string[] | true {
  const origins = parseCorsOrigins(raw);
  if (origins.length > 0) return origins;
  logger.warn('CORS_ORIGINS is not set — allowing every origin (development only).');
  return true;
}

// A caller-supplied X-Request-Id is kept only if it looks like an id (it ends up in log lines);
// anything else gets a fresh UUID.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
function requestId(raw: IncomingMessage): string {
  const header = raw.headers['x-request-id'];
  return typeof header === 'string' && REQUEST_ID_PATTERN.test(header) ? header : randomUUID();
}

// One access-log line per request: method, path (query string dropped — it can carry search text
// or tokens), status, duration, request id. No headers or bodies are logged at all, so
// Authorization and cookies never reach the logs. Health probes are skipped to keep it quiet.
function registerRequestLogging(fastify: FastifyInstance): void {
  const accessLogger = new Logger('HTTP');
  fastify.addHook('onRequest', (request, reply, done) => {
    void reply.header('x-request-id', request.id);
    done();
  });
  fastify.addHook('onResponse', (request, reply, done) => {
    const path = request.url.split('?', 1)[0];
    if (!path.startsWith('/v1/health')) {
      const line = `${request.method} ${path} ${reply.statusCode} ${Math.round(reply.elapsedTime)}ms reqId=${request.id}`;
      if (reply.statusCode >= 500) accessLogger.error(line);
      else if (reply.statusCode >= 400) accessLogger.warn(line);
      else accessLogger.log(line);
    }
    done();
  });
}

async function bootstrap() {
  const config = loadApiEnv();
  const isProduction = config.NODE_ENV === 'production';
  // Interactive API docs list every route, admin ones included — off in production unless asked for.
  const swaggerEnabled = !isProduction || config.SWAGGER_ENABLED === 'true';

  // Fastify's router rejects any path param over 100 chars by default ("exceeding the max param
  // length"), and slugs are derived from full titles (articles, events, members) with no cap —
  // a long article title produced a ~115-char slug that every /articles/:slug route rejected.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      routerOptions: { maxParamLength: 500 },
      bodyLimit: 1024 * 1024,
      genReqId: requestId,
    })
  );

  registerRequestLogging(app.getHttpAdapter().getInstance());

  await app.register(fastifyHelmet, {
    // JSON API: no HTML is served except the dev-only Swagger UI, which needs inline scripts.
    contentSecurityPolicy: swaggerEnabled ? false : undefined,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  app.enableCors({
    origin: corsOrigins(config.CORS_ORIGINS),
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

  const port = config.PORT;
  await app.listen(port, '0.0.0.0');
  logger.log(`Backend listening on port ${port}${swaggerEnabled ? ' (Swagger UI at /api)' : ''}`);
}

bootstrap().catch((err: unknown) => {
  logger.error('Backend failed to start', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
