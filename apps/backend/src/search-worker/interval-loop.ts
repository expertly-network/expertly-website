import { Logger } from '@nestjs/common';

/**
 * Runs `task` every `intervalMs`, starting immediately. A tick is skipped while the previous run
 * is still going, and a failed run is logged without stopping the loop. `stop()` waits for the
 * in-flight run so a redeploy never cuts a batch mid-way.
 */
export class IntervalLoop {
  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<void> | null = null;
  private stopping = false;

  constructor(
    private readonly name: string,
    private readonly intervalMs: number,
    private readonly task: (shouldStop: () => boolean) => Promise<void>,
    private readonly logger: Logger
  ) {}

  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.inFlight) await this.inFlight;
  }

  private tick(): Promise<void> {
    if (this.stopping) return Promise.resolve();
    if (this.inFlight) {
      this.logger.debug(`${this.name}: previous run still going, skipping tick.`);
      return this.inFlight;
    }
    this.inFlight = this.task(() => this.stopping)
      .catch((err: unknown) => {
        this.logger.error(`${this.name} run failed: ${err instanceof Error ? err.message : String(err)}`);
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }
}
