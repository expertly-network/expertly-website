import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Every file type a member may upload to member-proofs (proof documents, profile photos,
// key-client logos). Mirrors the bucket's allowed_mime_types; the declared type is only a first
// gate — the bytes are sniffed again when an edit referencing the file is submitted/applied.
export const MEMBER_UPLOAD_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export class CreateUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fileName!: string;

  @IsIn(MEMBER_UPLOAD_CONTENT_TYPES)
  contentType!: string;
}
