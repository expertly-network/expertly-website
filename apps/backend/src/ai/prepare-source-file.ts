import { BadRequestException } from '@nestjs/common';
import { fromBuffer as sniffFileType } from 'file-type';

const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024;

const SUPPORTED_DOCUMENT_MEDIA_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
type SupportedDocumentMediaType = (typeof SUPPORTED_DOCUMENT_MEDIA_TYPES)[number];

export type PreparedSourceFile =
  | { kind: 'document'; mediaType: SupportedDocumentMediaType; data: Buffer; filename: string }
  | { kind: 'text'; text: string; filename: string };

// Prepares an uploaded source file for either native-document AI input (PDF/JPEG/PNG/WebP) or
// plain-text prompt embedding (anything with no detected binary type). No text extraction and no
// format conversion happen here anymore — a PDF or image's bytes are passed through untouched so
// the model can read it natively (tables, layout, charts included), which pdf-parse's plain-text
// extraction could never preserve.
export async function prepareSourceFile(buffer: Buffer, filename: string): Promise<PreparedSourceFile> {
  if (buffer.length > MAX_SOURCE_FILE_BYTES) {
    throw new BadRequestException(`${filename} is too large — max 15MB per source file.`);
  }

  const sniffed = await sniffFileType(buffer);

  if (sniffed && (SUPPORTED_DOCUMENT_MEDIA_TYPES as readonly string[]).includes(sniffed.mime)) {
    return {
      kind: 'document',
      mediaType: sniffed.mime as SupportedDocumentMediaType,
      data: buffer,
      filename,
    };
  }
  // No detected binary type means plain text.
  if (!sniffed) {
    return { kind: 'text', text: buffer.toString('utf-8'), filename };
  }

  throw new BadRequestException(
    `Unsupported source file type for ${filename} (expected PDF, JPEG, PNG, WebP, or plain text).`
  );
}
