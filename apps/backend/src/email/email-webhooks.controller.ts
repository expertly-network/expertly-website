import {
  Controller,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Public } from '../auth/decorators/public.decorator';
import { EmailConfig } from './email.config';
import { EmailRepository } from './email.repository';
import { verifyResendSignature } from './resend-signature';
import { z } from 'zod';
const eventSchema = z.object({
  type: z.string(),
  created_at: z.string().datetime({ offset: true }).optional(),
  data: z.object({
    email_id: z.string(),
    to: z.array(z.string()).optional(),
    bounce: z.object({ type: z.string() }).optional(),
  }),
});
// 🌐 Provider-authenticated: the exact raw bytes must carry a valid Resend/Svix signature.
@Public()
@Controller('email/webhooks')
export class EmailWebhooksController {
  constructor(
    private readonly config: EmailConfig,
    private readonly repo: EmailRepository
  ) {}
  @Post('resend')
  @HttpCode(204)
  async receive(@Req() request: RawBodyRequest<FastifyRequest>): Promise<void> {
    if (!this.config.webhookSecret)
      throw new ServiceUnavailableException({
        code: 'EMAIL_WEBHOOK_NOT_CONFIGURED',
        message: 'Email webhooks are not configured.',
      });
    const header = (key: string) =>
      typeof request.headers[key] === 'string' ? (request.headers[key] as string) : undefined;
    if (
      !request.rawBody ||
      !verifyResendSignature({
        secret: this.config.webhookSecret,
        id: header('svix-id'),
        timestamp: header('svix-timestamp'),
        signature: header('svix-signature'),
        payload: request.rawBody.toString('utf8'),
      })
    ) {
      throw new UnauthorizedException({
        code: 'EMAIL_WEBHOOK_SIGNATURE_INVALID',
        message: 'Invalid email webhook signature.',
      });
    }
    const event = eventSchema.safeParse(request.body);
    if (!event.success) return;
    const { type, data, created_at } = event.data;
    const status =
      type === 'email.delivered'
        ? 'delivered'
        : type === 'email.bounced'
          ? 'bounced'
          : type === 'email.complained'
            ? 'complained'
            : null;
    if (!status) return;
    await this.repo.applyEvent(
      data.email_id,
      status,
      status === 'complained' || (status === 'bounced' && data.bounce?.type === 'Permanent'),
      created_at ?? new Date().toISOString(),
      // The address the provider actually mailed: suppression must not depend on finding our row.
      data.to?.[0]
    );
  }
}
