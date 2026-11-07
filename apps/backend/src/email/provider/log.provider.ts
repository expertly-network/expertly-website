import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { EmailProvider, OutgoingEmail } from './email-provider';
export class LogProvider implements EmailProvider {
  private readonly logger = new Logger(LogProvider.name);
  async send(message: OutgoingEmail): Promise<{ providerMessageId: string }> {
    const providerMessageId = `log-${randomUUID()}`;
    this.logger.log(`Simulated email ${providerMessageId}, template ${message.template.id}`);
    return { providerMessageId };
  }
}
