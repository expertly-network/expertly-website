// interview-webhooks.controller.ts
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
import { verifyElevenLabsSignature } from './elevenlabs-signature';
import { InterviewConfig } from './interview.config';
import { InterviewWebhooksService } from './interview-webhooks.service';

// 🌐 Provider-authenticated: the raw bytes must carry a valid ElevenLabs signature.
@Public()
@Controller('interviews/webhooks')
export class InterviewWebhooksController {
  constructor(
    private readonly config: InterviewConfig,
    private readonly service: InterviewWebhooksService
  ) {}

  @Post('elevenlabs')
  @HttpCode(200)
  async receive(@Req() request: RawBodyRequest<FastifyRequest>): Promise<void> {
    const secret = this.config.elevenLabs?.webhookSecret;
    if (!secret)
      throw new ServiceUnavailableException({
        code: 'INTERVIEW_WEBHOOK_NOT_CONFIGURED',
        message: 'Interview webhooks are not configured.',
      });
    const header = request.headers['elevenlabs-signature'];
    if (
      !request.rawBody ||
      !verifyElevenLabsSignature({
        secret,
        header: typeof header === 'string' ? header : undefined,
        payload: request.rawBody.toString('utf8'),
      })
    )
      throw new UnauthorizedException({
        code: 'INTERVIEW_WEBHOOK_SIGNATURE_INVALID',
        message: 'Invalid webhook signature.',
      });
    await this.service.handle(request.body);
  }
}
