import { IsOptional, IsUrl, Matches, MaxLength } from 'class-validator';

// Forwarded to the (paid) scraping agent, so only a LinkedIn profile URL is accepted — never an
// arbitrary URL or free text that the agent would act on. Scheme and subdomain are optional
// ("linkedin.com/in/jane", "https://uk.linkedin.com/in/jane/").
export const LINKEDIN_PROFILE_URL_PATTERN = /^(https?:\/\/)?([a-z]{2,3}\.|www\.)?linkedin\.com\/in\/[^\s/?#]+\/?([?#]\S*)?$/i;

export class LinkedInImportRequestDto {
  @MaxLength(300)
  @Matches(LINKEDIN_PROFILE_URL_PATTERN, { message: 'linkedinUrl must be a LinkedIn profile URL (linkedin.com/in/…).' })
  linkedinUrl!: string;
}

// The backend fetches this URL server-side, so it's pinned to LinkedIn's media CDN over https —
// never an arbitrary host (SSRF).
export class LinkedInPhotoImportRequestDto {
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true, host_whitelist: ['media.licdn.com'] })
  @Matches(/^https:\/\/media\.licdn\.com\//, { message: 'sourceUrl must be a media.licdn.com URL.' })
  sourceUrl?: string;
}
