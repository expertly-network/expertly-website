import { Module, Injectable, type CanActivate, type ExecutionContext, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { AdminEmailController } from './admin-email.controller';
import { EmailService } from './email.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminPermissionGuard } from '../auth/guards/admin-permission.guard';
import { ProfilesRepository } from '../auth/profiles.repository';
import type { AuthenticatedUser } from '../auth/types/auth.types';
const id = 'a0000000-0000-4000-8000-000000000001';
const methods = [
  'listAutomations',
  'updateAutomation',
  'listMessages',
  'getMessage',
  'cancelMessage',
  'retryMessage',
] as const;
const service = Object.fromEntries(
  methods.map((name) => [name, vi.fn().mockResolvedValue(name === 'listMessages' ? { items: [], total: 123 } : { id })])
);
// Replace only JWT parsing for these offline HTTP tests; production role/permission guards run.
@Injectable()
class TestSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: AuthenticatedUser }>();
    const session = request.headers['x-test-session'];
    if (session)
      request.user = {
        id: session,
        email: 'admin@example.com',
        role: session === 'client' ? 'client' : 'admin',
        status: 'active',
        memberStatus: null,
        firstName: 'Alex',
        lastName: 'Admin',
      };
    return true;
  }
}
@Module({
  controllers: [AdminEmailController],
  providers: [
    { provide: EmailService, useValue: service },
    {
      provide: ProfilesRepository,
      useValue: { findById: vi.fn(async (id: string) => ({ id, role: 'admin', status: 'active', admin_role: id })) },
    },
    { provide: APP_GUARD, useClass: TestSessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: AdminPermissionGuard },
  ],
})
class TestModule {}
let app: NestFastifyApplication;
beforeAll(async () => {
  app = await NestFactory.create<NestFastifyApplication>(TestModule, new FastifyAdapter(), { logger: false });
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});
afterAll(async () => {
  await app.close();
});
const routes: [string, string, string, object | undefined, number][] = [
  ['GET', 'automations', 'listAutomations', undefined, 200],
  [
    'PATCH',
    'automations/application_submitted',
    'updateAutomation',
    { enabled: false, resendTemplate: 'application-received' },
    200,
  ],
  ['GET', 'messages', 'listMessages', undefined, 200],
  ['GET', `messages/${id}`, 'getMessage', undefined, 200],
  ['POST', `messages/${id}/cancel`, 'cancelMessage', undefined, 204],
  ['POST', `messages/${id}/retry`, 'retryMessage', undefined, 204],
];
describe('admin email HTTP routes', () => {
  it.each(routes)(
    '%s %s dispatches and returns the documented status',
    async (method, path, handler, payload, status) => {
      const before = service[handler].mock.calls.length;
      const result = await app.inject({
        method: method as 'GET' | 'POST' | 'PATCH',
        url: `/v1/admin/email/${path}`,
        headers: { 'x-test-session': 'super_admin' },
        payload,
      });
      expect(result.statusCode).toBe(status);
      expect(service[handler].mock.calls.length).toBe(before + 1);
      if (path === 'messages') expect(result.headers['x-total-count']).toBe('123');
    }
  );
  it.each(['client', 'reviewer', 'content_manager', ''])('rejects access for %s', async (role) => {
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/v1/admin/email/automations',
          headers: role ? { 'x-test-session': role } : {},
        })
      ).statusCode
    ).toBe(403);
  });
  it('rejects unknown body fields and malformed template aliases', async () => {
    const before = service.updateAutomation.mock.calls.length;
    for (const payload of [{ resendTemplate: 'bad alias!' }, { enabled: true, templateId: id }]) {
      const result = await app.inject({
        method: 'PATCH',
        url: '/v1/admin/email/automations/application_submitted',
        headers: { 'x-test-session': 'super_admin' },
        payload,
      });
      expect(result.statusCode).toBe(400);
    }
    expect(service.updateAutomation.mock.calls.length).toBe(before);
  });
});
