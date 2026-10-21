import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

// PATCH /members/:id — the owner's directly-editable fields, applied immediately (no moderation
// queue). Every field is optional; send any combination, at least one. Vetted profile content
// (bio, engagements, clients, …) is NOT here — that goes through POST /members/:id/edits.
export class UpdateMemberDto {
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  // Omitted = keep the current note; null or '' = clear it.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  availabilityNotes?: string | null;

  // `path` from POST /members/:id/uploads — the new profile photo (magic-byte checked in the service).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  photoUploadPath?: string;
}
