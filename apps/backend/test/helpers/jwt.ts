import { SignJWT, exportJWK, generateKeyPair, type JWK, type JWTPayload } from 'jose';

export const TEST_SUPABASE_URL = 'https://project.supabase.test';
export const TEST_ISSUER = `${TEST_SUPABASE_URL}/auth/v1`;

type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

export interface TestSigningKey {
  privateKey: PrivateKey;
  publicJwk: JWK;
}

/** A fresh ES256 key pair, generated locally — the public half stands in for Supabase's JWKS. */
export async function createSigningKey(kid = 'test-key'): Promise<TestSigningKey> {
  const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: 'ES256', use: 'sig' };
  return { privateKey, publicJwk };
}

/** Claims a real Supabase session token carries, with the custom access token hook's claims. */
export function sessionClaims(overrides: JWTPayload = {}): JWTPayload {
  return {
    sub: '11111111-1111-4111-8111-111111111111',
    email: 'user@example.com',
    role: 'authenticated',
    app_role: 'client',
    app_status: 'active',
    app_member_status: null,
    user_metadata: { first_name: 'Ada', last_name: 'Lovelace' },
    ...overrides,
  };
}

export interface SignOptions {
  audience?: string;
  issuer?: string;
  expiresIn?: string | number;
  kid?: string;
}

export async function signToken(
  key: TestSigningKey,
  claims: JWTPayload = sessionClaims(),
  { audience = 'authenticated', issuer = TEST_ISSUER, expiresIn = '1h', kid }: SignOptions = {}
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', kid: kid ?? key.publicJwk.kid })
    .setIssuedAt()
    .setAudience(audience)
    .setIssuer(issuer)
    .setExpirationTime(expiresIn)
    .sign(key.privateKey);
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

/** An unsigned `alg: none` token — must never be accepted. */
export function unsignedToken(claims: JWTPayload = sessionClaims()): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: 'authenticated', iss: TEST_ISSUER, iat: now, exp: now + 3600, ...claims };
  return `${base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${base64url(JSON.stringify(payload))}.`;
}
