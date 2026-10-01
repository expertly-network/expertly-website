import type { ReactNode } from 'react';
import { Document, Image, Link, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import type { MemberDto } from '@shared/member';
import { displayHost, formatMonthYear, formatRate, formatWorkPeriod } from '@/lib/members/format';

// The downloadable member profile — a single-column, read-top-to-bottom document rather than
// the web page's tabbed layout. Rendered by @react-pdf/renderer, which draws to PDF primitives
// and can't read CSS variables or Tailwind classes, so the palette below mirrors the tokens in
// app/globals.css by value. Keep the two in sync if a brand color changes.
const C = {
  ink: '#0b0b0c',
  ink2: '#1e1e20',
  ink3: '#5c5c61',
  ink4: '#9a9aa0',
  line: '#ececee',
  line2: '#dbdbde',
  bgAlt: '#f2fbf7',
  accent: '#00a582',
  band: '#033c2f', // header band, same as the web profile's `.mp-header-band`
  white: '#ffffff',
  seasonedText: '#b45309',
  seasonedBg: '#fef3c7',
};

export const PDF_FONT_FAMILY = 'Geist';

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9.5,
    color: C.ink2,
    paddingTop: 44 + 22, // band height + breathing room, so page 2+ clears the fixed band
    paddingBottom: 56,
    paddingHorizontal: 0,
    lineHeight: 1.45,
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
  brand: { color: C.white, fontSize: 13, fontWeight: 700, letterSpacing: 0.2 },
  brandDot: { color: C.accent },
  bandNote: { color: 'rgba(255,255,255,0.7)', fontSize: 8, letterSpacing: 0.8 },

  body: { paddingHorizontal: 40 },

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
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  name: { fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: -0.3 },
  chip: {
    fontSize: 7.5,
    fontWeight: 600,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verifiedChip: { color: C.accent, backgroundColor: '#e0f4ee', flexDirection: 'row', alignItems: 'center', gap: 3 },
  seasonedChip: { color: C.seasonedText, backgroundColor: C.seasonedBg },
  memberChip: { color: C.ink3, backgroundColor: C.line },
  designation: { fontSize: 11, fontWeight: 500, color: C.ink3, marginTop: 3 },
  stats: { fontSize: 9, color: C.ink3, marginTop: 6 },
  qrBox: { alignItems: 'center', width: 84 },
  qr: { width: 76, height: 76 },
  qrCaption: { fontSize: 7, color: C.ink4, marginTop: 3, textAlign: 'center' },

  // Fee / availability / contact summary
  summary: {
    flexDirection: 'row',
    marginTop: 18,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    backgroundColor: C.bgAlt,
  },
  summaryCol: { flex: 1, padding: 12 },
  summaryDivider: { width: 1, backgroundColor: C.line },
  label: { fontSize: 7, fontWeight: 700, color: C.ink3, letterSpacing: 0.8, marginBottom: 4 },
  fee: { fontSize: 14, fontWeight: 700, color: C.ink },
  availability: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  availabilityText: { fontSize: 8.5 },
  availabilityDot: { width: 5, height: 5, borderRadius: 2.5 },
  notes: { fontSize: 8, color: C.ink3, marginTop: 3 },
  contactRow: { flexDirection: 'row', marginBottom: 2.5 },
  contactKey: { width: 58, fontSize: 8, color: C.ink4 },
  contactVal: { flex: 1, fontSize: 8.5, color: C.ink2 },
  link: { color: C.accent, textDecoration: 'none' },

  // Sections
  section: { marginTop: 18 },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: C.accent,
    letterSpacing: 1,
    paddingBottom: 4,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headline: { fontSize: 10.5, fontWeight: 600, color: C.ink, marginBottom: 4 },
  bio: { fontSize: 9.5, color: C.ink3, lineHeight: 1.6 },

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
    fontSize: 8.5,
    fontWeight: 600,
    color: C.ink,
    borderWidth: 1,
    borderColor: C.line2,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  // Work timeline
  timeline: { borderLeftWidth: 1.5, borderLeftColor: C.line, marginLeft: 3, paddingLeft: 12 },
  role: { marginBottom: 9, position: 'relative' },
  roleDot: {
    position: 'absolute',
    left: -16.5,
    top: 3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.accent,
  },
  roleTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  roleTitle: { fontSize: 10, fontWeight: 600, color: C.ink, flex: 1 },
  roleDates: { fontSize: 8, color: C.ink3 },
  roleCompany: { fontSize: 8.5, color: C.ink3, marginTop: 1 },
  roleDesc: { fontSize: 8.5, color: C.ink3, marginTop: 3, lineHeight: 1.5 },

  twoCol: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: '48.8%',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    padding: 8,
  },
  cellTitle: { fontSize: 9.5, fontWeight: 600, color: C.ink },
  cellMeta: { fontSize: 8, color: C.ink3, marginTop: 2 },

  quote: {
    borderLeftWidth: 2,
    borderLeftColor: C.accent,
    paddingLeft: 10,
    marginBottom: 10,
  },
  quoteText: { fontSize: 9, color: C.ink2, lineHeight: 1.55 },
  quoteBy: { fontSize: 8, color: C.ink3, marginTop: 3 },
  quoteName: { fontWeight: 600, color: C.ink },

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
  /** PNG data URL, already cropped square; null falls back to initials. */
  photoDataUrl: string | null;
  generatedAt: Date;
}

function Check({ size, color = C.accent }: { size: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M3 8l4 4 6-7" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  // minPresenceAhead keeps a heading from being stranded alone at the bottom of a page.
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle} minPresenceAhead={40}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function ContactLine({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <View style={s.contactRow}>
      <Text style={s.contactKey}>{label}</Text>
      {href ? (
        <Link src={href} style={[s.contactVal, s.link]}>
          {value}
        </Link>
      ) : (
        <Text style={s.contactVal}>{value}</Text>
      )}
    </View>
  );
}

export function MemberProfilePdf({ member, profileUrl, qrDataUrl, photoDataUrl, generatedAt }: MemberProfilePdfProps) {
  const location = [member.city, member.country].filter(Boolean).join(', ');
  const firm = member.firmName && member.firmName !== 'Independent' ? member.firmName : null;
  const designation =
    member.headline && firm ? `${member.headline} at ${firm}` : member.headline || firm || '';
  const stats = [location, `${member.yearsOfExperience}+ years experience`, member.services[0]?.name]
    .filter(Boolean)
    .join('   ·   ');
  const isSeasoned = member.memberTier === 'seasoned_professional';
  const generatedOn = generatedAt.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Document
      title={`${member.name} - Expertly profile`}
      author="Expertly"
      creator="Expertly"
      producer="Expertly"
      subject={`Expert profile of ${member.name}`}
    >
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed>
          <Text style={s.brand}>
            Expertly<Text style={s.brandDot}>.</Text>
          </Text>
          <Text style={s.bandNote}>VERIFIED EXPERT PROFILE</Text>
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
              <View style={s.nameRow}>
                <Text style={s.name}>{member.name}</Text>
                {member.isVerified && (
                  <View style={[s.chip, s.verifiedChip]}>
                    <Check size={7} />
                    <Text>Expertly Verified</Text>
                  </View>
                )}
                <Text style={[s.chip, isSeasoned ? s.seasonedChip : s.memberChip]}>
                  {isSeasoned ? 'Seasoned Professional' : 'Member'}
                </Text>
              </View>
              {designation ? <Text style={s.designation}>{designation}</Text> : null}
              <Text style={s.stats}>{stats}</Text>
            </View>
            <View style={s.qrBox}>
              <Link src={profileUrl}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop */}
                <Image src={qrDataUrl} style={s.qr} />
              </Link>
              <Text style={s.qrCaption}>Scan to view full profile</Text>
            </View>
          </View>

          {/* Fee / availability | contact */}
          <View style={s.summary} wrap={false}>
            <View style={s.summaryCol}>
              <Text style={s.label}>CONSULTATION FEE</Text>
              <Text style={s.fee}>{formatRate(member.rateMinCents, member.rateMaxCents, member.rateCurrency)}</Text>
              <View style={s.availability}>
                <View style={[s.availabilityDot, { backgroundColor: member.isAvailable ? '#16a34a' : C.ink4 }]} />
                <Text style={[s.availabilityText, { color: member.isAvailable ? '#16a34a' : C.ink3 }]}>
                  {member.isAvailable ? 'Available for consultations' : 'Currently unavailable'}
                </Text>
              </View>
              {member.availabilityNotes ? <Text style={s.notes}>{member.availabilityNotes}</Text> : null}
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryCol}>
              <Text style={s.label}>CONTACT</Text>
              {member.contactEmail && (
                <ContactLine label="Email" value={member.contactEmail} href={`mailto:${member.contactEmail}`} />
              )}
              {member.contactPhone && (
                <ContactLine
                  label="Phone"
                  value={member.contactPhone}
                  href={`tel:${member.contactPhone.replace(/\s/g, '')}`}
                />
              )}
              {member.linkedinUrl && (
                <ContactLine label="LinkedIn" value={displayHost(member.linkedinUrl)} href={member.linkedinUrl} />
              )}
              {member.website && (
                <ContactLine label="Website" value={displayHost(member.website)} href={member.website} />
              )}
              {member.firmWebsite && (
                <ContactLine
                  label={firm ? 'Company' : 'Company site'}
                  value={firm ? `${firm} · ${displayHost(member.firmWebsite)}` : displayHost(member.firmWebsite)}
                  href={member.firmWebsite}
                />
              )}
              <ContactLine label="Profile" value={displayHost(profileUrl)} href={profileUrl} />
            </View>
          </View>

          {(member.headline || member.bio) && (
            <Section title="About">
              {member.headline ? <Text style={s.headline}>{member.headline}</Text> : null}
              {member.bio ? <Text style={s.bio}>{member.bio}</Text> : null}
            </Section>
          )}

          {member.engagements.length > 0 && (
            <Section title="Key Engagements">
              {member.engagements.map((eng) => (
                <View key={eng.id} style={s.engagement} wrap={false}>
                  <View style={s.tick}>
                    <Check size={8} />
                  </View>
                  <Text style={s.engagementText}>
                    {[eng.title, eng.organization, eng.year].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              ))}
            </Section>
          )}

          {member.keyClients.length > 0 && (
            <Section title="Key Clients">
              <View style={s.clients}>
                {member.keyClients.map((client) => (
                  <Text key={client.id} style={s.client}>
                    {client.name}
                  </Text>
                ))}
              </View>
            </Section>
          )}

          {member.workExperiences.length > 0 && (
            <Section title="Work Experience">
              <View style={s.timeline}>
                {member.workExperiences.map((work) => {
                  const { range, duration } = formatWorkPeriod(work.startYear, work.endYear, work.isCurrent);
                  return (
                    <View key={work.id} style={s.role} wrap={false}>
                      <View style={s.roleDot} />
                      <View style={s.roleTop}>
                        <Text style={s.roleTitle}>{work.title}</Text>
                        <Text style={s.roleDates}>
                          {range}
                          {duration ? ` · ${duration}` : ''}
                        </Text>
                      </View>
                      <Text style={s.roleCompany}>{work.company}</Text>
                      {work.description ? <Text style={s.roleDesc}>{work.description}</Text> : null}
                    </View>
                  );
                })}
              </View>
            </Section>
          )}

          {member.educations.length > 0 && (
            <Section title="Education">
              <View style={s.twoCol}>
                {member.educations.map((edu) => (
                  <View key={edu.id} style={s.cell} wrap={false}>
                    <Text style={s.cellTitle}>{edu.degree}</Text>
                    <Text style={s.cellMeta}>
                      {edu.institution}
                      {edu.endYear ? ` · ${edu.endYear}` : ''}
                    </Text>
                    {edu.field ? <Text style={s.cellMeta}>{edu.field}</Text> : null}
                  </View>
                ))}
              </View>
            </Section>
          )}

          {member.awards.length > 0 && (
            <Section title="Awards & Recognition">
              <View style={s.twoCol}>
                {member.awards.map((award) => (
                  <View key={award.id} style={s.cell} wrap={false}>
                    <Text style={s.cellTitle}>{award.title}</Text>
                    {(award.issuingBody || award.year) && (
                      <Text style={s.cellMeta}>{[award.issuingBody, award.year].filter(Boolean).join(' · ')}</Text>
                    )}
                    {award.description ? <Text style={s.cellMeta}>{award.description}</Text> : null}
                  </View>
                ))}
              </View>
            </Section>
          )}

          {member.testimonials.length > 0 && (
            <Section title="Client Testimonials">
              {member.testimonials.map((t) => {
                const by = [t.clientTitle, t.clientCompany].filter(Boolean).join(', ');
                const date = formatMonthYear(t.occurredOn);
                return (
                  <View key={t.id} style={s.quote} wrap={false}>
                    <Text style={s.quoteText}>“{t.quote}”</Text>
                    <Text style={s.quoteBy}>
                      <Text style={s.quoteName}>{t.clientName}</Text>
                      {by ? ` — ${by}` : ''}
                      {date ? `  ·  ${date}` : ''}
                      {t.isVerified ? '  ·  Verified' : ''}
                    </Text>
                  </View>
                );
              })}
            </Section>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text>
            <Text style={s.footerBrand}>Generated by Expertly</Text> on {generatedOn} ·{' '}
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
