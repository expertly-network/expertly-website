import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** Every error response body (docs/rest-api.md "Errors"). */
export interface ApiErrorBody {
  statusCode: number;
  /** Stable, machine-readable — clients branch on this, never on `message`. */
  code: string;
  /** Human-readable; an array of messages for request-validation failures. */
  message: string | string[];
  /** Endpoint-specific extras, e.g. `retryAfterSeconds` on 429s. */
  [extra: string]: unknown;
}

const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

// DTO validation (ValidationPipe → message array) and Nest's built-in Parse*Pipes
// ("Validation failed (uuid is expected)") are both request-validation failures.
function isValidationMessage(message: unknown): boolean {
  return Array.isArray(message) || (typeof message === 'string' && message.startsWith('Validation failed'));
}

// What a client sees for a 5xx. The exception's own message is only ever logged: server-side
// failures can carry provider, database or configuration detail. A code with a fixed client-safe
// sentence here gets it; any other 5xx gets its status's generic sentence.
const SERVER_ERROR_MESSAGES: Record<string, string> = {
  AI_NOT_CONFIGURED: 'AI features are not available right now.',
  AI_PROVIDER_ERROR: 'The AI service could not complete the request — try again.',
  AI_TIMEOUT: 'The AI service took too long to respond — try again.',
  COVER_IMAGES_NOT_CONFIGURED: 'Cover image search is not available right now.',
  COVER_IMAGES_PROVIDER_ERROR: 'Cover image search failed — try again.',
  LINKEDIN_IMPORT_FAILED: 'LinkedIn import failed — try again or fill in the form manually.',
  DATABASE_UNAVAILABLE: 'Service temporarily unavailable.',
};

const GENERIC_SERVER_MESSAGES: Record<number, string> = {
  502: 'Upstream service error.',
  503: 'Service temporarily unavailable.',
  504: 'Upstream service timed out.',
};

function serverErrorMessage(status: number, code: string): string {
  return SERVER_ERROR_MESSAGES[code] ?? GENERIC_SERVER_MESSAGES[status] ?? 'Internal server error.';
}

function defaultCode(status: number): string {
  return DEFAULT_CODES[status] ?? `HTTP_${status}`;
}

// Fastify / @fastify/multipart raise plain errors carrying a 4xx `statusCode` and an `FST_*` code
// (body too large, too many files, malformed JSON).
interface FastifyLikeError {
  statusCode?: unknown;
  code?: unknown;
  message?: unknown;
}

function isClientFastifyError(err: unknown): err is FastifyLikeError & { statusCode: number } {
  const e = err as FastifyLikeError | null;
  return typeof e?.statusCode === 'number' && e.statusCode >= 400 && e.statusCode < 500;
}

/**
 * One error shape for the whole API: `{ statusCode, code, message }`. Services throw Nest HTTP
 * exceptions with `{ code, message }` for specific cases; anything without a code gets the
 * status's default code. Unexpected errors are logged with their stack and returned as a generic
 * 500 — never a database or provider message.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    const request = http.getRequest<FastifyRequest | undefined>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      // The original message goes to the log (with the request id to correlate), never the client.
      this.logger.error(
        `${body.code}: ${Array.isArray(body.message) ? body.message.join('; ') : body.message}` +
          (request?.id ? ` reqId=${request.id}` : ''),
        exception instanceof Error ? exception.stack : undefined
      );
      body.message = serverErrorMessage(body.statusCode, body.code);
    }
    void reply.status(body.statusCode).send(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return { statusCode: status, code: defaultCode(status), message: response };
      }
      // Extra keys an endpoint documents (e.g. `retryAfter` on a consultation 409) pass through.
      const r = response as Record<string, unknown>;
      const message =
        typeof r.message === 'string' || Array.isArray(r.message)
          ? (r.message as string | string[])
          : exception.message;
      const code =
        typeof r.code === 'string'
          ? r.code
          : status === HttpStatus.BAD_REQUEST && isValidationMessage(r.message)
            ? 'VALIDATION_FAILED'
            : defaultCode(status);
      return { ...r, statusCode: status, code, message };
    }

    if (isClientFastifyError(exception)) {
      const status = exception.statusCode;
      return {
        statusCode: status,
        code: defaultCode(status),
        message: typeof exception.message === 'string' ? exception.message : 'Bad request.',
      };
    }

    return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error.' };
  }
}
