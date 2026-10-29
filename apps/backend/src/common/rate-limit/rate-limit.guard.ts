import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DEFAULT_RATE_LIMIT, RATE_LIMIT_KEY, type RateLimitPolicy } from './rate-limit.decorator';

interface TrackedRequest {
  user?: { id: string };
}

// Drop idle counters once this many requests have gone by since the last sweep.
const SWEEP_EVERY_REQUESTS = 1000;

/**
 * Sliding-window, per-user rate limit for every authenticated route (global guard, registered
 * after SupabaseAuthGuard so `request.user` is set).
 *
 * Anonymous requests are deliberately not counted: public pages are server-rendered by the
 * Next.js app, so every signed-out visitor's API call arrives from the same server IP — an
 * IP-keyed limit would throttle all of them together (and hand an attacker a way to lock everyone
 * out). Public endpoints are protected instead by capped page sizes, Next's data cache, and an
 * edge rate limit at the reverse proxy (docs/deployment.md).
 * Counters are in-memory, i.e. per API instance — a horizontally scaled
 * deployment multiplies every limit by the instance count; move to a shared store (Redis) then.
 * POST /v1/search additionally has its own, stricter SearchThrottlerGuard.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  // `${bucket}:${caller}` -> request timestamps (ms) inside the policy's longest window.
  private readonly hits = new Map<string, { timestamps: number[]; windowMs: number }>();
  private requestsSinceSweep = 0;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const policy =
      this.reflector.getAllAndOverride<RateLimitPolicy | undefined>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_RATE_LIMIT;

    const userId = context.switchToHttp().getRequest<TrackedRequest>().user?.id;
    if (!userId) return true;
    const key = `${policy.bucket}:${userId}`;
    const now = Date.now();
    const windowMs = Math.max(...policy.rules.map((r) => r.windowSeconds * 1000));

    const entry = this.hits.get(key) ?? { timestamps: [], windowMs };
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

    for (const rule of policy.rules) {
      const ruleMs = rule.windowSeconds * 1000;
      const inWindow = entry.timestamps.filter((t) => now - t < ruleMs);
      if (inWindow.length >= rule.limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((inWindow[0] + ruleMs - now) / 1000));
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please wait a moment and try again.',
            retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }

    entry.timestamps.push(now);
    this.hits.set(key, entry);
    this.sweep(now);
    return true;
  }

  private sweep(now: number): void {
    if (++this.requestsSinceSweep < SWEEP_EVERY_REQUESTS) return;
    this.requestsSinceSweep = 0;
    for (const [key, entry] of this.hits) {
      const last = entry.timestamps[entry.timestamps.length - 1];
      if (last === undefined || now - last >= entry.windowMs) this.hits.delete(key);
    }
  }
}
