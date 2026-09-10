import type { LinkedInImportResponse } from '@shared/membership-application';

// Abstraction over the LinkedIn import backend, so implementations can be swapped without
// touching callers.
export abstract class LinkedInImportProvider {
  abstract importProfile(linkedinUrl: string): Promise<LinkedInImportResponse>;
}
