import { BadGatewayException, Injectable, Logger, RequestTimeoutException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  EducationInput,
  LinkedInImportResponse,
  WorkExperienceInput,
} from '@shared/membership-application';
import { LinkedInImportProvider } from './linkedin-import.provider';

// Apify runs backing this workflow can legitimately take up to ~90s (see the design doc's
// reference to the dormant BullMQ worker's own 90s poll ceiling) — set above that, not at it.
const REQUEST_TIMEOUT_MS = 100_000;
const MAX_EXPERIENCES = 5;
const MAX_EDUCATIONS = 3;
const BIO_MAX_CHARS = 500;

// LinkedIn/Apify date fields give month as a 3-letter abbreviation, not a number — this app's
// WorkExperienceInput wants startMonth/endMonth as 1-12.
const MONTH_NUM: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

interface RawDate {
  month?: string;
  year?: number;
  text?: string;
}

interface RawExperience {
  position?: string;
  companyName?: string;
  location?: string;
  startDate?: RawDate;
  endDate?: RawDate;
}

interface RawEducation {
  schoolName?: string;
  degree?: string | null;
  fieldOfStudy?: string;
  startDate?: { year?: number };
  endDate?: { year?: number };
}

interface RawLinkedInProfile {
  firstName?: string;
  lastName?: string;
  about?: string;
  location?: { parsed?: { city?: string; state?: string; country?: string } };
  experience?: RawExperience[];
  education?: RawEducation[];
}

// Drops an entry entirely if a genuinely-required field (title/company/startYear) is missing —
// fabricating one would misrepresent the applicant's real history. See design doc §2.
function mapExperience(raw: RawExperience[] | undefined): WorkExperienceInput[] {
  return (raw ?? [])
    .slice(0, MAX_EXPERIENCES)
    .map((e): WorkExperienceInput | null => {
      const startYear = e.startDate?.year;
      if (!e.position || !e.companyName || !startYear) return null;
      return {
        title: e.position,
        company: e.companyName,
        // LinkedIn only exposes companyLinkedinUrl (a LinkedIn company page), never the company's
        // real website — this app's companyUrl field means the latter, so it's left for the
        // applicant to fill in rather than substituting a LinkedIn page URL for it.
        companyUrl: '',
        city: e.location?.split(',')[0]?.trim() || undefined,
        startMonth: e.startDate?.month ? MONTH_NUM[e.startDate.month] : undefined,
        startYear,
        endMonth: e.endDate?.month ? MONTH_NUM[e.endDate.month] : undefined,
        endYear: e.endDate?.text === 'Present' ? undefined : e.endDate?.year,
        isCurrent: e.endDate?.text === 'Present',
      };
    })
    .filter((e): e is WorkExperienceInput => e !== null);
}

// A missing `degree` defaults to the same 'Not specified' placeholder MockLinkedInImportProvider
// already uses — the save endpoint's @IsNotEmpty() on degree would 400 on a raw empty/null value.
// Only drops an entry if `institution` itself is missing. See design doc §2.
function mapEducation(raw: RawEducation[] | undefined): EducationInput[] {
  return (raw ?? [])
    .slice(0, MAX_EDUCATIONS)
    .map((e): EducationInput | null => {
      if (!e.schoolName) return null;
      return {
        institution: e.schoolName,
        degree: e.degree || 'Not specified',
        fieldOfStudy: e.fieldOfStudy || undefined,
        startYear: e.startDate?.year,
        endYear: e.endDate?.year,
      };
    })
    .filter((e): e is EducationInput => e !== null);
}

@Injectable()
export class N8nLinkedInImportProvider implements LinkedInImportProvider {
  private readonly logger = new Logger(N8nLinkedInImportProvider.name);

  async importProfile(linkedinUrl: string): Promise<LinkedInImportResponse> {
    const webhookUrl = process.env.LINKEDIN_IMPORT_WEBHOOK_URL;
    if (!webhookUrl) {
      // Only reachable if applications.module.ts's binding is bypassed — the module decides
      // real-vs-mock at construction (Task 3), so this is a defensive guard, not the normal path.
      throw new BadGatewayException('LinkedIn import is not configured.');
    }

    const raw = await this.fetchProfile(webhookUrl, linkedinUrl);
    return this.toResponse(raw);
  }

  private async fetchProfile(
    webhookUrl: string,
    linkedinUrl: string
  ): Promise<RawLinkedInProfile | undefined> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      // n8n Chat Trigger contract, confirmed live against n8n.expertly.network (2026-08-25) —
      // NOT { profileUrl } as the ported reference doc assumed. sessionId is fresh per call so
      // concurrent imports from different users never share n8n chat-memory state.
      res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatInput: linkedinUrl, sessionId: randomUUID() }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.error(`LinkedIn import timed out for ${linkedinUrl}`);
        throw new RequestTimeoutException('LinkedIn import timed out.');
      }
      this.logger.error(`Failed to reach LinkedIn import service: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadGatewayException('Failed to reach LinkedIn import service.');
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      this.logger.error(`LinkedIn import service returned ${res.status} ${res.statusText}`);
      throw new BadGatewayException('LinkedIn import service returned an error.');
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      this.logger.error('LinkedIn import service returned an invalid response body.');
      throw new BadGatewayException('LinkedIn import service returned an invalid response.');
    }

    // Confirmed live: response is a bare object, not the reference doc's assumed array — handle
    // both defensively in case that ever changes upstream.
    return (Array.isArray(data) ? data[0] : data) as RawLinkedInProfile | undefined;
  }

  private toResponse(raw: RawLinkedInProfile | undefined): LinkedInImportResponse {
    if (!raw) return {};
    return {
      firstName: raw.firstName || undefined,
      lastName: raw.lastName || undefined,
      bio: raw.about ? raw.about.slice(0, BIO_MAX_CHARS) : undefined,
      country: raw.location?.parsed?.country || undefined,
      state: raw.location?.parsed?.state || undefined,
      city: raw.location?.parsed?.city || undefined,
      workExperiences: mapExperience(raw.experience),
      educations: mapEducation(raw.education),
    };
  }
}
