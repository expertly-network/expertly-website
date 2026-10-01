import { Font, pdf } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import type { MemberDto } from '@shared/member';
import { MemberProfilePdf, PDF_FONT_FAMILY } from './MemberProfilePdf';

// Client-only: builds the member profile PDF in the browser and saves it. Imported lazily from
// ProfileHeader's PDF button so none of this (or @react-pdf/renderer) is in the page bundle.

let fontsRegistered = false;

// Geist TTFs copied from the `geist` package into public/fonts/pdf/ — react-pdf needs TTF/WOFF,
// not the woff2 next/font serves to the page.
function registerFonts() {
  if (fontsRegistered) return;
  const base = `${window.location.origin}/fonts/pdf`;
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: `${base}/Geist-Regular.ttf`, fontWeight: 400 },
      { src: `${base}/Geist-Medium.ttf`, fontWeight: 500 },
      { src: `${base}/Geist-SemiBold.ttf`, fontWeight: 600 },
      { src: `${base}/Geist-Bold.ttf`, fontWeight: 700 },
    ],
  });
  // react-pdf hyphenates long words by default ("consul-tation"); a profile reads better without.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

export function memberProfileUrl(slug: string): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
  return `${origin.replace(/\/$/, '')}/members/${slug}`;
}

// Crops the photo to a square (top-anchored, like the page's `object-top`) and re-encodes it as
// PNG via a canvas. react-pdf only embeds JPEG/PNG, and uploaded avatars may be WebP. Resolves
// null if the image can't be loaded or the canvas is tainted by a non-CORS host, so the PDF
// falls back to initials instead of failing outright.
function loadPhotoAsPng(url: string, size = 320): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, sx, 0, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function fileNameFor(member: MemberDto): string {
  const base = member.slug || member.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${base}-expertly-profile.pdf`;
}

export async function downloadMemberProfilePdf(member: MemberDto): Promise<void> {
  registerFonts();
  const profileUrl = memberProfileUrl(member.slug);

  const [qrDataUrl, photoDataUrl] = await Promise.all([
    QRCode.toDataURL(profileUrl, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 300,
      color: { dark: '#0b0b0c', light: '#ffffff' },
    }),
    member.photoUrl ? loadPhotoAsPng(member.photoUrl) : Promise.resolve(null),
  ]);

  const blob = await pdf(
    <MemberProfilePdf
      member={member}
      profileUrl={profileUrl}
      qrDataUrl={qrDataUrl}
      photoDataUrl={photoDataUrl}
      generatedAt={new Date()}
    />
  ).toBlob();

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileNameFor(member);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
