import { Injectable } from '@nestjs/common';
import type { LinkedInImportResponse } from '@shared/membership-application';
import { LinkedInImportProvider } from './linkedin-import.provider';

// Deterministic, not random — the same URL always returns the same shape, so manual/browser
// testing is reproducible. Deliberately omits country/city/yearsOfExperience so the "user fills
// what couldn't be imported" UX is exercised for real, not just claimed. Swap point for the real
// n8n-backed provider: implement LinkedInImportProvider and rebind the token in
// applications.module.ts — no other file changes.
//
// Simulated latency: the real n8n-backed provider will genuinely take anywhere from a few
// seconds to a couple of minutes (it's an external workflow call, not a local computation) — an
// instant-resolving mock hides that entirely and makes it impossible to see the frontend's
// ImportingLoader actually cycle through its stages during manual testing. 11s covers roughly
// four of its ~2.6s stage transitions.
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
