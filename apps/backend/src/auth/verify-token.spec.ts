import { SignJWT } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createSigningKey, sessionClaims, signToken, unsignedToken, type TestSigningKey } from '../../test/helpers/jwt';
import { setTrustedKeys } from '../../test/helpers/jwks-mock';
import { verifySupabaseToken, verifySupabaseTokenClaims } from './verify-token';

vi.mock('jose', async (importOriginal) =>
  (await import('../../test/helpers/jwks-mock')).withLocalJwks(await importOriginal())
);

let key: TestSigningKey;
let untrustedKey: TestSigningKey;

beforeAll(async () => {
  key = await createSigningKey('trusted');
  untrustedKey = await createSigningKey('trusted'); // same kid, different key material
  setTrustedKeys([key.publicJwk]);
});

describe('verifySupabaseTokenClaims', () => {
  it('accepts a valid ES256 session token and maps its claims', async () => {
    const token = await signToken(key, sessionClaims({ app_role: 'member', app_member_status: 'active' }));
    await expect(verifySupabaseTokenClaims(token)).resolves.toEqual({
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
        role: 'member',
        status: 'active',
        memberStatus: 'active',
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
      missingStatusClaims: false,
    });
  });

  it('verifySupabaseToken returns just the user', async () => {
    const token = await signToken(key);
    await expect(verifySupabaseToken(token)).resolves.toMatchObject({ role: 'client', status: 'active' });
  });

  it.each([
    ['a wrong audience', { audience: 'anon' }],
    ['a wrong issuer', { issuer: 'https://evil.supabase.test/auth/v1' }],
    ['an expired token', { expiresIn: Math.floor(Date.now() / 1000) - 60 }],
  ])('rejects %s', async (_label, options) => {
    const token = await signToken(key, sessionClaims(), options);
    await expect(verifySupabaseTokenClaims(token)).rejects.toThrow();
  });

  it('rejects a token signed by a key that is not in the JWKS', async () => {
    const token = await signToken(untrustedKey);
    await expect(verifySupabaseTokenClaims(token)).rejects.toThrow();
  });

  it('rejects an HS256 token (algorithm not allowed)', async () => {
    const token = await new SignJWT(sessionClaims())
      .setProtectedHeader({ alg: 'HS256', kid: 'trusted' })
      .setAudience('authenticated')
      .setIssuer('https://project.supabase.test/auth/v1')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('a-shared-secret-that-is-at-least-32-bytes'));
    await expect(verifySupabaseTokenClaims(token)).rejects.toThrow();
  });

  it('rejects an unsigned alg:none token', async () => {
    await expect(verifySupabaseTokenClaims(unsignedToken())).rejects.toThrow();
  });

  it.each(['anon', 'service_role', undefined])('rejects a token whose Postgres role is %s', async (role) => {
    const token = await signToken(key, sessionClaims({ role }));
    await expect(verifySupabaseTokenClaims(token)).rejects.toThrow('not a signed-in user session');
  });

  it.each([undefined, ''])('rejects a token with sub=%j', async (sub) => {
    const token = await signToken(key, sessionClaims({ sub }));
    await expect(verifySupabaseTokenClaims(token)).rejects.toThrow('not a signed-in user session');
  });

  it('falls back to client for an unknown app_role, never to a privileged role', async () => {
    const token = await signToken(key, sessionClaims({ app_role: 'superuser' }));
    await expect(verifySupabaseTokenClaims(token)).resolves.toMatchObject({ user: { role: 'client' } });
  });

  it('treats an unknown app_status as not active', async () => {
    const token = await signToken(key, sessionClaims({ app_status: 'weird' }));
    await expect(verifySupabaseTokenClaims(token)).resolves.toMatchObject({
      user: { status: 'suspended' },
      missingStatusClaims: false,
    });
  });

  it('passes a suspended status through unchanged', async () => {
    const token = await signToken(key, sessionClaims({ app_status: 'suspended' }));
    await expect(verifySupabaseTokenClaims(token)).resolves.toMatchObject({ user: { status: 'suspended' } });
  });

  describe('token minted before the status claims existed', () => {
    it('flags missing claims and never reads a member as active', async () => {
      const token = await signToken(
        key,
        sessionClaims({ app_role: 'member', app_status: undefined, app_member_status: undefined })
      );
      await expect(verifySupabaseTokenClaims(token)).resolves.toMatchObject({
        user: { role: 'member', status: 'suspended', memberStatus: 'deactivated' },
        missingStatusClaims: true,
      });
    });

    it('flags a token missing only app_member_status', async () => {
      const token = await signToken(key, sessionClaims({ app_member_status: undefined }));
      await expect(verifySupabaseTokenClaims(token)).resolves.toMatchObject({
        user: { role: 'client', status: 'active', memberStatus: null },
        missingStatusClaims: true,
      });
    });

    it('gives a non-member a null member status', async () => {
      const token = await signToken(key, sessionClaims({ app_status: undefined, app_member_status: undefined }));
      await expect(verifySupabaseTokenClaims(token)).resolves.toMatchObject({
        user: { role: 'client', memberStatus: null },
        missingStatusClaims: true,
      });
    });
  });

  it('defaults missing name metadata to empty strings', async () => {
    const token = await signToken(key, sessionClaims({ user_metadata: undefined }));
    await expect(verifySupabaseTokenClaims(token)).resolves.toMatchObject({ user: { firstName: '', lastName: '' } });
  });
});
