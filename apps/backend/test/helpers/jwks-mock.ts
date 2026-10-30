import type { FlattenedJWSInput, JWK, JWSHeaderParameters } from 'jose';

type Jose = typeof import('jose');

// verify-token.ts fetches Supabase's JWKS over the network via createRemoteJWKSet. Specs swap in
// a local key set generated in the test:
//
//   vi.mock('jose', async (importOriginal) =>
//     (await import('<path>/test/helpers/jwks-mock')).withLocalJwks(await importOriginal()));
//
// This module imports nothing from 'jose' at runtime, so loading it from inside the mock factory
// can't deadlock on the module being mocked.
let localKeys: JWK[] = [];

export function setTrustedKeys(keys: JWK[]): void {
  localKeys = keys;
}

export function withLocalJwks(actual: Jose): Jose {
  return {
    ...actual,
    createRemoteJWKSet: (() => (protectedHeader: JWSHeaderParameters, token: FlattenedJWSInput) =>
      actual.createLocalJWKSet({ keys: localKeys })(protectedHeader, token)) as unknown as Jose['createRemoteJWKSet'],
  };
}
