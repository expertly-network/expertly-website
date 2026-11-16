import { pdf } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import type { MemberDto, MemberRecommendationDto } from '@shared/member';
import { apiFetch } from '@/lib/api/client';
import {
  fileStem,
  loadImageAsPng,
  loadPdfLogo,
  publicSiteUrl,
  registerPdfFonts,
  saveBlob,
  stampLogoOnQr,
} from '@/lib/pdf/browser';
import { stripEmojiDeep } from '@/lib/pdf/strip-emoji';
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

// Each key client's logo as a PNG data URL, kept whole (not cropped). One that can't be loaded
// (a host without CORS headers, a dead link) is null, and the PDF draws the client's initial instead.
async function loadClientLogos(member: MemberDto): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    member.keyClients.map(
      async (client) =>
        [client.id, client.logoUrl ? await loadImageAsPng(client.logoUrl, 96, 'natural') : null] as const
    )
  );
  return Object.fromEntries(entries);
}

export async function downloadMemberProfilePdf(member: MemberDto): Promise<void> {
  registerPdfFonts();
  const profileUrl = memberProfileUrl(member.slug);

  const [qrDataUrl, photoDataUrl, recommendations, logoDataUrl, clientLogos] = await Promise.all([
    // `H` error correction: the brand mark stamped on the middle covers ~6% of the code's area.
    QRCode.toDataURL(profileUrl, {
      errorCorrectionLevel: 'H',
      margin: 0,
      width: 360,
      color: { dark: '#0b0b0c', light: '#ffffff' },
    }).then((url) => stampLogoOnQr(url)),
    member.photoUrl ? loadImageAsPng(member.photoUrl) : Promise.resolve(null),
    loadRecommendations(member.id),
    loadPdfLogo(),
    loadClientLogos(member),
  ]);

  const blob = await pdf(
    <MemberProfilePdf
      member={stripEmojiDeep(member)}
      profileUrl={profileUrl}
      qrDataUrl={qrDataUrl}
      logoSrc={logoDataUrl}
      photoDataUrl={photoDataUrl}
      generatedAt={new Date()}
      recommendations={stripEmojiDeep(recommendations)}
      clientLogos={clientLogos}
    />
  ).toBlob();

  saveBlob(blob, fileNameFor(member));
}
