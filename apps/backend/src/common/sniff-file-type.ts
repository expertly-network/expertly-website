import { fileTypeFromBuffer } from 'file-type';

// Magic-byte MIME sniffing for every upload (CLAUDE.md: never trust the client's declared type).
// file-type is ESM-only from v17; Node 22 loads it through require(esm), so the CommonJS build
// works unchanged. Kept behind this one helper so the dependency is swapped in one place.
export async function sniffFileType(buffer: Uint8Array): Promise<{ ext: string; mime: string } | undefined> {
  return fileTypeFromBuffer(buffer);
}
