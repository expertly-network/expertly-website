import type { LinkedInImportResponse } from '@shared/membership-application';

export abstract class LinkedInImportProvider {
  abstract importProfile(linkedinUrl: string): Promise<LinkedInImportResponse>;
}
