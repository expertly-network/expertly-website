import { LOGO_ASPECT_RATIO } from '@/lib/brand';
import { CONFIDENTIAL_CLIENT_LABEL } from '@/lib/members/confidential';
import { isFullyVerified } from '@/lib/members/fully-verified';
import { Children, type ReactNode } from 'react';
import { Document, Image, Link, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import type { MemberDto } from '@shared/member';
import { MEMBER_TIER_LABEL, displayHost, externalHref, formatMonthYear } from '@/lib/members/format';

// The PDF is a shareable document, so a confidential client is masked even when the owner (who
// receives the real name from the API) downloads it.
import { groupByCompany, groupPeriod, rolePeriod } from '@/lib/members/work-history';
import { toTextBlocks } from '@/lib/text/text-blocks';
import { formatDate } from '@/lib/dates';
import { PDF_COLORS, PDF_FONT_FAMILY } from '@/lib/pdf/theme';

// The downloadable member profile — a single-column, read-top-to-bottom document rather than
// the web page's tabbed layout. Palette and fonts are shared with the article PDF (lib/pdf/theme.ts).
const C = PDF_COLORS;

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    color: C.ink2,
    paddingTop: 44 + 22, // band height + breathing room, so page 2+ clears the fixed band
    paddingBottom: 56,
    paddingHorizontal: 0,
  },

  // Brand strip
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    backgroundColor: C.band,
    paddingHorizontal: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Raster derivative of the same SVG used by the website (react-pdf cannot render SVG masks).
  brand: { width: 100, height: 100 / LOGO_ASPECT_RATIO },
  bandNote: { color: 'rgba(255,255,255,0.7)', fontSize: 8.5 },

  // lineHeight lives here, not on the page: inherited into the fixed footer, it makes react-pdf
  // (4.9) silently drop the whole footer, page numbers included. fontSize repeats the page's
  // because react-pdf resolves an inherited lineHeight against the declaring element's size.
  body: { paddingHorizontal: 40, fontSize: 10, lineHeight: 1.45 },

  // Identity block
  identity: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  photo: { width: 76, height: 76, borderRadius: 12 },
  initials: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: C.band,
    color: C.white,
    fontSize: 26,
    fontWeight: 700,
    textAlign: 'center',
    paddingTop: 22,
  },
  identityText: { flex: 1 },
  // Explicit lineHeight: the body's 1.45 isn't applied to this line box, so the badge row below
  // started inside the name's descenders.
  name: {
    fontSize: 20,
    fontWeight: 600,
    color: C.ink,
    letterSpacing: -0.3,
    lineHeight: 1.25,
  },
  // Badges sit on their own row under the name: next to a 20pt name they wrapped unpredictably
  // and floated off its baseline. Each is a fixed-height View with the label centred inside —
  // react-pdf paints a styled <Text>'s background around its line box, which put the label
  // off-centre in an oversized pill.
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  chip: {
    height: 14,
    paddingHorizontal: 7,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  chipText: { fontSize: 7, fontWeight: 600, letterSpacing: 0.2, lineHeight: 1 },
  verifiedChip: { backgroundColor: C.accentTint },
  verifiedText: { color: C.accent },
  seasonedChip: { backgroundColor: C.seasonedBg },
  seasonedText: { color: C.seasonedText },
  memberChip: { backgroundColor: C.line },
  memberText: { color: C.ink3 },
  designation: { fontSize: 11, fontWeight: 500, color: C.ink3, marginTop: 7 },
  qrBox: { alignItems: 'center', width: 92 },
  qr: { width: 84, height: 84 },
  qrCaption: { fontSize: 7, color: C.ink4, marginTop: 3, textAlign: 'center' },

  // "At a glance" panel — the only summary box (no availability, fees or membership: the PDF is a
  // standalone, shareable profile, not tied to GrowXQ). Two columns of label-over-value cells.
  contactPanel: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: C.line,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    borderRadius: 10,
    backgroundColor: C.bgAlt,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  label: { fontSize: 10, fontWeight: 700, color: C.ink, marginBottom: 10 },
  notes: { fontSize: 9, color: C.ink3 },
  contactGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  contactCell: { width: '50%' },
  panelLinkedIn: { position: 'absolute', top: 10, right: 12 },
  contactKey: { fontSize: 7.5, fontWeight: 600, color: C.ink4, letterSpacing: 0.3, marginBottom: 2 },
  contactVal: { fontSize: 9.5, color: C.ink, lineHeight: 1.35 },
  contactValRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: { color: C.accent, textDecoration: 'none' },
  // Expertise inside the card: one wrapping line of "Category: service, service" groups.
  expertiseText: { fontSize: 9.5, color: C.ink, lineHeight: 1.4 },
  expertiseCategory: { fontWeight: 600 },

  // Sections
  section: { marginTop: 22 },
  about: { marginTop: 14 },
  // Normal case, normal spacing — same as the profile page's section headings (the letter-spaced
  // caps label style was removed site-wide in Oct 2026).
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: C.accent,
    paddingBottom: 4,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  bio: { fontSize: 10, color: C.ink2, lineHeight: 1.65 },
  textBlocks: { gap: 6 },
  bulletList: { gap: 2 },
  bulletRow: { flexDirection: 'row' },
  bulletMark: { width: 9 },
  bulletText: { flex: 1 },

  engagement: {
    flexDirection: 'row',
    backgroundColor: C.line,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  tick: { width: 12, paddingTop: 2 },
  engagementText: { flex: 1, fontSize: 9, fontWeight: 500, color: C.ink },

  clients: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  client: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: C.line2,
    borderRadius: 6,
    paddingLeft: 4,
    paddingRight: 7,
    paddingVertical: 3,
  },
  clientName: { fontSize: 8.5, fontWeight: 600, color: C.ink },
  clientLogo: { width: 16, height: 16, borderRadius: 3, objectFit: 'contain' },
  clientInitial: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientInitialText: { fontSize: 8, fontWeight: 700, color: '#ffffff' },

  // Work history: one entry per company. Only a company with several roles gets a vertical rail
  // (built from one bordered segment per role, so consecutive blocks join into a single line).
  role: { marginBottom: 12 },
  // The rail's line is its own absolutely-positioned child, not a border: react-pdf offsets
  // absolute children from the padding box, so a border-drawn line would sit off from the dots.
  rail: { marginLeft: 3, paddingLeft: 12, paddingBottom: 9 },
  railLine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 1.5, backgroundColor: C.line },
  // Centred on the line (line centre at 0.75; dot is 7 wide).
  railDot: {
    position: 'absolute',
    left: -2.75,
    top: 3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.accent,
  },
  roleTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  roleDates: { fontSize: 8.5, color: C.ink3 },
  roleCompany: { fontSize: 8.5, color: C.ink3, marginTop: 1 },
  roleDesc: { fontSize: 9, color: C.ink2, lineHeight: 1.6 },
  roleDescWrap: { marginTop: 4 },
  // Company (ink) and its roles (brand green) in two colours so the two read apart at a glance.
  groupCompany: { fontSize: 12, fontWeight: 700, color: C.ink, flex: 1 },
  groupRoles: { marginTop: 6, gap: 9 },
  subRoleTitle: { fontSize: 10, fontWeight: 600, color: C.accent, flex: 1 },

  award: { flexDirection: 'row' },
  awardYear: { width: 38, fontSize: 11, fontWeight: 700, color: C.accent },
  awardBody: { flex: 1, borderLeftWidth: 1.5, borderLeftColor: C.accentSoft, paddingLeft: 9 },
  awardIssuer: { fontSize: 8.5, fontWeight: 600, color: C.ink2, marginTop: 2 },
  cellTitle: { fontSize: 10, fontWeight: 600, color: C.ink },
  cellMeta: { fontSize: 8.5, color: C.ink3, marginTop: 2 },

  quote: {
    borderLeftWidth: 2,
    borderLeftColor: C.accent,
    paddingLeft: 10,
    marginBottom: 10,
  },
  quoteText: { fontSize: 9.5, color: C.ink2, lineHeight: 1.6 },
  quoteBy: { fontSize: 8, color: C.ink3, marginTop: 3 },
  quoteName: { fontWeight: 600, color: C.ink },

  // Member recommendations
  rec: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, marginBottom: 8 },
  recHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  recAvatar: { width: 22, height: 22, borderRadius: 11 },
  recInitials: { backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center' },
  recInitialsText: { fontSize: 7.5, fontWeight: 700, color: C.accent },
  recName: { fontSize: 9.5, fontWeight: 600, color: C.ink },
  recDate: { fontSize: 7.5, color: C.ink4, marginTop: 1 },
  recBody: { fontSize: 9.5, color: C.ink2, lineHeight: 1.6 },

  // Footer (repeated on every page)
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 7.5,
    color: C.ink4,
  },
  footerBrand: { color: C.ink3, fontWeight: 600 },
});

export interface MemberProfilePdfProps {
  member: MemberDto;
  profileUrl: string;
  qrDataUrl: string;
  logoSrc: string;
  /** PNG data URL, already cropped square; null falls back to initials. */
  photoDataUrl: string | null;
  generatedAt: Date;
  /** Visible member-to-member recommendations (hidden ones are never passed in). */
  recommendations: PdfRecommendation[];
  /** Key-client logos by client id, already re-encoded as PNG data URLs; a missing one falls back to the initial. */
  clientLogos?: Record<string, string | null>;
}

// A recommendation as the PDF needs it: the author's photo is pre-loaded to a data URL, like the
// member's own photo, since react-pdf can't use cross-origin image URLs directly.
export interface PdfRecommendation {
  id: string;
  authorName: string;
  authorInitials: string;
  authorPhotoDataUrl: string | null;
  body: string;
  createdAt: string;
}

// "2019 – Present · 6 yrs" — same pieces as the profile page's <Period>.
function PdfPeriod({ range, duration }: { range: string; duration: string | null }) {
  return (
    <Text style={s.roleDates}>
      {range}
      {duration ? ` · ${duration}` : ''}
    </Text>
  );
}

// react-pdf counterpart of components/shared/FormattedText.tsx — same toTextBlocks() parsing, so
// the PDF splits paragraphs and bullet lists exactly as the profile page does.
// The text styles PdfTextBlocks is used with (bio, role descriptions).
type PdfTextStyle = typeof s.bio | typeof s.roleDesc;

function PdfTextBlocks({ text, style }: { text: string; style: PdfTextStyle }) {
  return (
    <View style={s.textBlocks}>
      {toTextBlocks(text).map((block, i) =>
        block.kind === 'p' ? (
          <Text key={i} style={style}>
            {block.text}
          </Text>
        ) : (
          <View key={i} style={s.bulletList}>
            {block.items.map((item, j) => (
              <View key={j} style={s.bulletRow}>
                <Text style={[style, s.bulletMark]}>•</Text>
                <Text style={[style, s.bulletText]}>{item}</Text>
              </View>
            ))}
          </View>
        )
      )}
    </View>
  );
}

function Check({ size, color = C.accent }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path
        d="M3 8l4 4 6-7"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

type GlanceCell = (width: string) => ReactNode;

// Column widths of the At a glance grid (left holds the wider Expertise / Firm text).
const LEFT_COL = '58%';
const RIGHT_COL = '42%';

// Mirrors components/members/HighlightedEntry.tsx (Education / Awards): the year in accent on the
// left, then a soft accent rule with the title, a supporting line and an optional description.
function HighlightedEntry({
  first,
  year,
  title,
  subtitle,
  description,
}: {
  first: boolean;
  year: number | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
}) {
  return (
    <View style={[s.award, first ? {} : { marginTop: 10 }]} wrap={false}>
      <Text style={s.awardYear}>{year ?? ''}</Text>
      <View style={s.awardBody}>
        <Text style={s.cellTitle}>{title}</Text>
        {subtitle ? <Text style={s.awardIssuer}>{subtitle}</Text> : null}
        {description ? <Text style={s.cellMeta}>{description}</Text> : null}
      </View>
    </View>
  );
}

// `lead` is laid out unbreakably with the heading, for sections whose content is one tall
// wrappable View (react-pdf's minPresenceAhead can't see into it, so the heading got stranded).
function Section({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  // The heading always travels with the first block of the section (`lead`, or else the first
  // child), kept in one unbreakable View — react-pdf's minPresenceAhead can't see into nested
  // wrappable Views, which is how a heading used to get stranded at the foot of a page.
  const rest = Children.toArray(children);
  const first = lead ?? rest.shift();
  return (
    <View style={s.section}>
      <View wrap={false}>
        <Text style={s.sectionTitle}>{title}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
}

function ContactLine({
  label,
  value,
  href,
  icon,
  width,
}: {
  label: string;
  value: string;
  href?: string;
  /** Small mark drawn before the value (e.g. the LinkedIn "in"). */
  icon?: ReactNode;
  /** Column width inside the grid (default: half). */
  width?: string;
}) {
  const text = href ? (
    <Link src={href} style={[s.contactVal, s.link]}>
      {value}
    </Link>
  ) : (
    <Text style={s.contactVal}>{value}</Text>
  );
  return (
    <View style={width ? [s.contactCell, { width }] : s.contactCell}>
      <Text style={s.contactKey}>{label.toUpperCase()}</Text>
      {icon ? (
        <View style={s.contactValRow}>
          {icon}
          {text}
        </View>
      ) : (
        text
      )}
    </View>
  );
}

// LinkedIn's "in" glyph, in the accent colour, for the Connect panel.
function LinkedInMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={C.accent}
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zM7.119 20.452H3.555V9h3.564v11.452z"
      />
    </Svg>
  );
}

export function MemberProfilePdf({
  member,
  profileUrl,
  qrDataUrl,
  logoSrc,
  photoDataUrl,
  generatedAt,
  recommendations,
  clientLogos,
}: MemberProfilePdfProps) {
  const location = [member.city, member.country].filter(Boolean).join(', ');
  const firm = member.firmName && member.firmName !== 'Independent' ? member.firmName : null;
  // Services grouped under their category, in the member's own order.
  const serviceGroups: { category: string; names: string[] }[] = [];
  for (const service of member.services) {
    const group = serviceGroups.find((g) => g.category === service.categoryName);
    if (group) group.names.push(service.name);
    else serviceGroups.push({ category: service.categoryName, names: [service.name] });
  }
  const website = member.website;
  // Each cell takes its column width so the two rows line up.
  const glanceCells = (
    [
      serviceGroups.length > 0 &&
        ((width: string) => (
          <View key="expertise" style={[s.contactCell, { width }]}>
            <Text style={s.contactKey}>EXPERTISE</Text>
            {serviceGroups.map((group) => (
              <Text key={group.category} style={s.expertiseText}>
                <Text style={s.expertiseCategory}>{group.category}</Text>
                {`: ${group.names.join(', ')}`}
              </Text>
            ))}
          </View>
        )),
      (width: string) => (
        <ContactLine key="experience" label="Experience" value={`${member.yearsOfExperience}+ years`} width={width} />
      ),
      firm && ((width: string) => <ContactLine key="firm" label="Firm" value={firm} width={width} />),
      website &&
        ((width: string) => (
          <ContactLine
            key="website"
            label="Website"
            value={displayHost(website)}
            href={externalHref(website) ?? undefined}
            width={width}
          />
        )),
      location && ((width: string) => <ContactLine key="location" label="Based in" value={location} width={width} />),
    ] as (GlanceCell | false | '')[]
  ).filter((cell): cell is GlanceCell => typeof cell === 'function');
  // The headline exactly as the member wrote it — the firm is a separate fact (the Firm cell).
  const designation = member.headline || firm || '';
  const isSeasoned = member.memberTier === 'seasoned_professional';
  const generatedOn = formatDate(generatedAt);
  const workBlocks = groupByCompany(member.workExperiences).flatMap((group, groupIndex) => {
    const multiple = group.roles.length > 1;
    const [first, ...rest] = group.roles;
    const roleBlock = (role: (typeof group.roles)[number]) => (
      <View>
        <View style={s.roleTop}>
          <Text style={s.subRoleTitle}>{role.title}</Text>
          {multiple && <PdfPeriod {...rolePeriod(role)} />}
        </View>
        {role.description ? (
          <View style={s.roleDescWrap}>
            <PdfTextBlocks text={role.description} style={s.roleDesc} />
          </View>
        ) : null}
      </View>
    );
    // Every block is a direct, unbreakable child of the section: the company header
    // travels with its first role (never stranded at a page foot), and each further
    // role follows on its own. A splittable wrapper View made react-pdf overlap text.
    const railSegment = (role: (typeof group.roles)[number], last: boolean) => (
      <View style={[s.rail, last ? { paddingBottom: 0 } : {}]}>
        <View style={s.railLine} />
        <View style={s.railDot} />
        {roleBlock(role)}
      </View>
    );
    return [
      <View
        key={first.id}
        style={[
          s.role,
          rest.length ? { marginBottom: 0 } : {},
          // A thin line separates one company from the next (none above the first).
          groupIndex > 0 ? { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 } : {},
        ]}
        wrap={false}
      >
        <View style={s.roleTop}>
          <Text style={s.groupCompany}>{group.company}</Text>
          <PdfPeriod {...groupPeriod(group.roles)} />
        </View>
        {multiple && <Text style={s.roleCompany}>{group.roles.length} roles</Text>}
        <View style={s.groupRoles}>{railSegment(first, rest.length === 0)}</View>
      </View>,
      ...rest.map((role, k) => {
        const last = k === rest.length - 1;
        return (
          <View key={role.id} style={last ? { marginBottom: 12 } : {}} wrap={false}>
            <View style={[s.rail, last ? { paddingBottom: 0 } : {}]}>
              <View style={s.railLine} />
              <View style={s.railDot} />
              {roleBlock(role)}
            </View>
          </View>
        );
      }),
    ];
  });

  return (
    <Document
      title={`${member.name} - GrowXQ profile`}
      author="GrowXQ"
      creator="GrowXQ"
      producer="GrowXQ"
      subject={`Expert profile of ${member.name}`}
    >
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
          <Image src={logoSrc} style={s.brand} />
          <Text style={s.bandNote}>Verified expert profile</Text>
        </View>

        <View style={s.body}>
          {/* Identity + QR */}
          <View style={s.identity}>
            {photoDataUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop
              <Image src={photoDataUrl} style={s.photo} />
            ) : (
              <Text style={s.initials}>{member.initials}</Text>
            )}
            <View style={s.identityText}>
              <Text style={s.name}>{member.name}</Text>
              <View style={s.badgeRow}>
                {isFullyVerified(member) && (
                  <View style={[s.chip, s.verifiedChip]}>
                    <Check size={6.5} />
                    <Text style={[s.chipText, s.verifiedText]}>GrowXQ Verified</Text>
                  </View>
                )}
                <View style={[s.chip, isSeasoned ? s.seasonedChip : s.memberChip]}>
                  <Text style={[s.chipText, isSeasoned ? s.seasonedText : s.memberText]}>
                    {MEMBER_TIER_LABEL[member.memberTier] ?? 'Member'}
                  </Text>
                </View>
              </View>
              {designation ? <Text style={s.designation}>{designation}</Text> : null}
            </View>
            <View style={s.qrBox}>
              <Link src={profileUrl}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop */}
                <Image src={qrDataUrl} style={s.qr} />
              </Link>
              <Text style={s.qrCaption}>Scan to view full profile</Text>
            </View>
          </View>

          {/* At a glance: expertise (services grouped by category), location, experience, firm and
              LinkedIn. No availability, fees, membership or direct contact details — the PDF is a
              standalone profile that can be shared anywhere, and the QR code points back to the
              GrowXQ page. */}
          <View style={s.contactPanel} wrap={false}>
            {/* Two columns: Expertise | Experience, then Firm | Based in. A fact the member hasn't
                filled in is skipped and the rest flow up, so there is never an empty slot. */}
            <View style={s.contactGrid}>{glanceCells.map((cell, i) => cell(i % 2 === 0 ? LEFT_COL : RIGHT_COL))}</View>
            {member.linkedinUrl && (
              <Link src={externalHref(member.linkedinUrl) ?? member.linkedinUrl} style={s.panelLinkedIn}>
                <LinkedInMark size={13} />
              </Link>
            )}
          </View>

          {member.bio && (
            // No "About" heading or rule: the bio reads straight on from the identity header, whose
            // designation line already carries the headline.
            <View style={s.about}>
              <PdfTextBlocks text={member.bio} style={s.bio} />
            </View>
          )}

          {member.engagements.length > 0 && (
            <Section title="Key Engagements">
              {member.engagements.map((eng) => (
                <View key={eng.id} style={s.engagement} wrap={false}>
                  <View style={s.tick}>
                    <Check size={8} />
                  </View>
                  <Text style={s.engagementText}>
                    {[eng.title, eng.isConfidential ? CONFIDENTIAL_CLIENT_LABEL : eng.clientName, eng.year]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              ))}
            </Section>
          )}

          {member.keyClients.length > 0 && (
            // `lead`: heading and the whole chip row stay together on one page — otherwise the row
            // could split mid-chip across a page break, leaving empty box tops at a page foot.
            <Section
              title="Key Clients"
              lead={
                <View style={s.clients}>
                  {member.keyClients.map((client) => {
                    const logo = clientLogos?.[client.id];
                    return (
                      <View key={client.id} style={s.client} wrap={false}>
                        {logo ? (
                          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop
                          <Image src={logo} style={s.clientLogo} />
                        ) : (
                          <View style={s.clientInitial}>
                            <Text style={s.clientInitialText}>{client.name.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                        <Text style={s.clientName}>{client.name}</Text>
                      </View>
                    );
                  })}
                </View>
              }
            />
          )}

          {workBlocks.length > 0 && (
            // Mirrors components/members/WorkHistoryTimeline.tsx: every company is one entry
            // (company, overall period, "N roles" when more than one) with its roles nested; every role gets the vertical rail and a dot. The first block travels with the heading.
            <Section title="Work Experience" lead={<View>{workBlocks[0]}</View>}>
              {workBlocks.length > 1 && <View>{workBlocks.slice(1)}</View>}
            </Section>
          )}

          {member.testimonials.length > 0 && (
            <Section title="Client Testimonials">
              {member.testimonials.map((t) => {
                const by = [t.clientTitle, t.clientCompany].filter(Boolean).join(', ');
                return (
                  <View key={t.id} style={s.quote} wrap={false}>
                    <Text style={s.quoteText}>“{t.quote}”</Text>
                    <Text style={s.quoteBy}>
                      <Text style={s.quoteName}>{t.clientName}</Text>
                      {by ? ` — ${by}` : ''}
                    </Text>
                  </View>
                );
              })}
            </Section>
          )}

          {member.educations.length > 0 && (
            <Section title="Education">
              {member.educations.map((edu, i) => (
                <HighlightedEntry
                  key={edu.id}
                  first={i === 0}
                  year={edu.endYear}
                  title={edu.field ? `${edu.degree}, ${edu.field}` : edu.degree}
                  subtitle={edu.institution}
                />
              ))}
            </Section>
          )}

          {member.awards.length > 0 && (
            <Section title="Awards & Recognition">
              {member.awards.map((award, i) => (
                <HighlightedEntry
                  key={award.id}
                  first={i === 0}
                  year={award.year}
                  title={award.title}
                  subtitle={award.issuingBody}
                  description={award.description}
                />
              ))}
            </Section>
          )}

          {/* Same section, order and content as the profile page's MemberRecommendations. */}
          {recommendations.length > 0 && (
            <Section title="Member Recommendations">
              {recommendations.map((rec) => (
                <View key={rec.id} style={s.rec} wrap={false}>
                  <View style={s.recHead}>
                    {rec.authorPhotoDataUrl ? (
                      // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop
                      <Image src={rec.authorPhotoDataUrl} style={s.recAvatar} />
                    ) : (
                      <View style={[s.recAvatar, s.recInitials]}>
                        <Text style={s.recInitialsText}>{rec.authorInitials}</Text>
                      </View>
                    )}
                    <View>
                      <Text style={s.recName}>{rec.authorName}</Text>
                      <Text style={s.recDate}>{formatMonthYear(rec.createdAt)}</Text>
                    </View>
                  </View>
                  <Text style={s.recBody}>{rec.body}</Text>
                </View>
              ))}
            </Section>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text>
            <Text style={s.footerBrand}>Generated by GrowXQ</Text> on {generatedOn} ·{' '}
            <Link src={profileUrl} style={s.link}>
              {displayHost(profileUrl)}
            </Link>
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
