import { pdf } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import type { MemberDto, MemberRecommendationDto } from '@shared/member';
import { apiFetch } from '@/lib/api/client';
import { fileStem, loadImageAsPng, loadPdfLogo, publicSiteUrl, registerPdfFonts, saveBlob } from '@/lib/pdf/browser';
import { MemberProfilePdf, type PdfRecommendation } from './MemberProfilePdf';

// Client-only: builds the member profile PDF in the browser and saves it. Imported lazily from
// ProfileHeader's PDF button so none of this (or @react-pdf/renderer) is in the page bundle.

export function memberProfileUrl(slug: string): string {
  return publicSiteUrl(`/members/${slug}`);
}

function fileNameFor(member: MemberDto): string {
  return `${member.slug || fileStem(member.name)}-growxq-profile.pdf`;
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
    visible.map((rec) => (rec.author.photoUrl ? loadImageAsPng(rec.author.photoUrl, 96) : Promise.resolve(null)))
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
  registerPdfFonts();
  const profileUrl = memberProfileUrl(member.slug);

  const [qrDataUrl, photoDataUrl, recommendations, logoDataUrl] = await Promise.all([
    QRCode.toDataURL(profileUrl, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 300,
      color: { dark: '#0b0b0c', light: '#ffffff' },
    }),
    member.photoUrl ? loadImageAsPng(member.photoUrl) : Promise.resolve(null),
    loadRecommendations(member.id),
    loadPdfLogo(),
  ]);

  const blob = await pdf(
    <MemberProfilePdf
      member={member}
      profileUrl={profileUrl}
      qrDataUrl={qrDataUrl}
      logoSrc={logoDataUrl}
      photoDataUrl={photoDataUrl}
      generatedAt={new Date()}
      recommendations={recommendations}
    />
  ).toBlob();

  saveBlob(blob, fileNameFor(member));
}
