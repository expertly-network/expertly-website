import { describe, expect, it } from 'vitest';
import { adminRoleHasPermission } from '../auth/constants/admin-permissions';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateEmailAutomationDto, ListEmailMessagesDto } from './dto/email.dto';
describe('email access and request validation', () => {
  it('restricts manageEmails to super administrators (including legacy null super admins)', () => {
    expect(adminRoleHasPermission('super_admin', 'manageEmails')).toBe(true);
    expect(adminRoleHasPermission(null, 'manageEmails')).toBe(true);
    expect(adminRoleHasPermission('reviewer', 'manageEmails')).toBe(false);
    expect(adminRoleHasPermission('content_manager', 'manageEmails')).toBe(false);
  });
  it('rejects malformed template aliases, null edits, unknown filters and unbounded pages', () => {
    const options = { whitelist: true, forbidNonWhitelisted: true };
    const automation = (body: object) => validateSync(plainToInstance(UpdateEmailAutomationDto, body), options);
    expect(automation({ resendTemplate: 'founding-seat-held' })).toHaveLength(0);
    expect(automation({ resendTemplate: 'has spaces' })).not.toHaveLength(0);
    expect(automation({ enabled: null })).not.toHaveLength(0);
    expect(automation({ templateId: 'x' })).not.toHaveLength(0);
    const list = (query: object) => validateSync(plainToInstance(ListEmailMessagesDto, query), options);
    expect(list({ pageSize: '1001' })).not.toHaveLength(0);
    expect(list({ automationKey: 'not_a_key' })).not.toHaveLength(0);
    expect(list({ automationKey: 'renewal_due_soon', status: 'failed' })).toHaveLength(0);
  });
});
