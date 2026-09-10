import { BadRequestException } from '@nestjs/common';
import { fromBuffer as sniffFileType } from 'file-type';
// file-type pinned to v16, pdf-parse to v1 — both for CommonJS compatibility.
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024;
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Extracts plain text from a PDF, DOCX, or plain-text file.
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
  // No detected type means plain text.
  if (!sniffed) {
    return buffer.toString('utf-8');
  }

  throw new BadRequestException(
    `Unsupported source file type for ${filename} (expected PDF, DOCX, or plain text).`
  );
}
