import 'reflect-metadata';
import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { httpContext, type FakeRequest } from '../../../test/helpers/execution-context';
import { fakeSupabaseService, type QueryResolver } from '../../../test/helpers/fake-supabase';
import { setTrustedKeys } from '../../../test/helpers/jwks-mock';
import { createSigningKey, sessionClaims, signToken, type TestSigningKey } from '../../../test/helpers/jwt';
import { OptionalResourceAuthGuard } from '../../resources/optional-resource-auth.guard';
import { ADMIN_PERMISSIONS, type AdminPermission, type AdminRole } from '../constants/admin-permissions';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRED_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { ProfileRoleRow, ProfilesRepository } from '../profiles.repository';
import type { AuthenticatedUser, Role } from '../types/auth.types';
import { AdminPermissionGuard } from './admin-permission.guard';
import { RolesGuard } from './roles.guard';
import { SupabaseAuthGuard } from './supabase-auth.guard';

vi.mock('jose', async (importOriginal) =>
  (await import('../../../test/helpers/jwks-mock')).withLocalJwks(await importOriginal())
);

let key: TestSigningKey;
beforeAll(async () => {
  key = await createSigningKey();
  setTrustedKeys([key.publicJwk]);
});

const USER_ID = '11111111-1111-4111-8111-111111111111';

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: USER_ID,
    email: 'user@example.com',
    role: 'client',
    status: 'active',
    memberStatus: null,
    firstName: 'Ada',
    lastName: 'Lovelace',
    ...overrides,
  };
}

// A route handler carrying the given decorator metadata.
function handlerWith(metadata: Record<string, unknown>): () => void {
  const handler = () => undefined;
  for (const [k, v] of Object.entries(metadata)) Reflect.defineMetadata(k, v, handler);
  return handler;
}

/** Runs a guard and returns the error code it threw (or 'ALLOWED'). */
async function outcome(run: () => boolean | Promise<boolean>): Promise<string> {
  try {
    expect(await run()).toBe(true);
    return 'ALLOWED';
  } catch (err) {
    if (!(err instanceof HttpException)) throw err;
    const body = err.getResponse() as { code: string };
    return `${err.getStatus()} ${body.code}`;
  }
}

function profiles(row: ProfileRoleRow | null): ProfilesRepository & { findById: ReturnType<typeof vi.fn> } {
  return { findById: vi.fn().mockResolvedValue(row) } as unknown as ProfilesRepository & {
    findById: ReturnType<typeof vi.fn>;
  };
}

describe('SupabaseAuthGuard', () => {
  function guardWith(resolver: QueryResolver = () => ({ data: null })) {
    const { service, calls } = fakeSupabaseService(resolver);
    return { guard: new SupabaseAuthGuard(new Reflector(), service), calls };
  }

  async function run(guard: SupabaseAuthGuard, request: FakeRequest, handler: () => void = () => undefined) {
    return outcome(() => guard.canActivate(httpContext(request, handler)));
  }

  it('lets @Public() routes through without a token', async () => {
    const { guard } = guardWith();
    const request: FakeRequest = { headers: {} };
    expect(await run(guard, request, handlerWith({ [IS_PUBLIC_KEY]: true }))).toBe('ALLOWED');
    expect(request.user).toBeUndefined();
  });

  it.each([undefined, 'Basic abc', 'Bearer', 'bearer token'])(
    'rejects authorization=%j with 401 SESSION_MISSING',
    async (header) => {
      const { guard } = guardWith();
      expect(await run(guard, { headers: { authorization: header } })).toBe('401 SESSION_MISSING');
    }
  );

  it('rejects an invalid token with 401 SESSION_INVALID', async () => {
    const { guard } = guardWith();
    expect(await run(guard, { headers: { authorization: 'Bearer not-a-jwt' } })).toBe('401 SESSION_INVALID');
  });

  it('attaches the claim-derived user without touching the database', async () => {
    const { guard, calls } = guardWith();
    const request: FakeRequest = { headers: { authorization: `Bearer ${await signToken(key)}` } };
    expect(await run(guard, request)).toBe('ALLOWED');
    expect(request.user).toMatchObject({ id: USER_ID, role: 'client', status: 'active' });
    expect(calls).toHaveLength(0);
  });

  it.each(['suspended', 'deleted'])('refuses a %s account with 403 ACCOUNT_SUSPENDED', async (status) => {
    const { guard } = guardWith();
    const token = await signToken(key, sessionClaims({ app_status: status }));
    expect(await run(guard, { headers: { authorization: `Bearer ${token}` } })).toBe('403 ACCOUNT_SUSPENDED');
  });

  describe('token without status claims', () => {
    const legacyClaims = (role: Role) =>
      sessionClaims({ app_role: role, app_status: undefined, app_member_status: undefined });

    it('reads both statuses fresh and admits an active member', async () => {
      const { guard, calls } = guardWith(({ table }) =>
        table === 'profiles' ? { data: { status: 'active', deleted_at: null } } : { data: { status: 'active' } }
      );
      const request: FakeRequest = {
        headers: { authorization: `Bearer ${await signToken(key, legacyClaims('member'))}` },
      };
      expect(await run(guard, request)).toBe('ALLOWED');
      expect(request.user).toMatchObject({ role: 'member', status: 'active', memberStatus: 'active' });
      expect(calls.map((c) => c.table).sort()).toEqual(['member_profiles', 'profiles']);
    });

    it('keeps a deactivated member deactivated', async () => {
      const { guard } = guardWith(({ table }) =>
        table === 'profiles' ? { data: { status: 'active', deleted_at: null } } : { data: { status: 'deactivated' } }
      );
      const request: FakeRequest = {
        headers: { authorization: `Bearer ${await signToken(key, legacyClaims('member'))}` },
      };
      expect(await run(guard, request)).toBe('ALLOWED');
      expect(request.user).toMatchObject({ memberStatus: 'deactivated' });
    });

    it('never gives a non-member a member status', async () => {
      const { guard } = guardWith(({ table }) =>
        table === 'profiles' ? { data: { status: 'active', deleted_at: null } } : { data: { status: 'active' } }
      );
      const request: FakeRequest = {
        headers: { authorization: `Bearer ${await signToken(key, legacyClaims('client'))}` },
      };
      expect(await run(guard, request)).toBe('ALLOWED');
      expect(request.user).toMatchObject({ role: 'client', memberStatus: null });
    });

    it.each<[string, QueryResolver]>([
      ['the profile is suspended', () => ({ data: { status: 'suspended', deleted_at: null } })],
      ['the profile is soft-deleted', () => ({ data: { status: 'active', deleted_at: '2026-10-01T00:00:00Z' } })],
      ['the profile is missing', () => ({ data: null })],
      ['the lookup fails', () => ({ error: { message: 'connection refused' } })],
    ])('refuses with 403 ACCOUNT_SUSPENDED when %s', async (_label, resolver) => {
      const { guard } = guardWith(resolver);
      const token = await signToken(key, legacyClaims('client'));
      expect(await run(guard, { headers: { authorization: `Bearer ${token}` } })).toBe('403 ACCOUNT_SUSPENDED');
    });
  });
});

describe('RolesGuard', () => {
  const memberRoute = handlerWith({ [ROLES_KEY]: ['member'] });
  const adminRoute = handlerWith({ [ROLES_KEY]: ['admin'] });
  const activeAdmin: ProfileRoleRow = { role: 'admin', status: 'active', admin_role: null };

  function run(guard: RolesGuard, caller: AuthenticatedUser | undefined, handler: () => void) {
    return outcome(() => guard.canActivate(httpContext({ headers: {}, user: caller }, handler)));
  }

  it('allows routes without @Roles() and never reads the DB for them', async () => {
    const repo = profiles(null);
    expect(await run(new RolesGuard(new Reflector(), repo), user(), () => undefined)).toBe('ALLOWED');
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('refuses a route with @Roles() when no user was resolved', async () => {
    expect(await run(new RolesGuard(new Reflector(), profiles(null)), undefined, memberRoute)).toBe(
      '403 SESSION_MISSING'
    );
  });

  it.each<[Role, string, string]>([
    ['client', 'member', '403 ROLE_REQUIRED'],
    ['member', 'member', 'ALLOWED'],
    ['admin', 'member', 'ALLOWED'],
    ['client', 'admin', '403 ROLE_REQUIRED'],
    ['member', 'admin', '403 ROLE_REQUIRED'],
    ['admin', 'admin', 'ALLOWED'],
  ])('rank model: %s on a %s route → %s', async (role, required, expected) => {
    const guard = new RolesGuard(new Reflector(), profiles(activeAdmin));
    const caller = user({ role, memberStatus: role === 'member' ? 'active' : null });
    expect(await run(guard, caller, required === 'member' ? memberRoute : adminRoute)).toBe(expected);
  });

  it('refuses a deactivated member with 403 MEMBER_DEACTIVATED', async () => {
    const guard = new RolesGuard(new Reflector(), profiles(null));
    expect(await run(guard, user({ role: 'member', memberStatus: 'deactivated' }), memberRoute)).toBe(
      '403 MEMBER_DEACTIVATED'
    );
  });

  it('re-checks admin routes against profiles, never trusting the claim alone', async () => {
    const repo = profiles(activeAdmin);
    expect(await run(new RolesGuard(new Reflector(), repo), user({ role: 'admin' }), adminRoute)).toBe('ALLOWED');
    expect(repo.findById).toHaveBeenCalledWith(USER_ID);
  });

  it('does not fresh-check an admin on a member route', async () => {
    const repo = profiles(null);
    expect(await run(new RolesGuard(new Reflector(), repo), user({ role: 'admin' }), memberRoute)).toBe('ALLOWED');
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it.each<[string, ProfileRoleRow | null]>([
    ['demoted to member', { role: 'member', status: 'active', admin_role: null }],
    ['suspended', { role: 'admin', status: 'suspended', admin_role: null }],
    ['missing', null],
  ])('refuses an admin claim whose profile is %s with 403 ADMIN_NOT_CONFIRMED', async (_label, row) => {
    const guard = new RolesGuard(new Reflector(), profiles(row));
    expect(await run(guard, user({ role: 'admin' }), adminRoute)).toBe('403 ADMIN_NOT_CONFIRMED');
  });
});

describe('AdminPermissionGuard', () => {
  const ALL: AdminPermission[] = ADMIN_PERMISSIONS.super_admin;

  function run(guard: AdminPermissionGuard, permission: AdminPermission | undefined, caller = user({ role: 'admin' })) {
    const handler = handlerWith(permission ? { [REQUIRED_PERMISSION_KEY]: permission } : {});
    return outcome(() => guard.canActivate(httpContext({ headers: {}, user: caller }, handler)));
  }

  it('allows routes with no @RequiresPermission() without a DB read', async () => {
    const repo = profiles(null);
    expect(await run(new AdminPermissionGuard(new Reflector(), repo), undefined)).toBe('ALLOWED');
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('refuses when no user was resolved', async () => {
    const guard = new AdminPermissionGuard(new Reflector(), profiles(null));
    const handler = handlerWith({ [REQUIRED_PERMISSION_KEY]: 'manageMembers' });
    expect(await outcome(() => guard.canActivate(httpContext({ headers: {} }, handler)))).toBe('403 SESSION_MISSING');
  });

  // The permission matrix, spelled out so a change to ADMIN_PERMISSIONS is a deliberate diff here.
  const GRANTED: Record<AdminRole, AdminPermission[]> = {
    super_admin: ALL,
    content_manager: [
      'viewDashboard',
      'manageApplications',
      'manageArticles',
      'writeArticles',
      'manageEvents',
      'manageResources',
      'manageTaxonomy',
    ],
    reviewer: ['viewDashboard', 'manageApplications'],
  };

  for (const adminRole of ['super_admin', 'content_manager', 'reviewer'] as AdminRole[]) {
    it.each(ALL)(`${adminRole}: %s`, async (permission) => {
      const guard = new AdminPermissionGuard(
        new Reflector(),
        profiles({ role: 'admin', status: 'active', admin_role: adminRole })
      );
      expect(await run(guard, permission)).toBe(
        GRANTED[adminRole].includes(permission) ? 'ALLOWED' : '403 PERMISSION_REQUIRED'
      );
    });
  }

  it.each(ALL)('treats a null admin_role as super_admin: %s', async (permission) => {
    const guard = new AdminPermissionGuard(
      new Reflector(),
      profiles({ role: 'admin', status: 'active', admin_role: null })
    );
    expect(await run(guard, permission)).toBe('ALLOWED');
  });

  it.each<[string, ProfileRoleRow | null]>([
    ['no longer an admin', { role: 'member', status: 'active', admin_role: 'super_admin' }],
    ['missing', null],
  ])('refuses with 403 ADMIN_NOT_CONFIRMED when the profile is %s', async (_label, row) => {
    const guard = new AdminPermissionGuard(new Reflector(), profiles(row));
    expect(await run(guard, 'manageMembers')).toBe('403 ADMIN_NOT_CONFIRMED');
  });
});

describe('OptionalResourceAuthGuard', () => {
  const guard = new OptionalResourceAuthGuard();

  async function run(authorization: string | undefined) {
    const request: FakeRequest = { headers: { authorization } };
    const result = await outcome(() => guard.canActivate(httpContext(request)));
    return { result, user: request.user as AuthenticatedUser | undefined };
  }

  it('serves a request without a header as a guest', async () => {
    expect(await run(undefined)).toEqual({ result: 'ALLOWED', user: undefined });
  });

  it.each(['Bearer not-a-jwt', 'Basic abc', 'Bearer a b'])('rejects authorization=%j with 401', async (header) => {
    expect((await run(header)).result).toBe('401 SESSION_INVALID');
  });

  it('attaches an active member as a member', async () => {
    const token = await signToken(key, sessionClaims({ app_role: 'member', app_member_status: 'active' }));
    expect(await run(`Bearer ${token}`)).toMatchObject({ result: 'ALLOWED', user: { role: 'member' } });
  });

  it('serves a suspended account as a guest', async () => {
    const token = await signToken(key, sessionClaims({ app_role: 'member', app_status: 'suspended' }));
    expect(await run(`Bearer ${token}`)).toEqual({ result: 'ALLOWED', user: undefined });
  });

  it('serves a token without status claims as a guest (not assumed active)', async () => {
    const token = await signToken(
      key,
      sessionClaims({ app_role: 'member', app_status: undefined, app_member_status: undefined })
    );
    expect(await run(`Bearer ${token}`)).toEqual({ result: 'ALLOWED', user: undefined });
  });

  it('downgrades a deactivated member to client', async () => {
    const token = await signToken(key, sessionClaims({ app_role: 'member', app_member_status: 'deactivated' }));
    expect(await run(`Bearer ${token}`)).toMatchObject({ result: 'ALLOWED', user: { role: 'client' } });
  });
});
