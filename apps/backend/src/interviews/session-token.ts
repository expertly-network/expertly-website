// session-token.ts
import { createHash, randomBytes } from 'node:crypto';

// Issued once per connection; only its hash is stored (member_interview_connections).
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
