import { createHmac } from 'node:crypto';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { EmailWebhooksController } from './email-webhooks.controller';
import { EmailConfig } from './email.config';
import { EmailRepository } from './email.repository';
const key = Buffer.from('webhook-test-key');
const config = { webhookSecret: 'whsec_' + key.toString('base64') };
const repo = { applyEvent: vi.fn().mockResolvedValue(undefined) };
@Module({
  controllers: [EmailWebhooksController],
  providers: [
    { provide: EmailConfig, useValue: config },
    { provide: EmailRepository, useValue: repo },
  ],
})
class TestModule {}
let app: NestFastifyApplication;
beforeAll(async () => {
  app = await NestFactory.create<NestFastifyApplication>(TestModule, new FastifyAdapter(), {
    rawBody: true,
    logger: false,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});
afterAll(async () => {
  await app.close();
});
function signed(payload: string) {
  const timestamp = String(Math.floor(Date.now() / 1000)),
    id = 'event-1';
  return {
    'content-type': 'application/json',
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': 'v1,' + createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64'),
  };
}
describe('Resend webhook HTTP boundary', () => {
  it.each([
    ['email.delivered', undefined, 'delivered', false],
    ['email.bounced', 'Permanent', 'bounced', true],
    ['email.bounced', 'Transient', 'bounced', false],
    ['email.complained', undefined, 'complained', true],
  ])('handles %s / %s from exact signed raw bytes', async (type, bounceType, status, suppress) => {
    const payload = JSON.stringify(
      {
        type,
        data: {
          email_id: 'provider-1',
          to: ['person@example.com'],
          ...(bounceType ? { bounce: { type: bounceType } } : {}),
        },
      },
      null,
      2
    );
    const response = await app.inject({
      method: 'POST',
      url: '/email/webhooks/resend',
      headers: signed(payload),
      payload,
    });
    expect(response.statusCode).toBe(204);
    expect(repo.applyEvent).toHaveBeenLastCalledWith(
      'provider-1',
      status,
      suppress,
      expect.any(String),
      'person@example.com'
    );
  });
  it('rejects a tampered payload', async () => {
    const payload = '{"type":"email.delivered","data":{"email_id":"provider-1"}}';
    const before = repo.applyEvent.mock.calls.length;
    const response = await app.inject({
      method: 'POST',
      url: '/email/webhooks/resend',
      headers: signed(payload),
      payload: payload + ' ',
    });
    expect(response.statusCode).toBe(401);
    expect(repo.applyEvent.mock.calls.length).toBe(before);
  });
  it('acknowledges unrelated events without changing a message', async () => {
    const payload = '{"type":"email.sent","data":{"email_id":"unknown"}}';
    const before = repo.applyEvent.mock.calls.length;
    expect(
      (await app.inject({ method: 'POST', url: '/email/webhooks/resend', headers: signed(payload), payload }))
        .statusCode
    ).toBe(204);
    expect(repo.applyEvent.mock.calls.length).toBe(before);
  });
  it('fails closed when webhook verification is not configured', async () => {
    const prior = config.webhookSecret;
    config.webhookSecret = '';
    try {
      expect((await app.inject({ method: 'POST', url: '/email/webhooks/resend', payload: {} })).statusCode).toBe(503);
    } finally {
      config.webhookSecret = prior;
    }
  });
});
