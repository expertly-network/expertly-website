import { Font } from '@react-pdf/renderer';
import { LOGO_SRC } from '@/lib/brand';
import { PDF_FONT_FAMILY, PDF_HEADING_FONT_FAMILY } from './theme';

// Client-only helpers shared by the downloadable PDFs. Only ever imported from the lazily loaded
// download modules, so @react-pdf/renderer stays out of the page bundles.

let fontsRegistered = false;

// Geist TTFs copied from the `geist` package into public/fonts/pdf/ — react-pdf needs TTF/WOFF,
// not the woff2 next/font serves to the page.
export function registerPdfFonts(): void {
  if (fontsRegistered) return;
  const base = `${window.location.origin}/fonts/pdf`;
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: `${base}/Geist-Regular.ttf`, fontWeight: 400 },
      { src: `${base}/Geist-Medium.ttf`, fontWeight: 500 },
      { src: `${base}/Geist-SemiBold.ttf`, fontWeight: 600 },
      { src: `${base}/Geist-Bold.ttf`, fontWeight: 700 },
      // Italics for article <em>; bold-italic falls back to the nearest weight, SemiBold.
      { src: `${base}/Geist-Italic.ttf`, fontWeight: 400, fontStyle: 'italic' },
      { src: `${base}/Geist-SemiBoldItalic.ttf`, fontWeight: 600, fontStyle: 'italic' },
    ],
  });
  Font.register({
    family: PDF_HEADING_FONT_FAMILY,
    src: `${window.location.origin}/fonts/brand/CormorantGaramond-Medium.ttf`,
    fontWeight: 400,
  });
  // react-pdf hyphenates long words by default ("consul-tation"); these documents read better without.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

/** Absolute public URL for a site path, preferring the canonical site origin. */
export function publicSiteUrl(path: string): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
  return `${origin.replace(/\/$/, '')}${path}`;
}

/** `square` crops to a top-anchored square (avatars); `natural` keeps the proportions (the logo). */
export type PdfImageCrop = 'square' | 'natural';

// Re-encodes an image as PNG for react-pdf, which only embeds JPEG/PNG (uploaded images may be
// WebP). Resolves null if the image can't be loaded or the canvas is tainted by a non-CORS host,
// so callers fall back (initials, no cover) instead of failing the whole download.
export function loadImageAsPng(url: string, width = 320, crop: PdfImageCrop = 'square'): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        const side = Math.min(nw, nh);
        const [sw, sh] = crop === 'square' ? [side, side] : [nw, nh];
        const sx = (nw - sw) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = Math.max(1, Math.round((width * sh) / sw));
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, sx, 0, sw, sh, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** The dark-surface logo as a PNG data URL (react-pdf can't render the SVG's masks). */
export async function loadPdfLogo(): Promise<string> {
  const logo = await loadImageAsPng(`${window.location.origin}${LOGO_SRC.dark}`, 1196, 'natural');
  if (!logo) throw new Error('Could not load the logo for the PDF. Please try again.');
  return logo;
}

/** Turns a name/title into a safe file-name stem. */
export function fileStem(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function saveBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
