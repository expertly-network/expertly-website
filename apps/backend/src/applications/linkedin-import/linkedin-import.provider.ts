import type { LinkedInImportResponse } from '@shared/membership-application';

// DI abstraction so the not-yet-ready n8n integration can be swapped in later without touching
// the controller, DTO, or frontend. See docs/superpowers/specs/2026-08-23-member-application-form-design.md
// §5 — bind the real implementation to this token in applications.module.ts when it's ready.
export abstract class LinkedInImportProvider {
  abstract importProfile(linkedinUrl: string): Promise<LinkedInImportResponse>;
}
