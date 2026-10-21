import { IsOptional, IsUrl, Matches } from 'class-validator';

export class LinkedInImportRequestDto {
  @IsUrl()
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
