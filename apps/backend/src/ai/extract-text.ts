import { BadRequestException } from '@nestjs/common';
import { fromBuffer as sniffFileType } from 'file-type';
// Same file-type@16 pin as applications.service.ts — v17+ is pure ESM, incompatible with this
// backend's CommonJS moduleResolution.
//
// pdf-parse pinned to v1 deliberately — v2 replaced the simple callable `pdfParse(buffer) ->
// {text}` function with a class-based, ESM-oriented API (PDFParse class + worker), a much bigger
// integration than this one-off text-extraction call needs.
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024;
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Extracted text is fed into the AI prompt as untrusted grounding material for one generate
// call, then discarded — never persisted, never stored on the article (see the write-flow
// design doc's "source files: transient only" decision).
export async function extractSourceFileText(buffer: Buffer, filename: string): Promise<string> {
  if (buffer.length > MAX_SOURCE_FILE_BYTES) {
    throw new BadRequestException(`${filename} is too large — max 15MB per source file.`);
  }

  const sniffed = await sniffFileType(buffer);

  if (sniffed?.mime === 'application/pdf') {
    const { text } = await pdfParse(buffer);
    return text;
  }
  if (sniffed?.mime === DOCX_MIME) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  // Plain text has no magic bytes to sniff — file-type returning nothing is the expected,
  // documented case for a real .txt file, not a validation failure. Reject anything that DOES
  // sniff as something else (e.g. a renamed .jpg) rather than trusting the filename alone.
  if (!sniffed) {
    return buffer.toString('utf-8');
  }

  throw new BadRequestException(
    `Unsupported source file type for ${filename} (expected PDF, DOCX, or plain text).`
  );
}
