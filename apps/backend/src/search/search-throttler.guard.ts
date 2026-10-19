import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerOptions } from '@nestjs/throttler';
import { SEARCH_RATE_LIMIT } from './search.config';

interface TrackedRequest {
  user?: { id: string };
  ip?: string;
  body?: { action?: string };
}

/** True when the request body is a feedback action (it uses its own, looser bucket). */
export function isFeedbackRequest(context: ExecutionContext): boolean {
  return context.switchToHttp().getRequest<TrackedRequest>().body?.action === 'feedback';
}

/**
 * Per-user rate limit for /v1/search: named throttlers `minute` + `hour` for questions and `feedback` for
 * action:'feedback' (see SearchModule for the skipIf wiring). Applied with
 * @UseGuards on the controller, so it runs AFTER the global auth guard and `request.user` is
 * populated; the IP fallback only matters if it is ever reused on a public route.
 * In-memory: limits are per API instance.
 */
@Injectable()
export class SearchThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as TrackedRequest;
    return request.user?.id ?? request.ip ?? 'unknown';
  }

  protected async throwThrottlingException(_context: ExecutionContext): Promise<void> {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        // `message` is what the frontend's apiFetch/ApiError surfaces (like every other error).
        message: 'Too many searches. Please wait a moment and try again.',
        retryAfterSeconds: SEARCH_RATE_LIMIT.retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }
}

/** Named throttlers: questions use `minute` + `hour`; feedback uses its own `feedback` bucket. */
export const SEARCH_THROTTLERS: ThrottlerOptions[] = [
  { name: 'minute', ttl: 60_000, limit: SEARCH_RATE_LIMIT.perMinute, skipIf: isFeedbackRequest },
  { name: 'hour', ttl: 3_600_000, limit: SEARCH_RATE_LIMIT.perHour, skipIf: isFeedbackRequest },
  {
    name: 'feedback',
    ttl: 60_000,
    limit: SEARCH_RATE_LIMIT.feedbackPerMinute,
    skipIf: (ctx) => !isFeedbackRequest(ctx),
  },
];
