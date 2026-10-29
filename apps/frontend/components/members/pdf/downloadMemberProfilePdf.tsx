import { Font, pdf } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import type { MemberDto, MemberRecommendationDto } from '@shared/member';
import { apiFetch } from '@/lib/api/client';
import { MemberProfilePdf, PDF_FONT_FAMILY, PDF_HEADING_FONT_FAMILY, type PdfRecommendation } from './MemberProfilePdf';

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
  Font.register({
    family: PDF_HEADING_FONT_FAMILY,
    src: `${window.location.origin}/fonts/brand/CormorantGaramond-Medium.ttf`,
    fontWeight: 400,
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
  return `${base}-growxq-profile.pdf`;
}

// The profile page's visible recommendations (same endpoint MemberRecommendations uses), with each
// author photo pre-loaded. Hidden ones are dropped — the API returns them to the profile owner, but
// the PDF is meant to be shared. A failed fetch yields none rather than blocking the download.
async function loadRecommendations(memberId: string): Promise<PdfRecommendation[]> {
  let items: MemberRecommendationDto[];
  try {
    items = await apiFetch<MemberRecommendationDto[]>(`/members/${memberId}/recommendations`);
  } catch {
    return [];
  }
  const visible = items.filter((rec) => !rec.isHidden);
  const photos = await Promise.all(
    visible.map((rec) => (rec.author.photoUrl ? loadPhotoAsPng(rec.author.photoUrl, 96) : Promise.resolve(null)))
  );
  return visible.map((rec, i) => ({
    id: rec.id,
    authorName: rec.author.name,
    authorInitials: rec.author.initials,
    authorPhotoDataUrl: photos[i],
    body: rec.body,
    createdAt: rec.createdAt,
  }));
}

export async function downloadMemberProfilePdf(member: MemberDto): Promise<void> {
  registerFonts();
  const profileUrl = memberProfileUrl(member.slug);

  const [qrDataUrl, photoDataUrl, recommendations] = await Promise.all([
    QRCode.toDataURL(profileUrl, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 300,
      color: { dark: '#0b0b0c', light: '#ffffff' },
    }),
    member.photoUrl ? loadPhotoAsPng(member.photoUrl) : Promise.resolve(null),
    loadRecommendations(member.id),
  ]);

  const blob = await pdf(
    <MemberProfilePdf
      member={member}
      profileUrl={profileUrl}
      qrDataUrl={qrDataUrl}
      photoDataUrl={photoDataUrl}
      generatedAt={new Date()}
      recommendations={recommendations}
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
