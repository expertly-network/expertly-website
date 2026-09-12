import { Injectable } from '@nestjs/common';
import type { LinkedInImportResponse } from '@shared/membership-application';
import { LinkedInImportProvider } from './linkedin-import.provider';

// Deterministic mock LinkedIn import — derives a fake profile from the URL, omitting
// country/city/yearsOfExperience so those fields must be filled manually.
const SIMULATED_LATENCY_MS = 11_000;

@Injectable()
export class MockLinkedInImportProvider implements LinkedInImportProvider {
  async importProfile(linkedinUrl: string): Promise<LinkedInImportResponse> {
    await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));

    const slug = linkedinUrl.replace(/\/+$/, '').split('/').pop() ?? 'member';
    const name = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const [firstName, ...rest] = name.split(' ').filter(Boolean);

    return {
      firstName: firstName || undefined,
      lastName: rest.join(' ') || undefined,
      bio: 'Experienced professional advising clients across a range of engagements.',
      workExperiences: [
        {
          title: 'Senior Consultant',
          company: 'Independent Practice',
          startYear: 2019,
          isCurrent: true,
        },
      ],
      educations: [{ institution: 'Imported from LinkedIn', degree: 'Not specified' }],
    };
  }
}
