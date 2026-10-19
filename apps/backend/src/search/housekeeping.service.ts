import { Injectable, Logger } from '@nestjs/common';
import { SearchRepository } from './search.repository';

const DAY_MS = 24 * 60 * 60 * 1000;
export const OUTBOX_RETENTION_DAYS = 7;
export const QUERY_LOG_RETENTION_DAYS = 365;

/** Daily cleanup that replaces the pg_cron `search-housekeeping` job / search_housekeeping(). */
@Injectable()
export class HousekeepingService {
  private readonly logger = new Logger(HousekeepingService.name);

  constructor(private readonly repo: SearchRepository) {}

  async run(now: Date = new Date()): Promise<{ outbox: number; queryLog: number }> {
    const outbox = await this.repo.deleteProcessedOutboxBefore(new Date(now.getTime() - OUTBOX_RETENTION_DAYS * DAY_MS));
    const queryLog = await this.repo.deleteQueryLogsBefore(new Date(now.getTime() - QUERY_LOG_RETENTION_DAYS * DAY_MS));
    if (outbox > 0 || queryLog > 0) this.logger.log(`Housekeeping removed ${outbox} outbox row(s), ${queryLog} log row(s).`);
    return { outbox, queryLog };
  }
}
