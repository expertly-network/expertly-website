import { Injectable } from '@nestjs/common';
@Injectable()
export class EmailConfig {
  readonly from = process.env.EMAIL_FROM || 'GrowXQ <hello@growxq.com>';
  readonly replyTo = process.env.EMAIL_REPLY_TO || 'ask@growxq.com';
  readonly redirectTo = process.env.NODE_ENV === 'production' ? undefined : process.env.EMAIL_REDIRECT_TO || undefined;
  readonly siteUrl = (process.env.SITE_URL || 'https://growxq.com').replace(/\/$/, '');
  readonly webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
}
