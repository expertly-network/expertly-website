import { Fragment } from 'react';
import { Document, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ArticleDto } from '@shared/article';
import { LOGO_ASPECT_RATIO } from '@/lib/brand';
import { formatDate } from '@/lib/dates';
import { ARTICLE_LEGAL_DISCLAIMER, aiSummaryPoints, formatAuthorDesignation } from '@/lib/articles/format';
import type { ArticleBlock, InlineRun, ListBlock } from '@/lib/articles/html-blocks';
import { displayHost } from '@/lib/members/format';
import { PDF_COLORS as C, PDF_FONT_FAMILY, PDF_HEADING_FONT_FAMILY } from '@/lib/pdf/theme';

// The downloadable article — same brand band, footer, palette and fonts as the member profile PDF
// (components/members/pdf/MemberProfilePdf.tsx), laid out like the article page: service and
// title, byline, AI summary, body, disclaimer (no cover image — it only cost a third of page one). The body arrives pre-parsed
// (lib/articles/html-blocks.ts) so the PDF follows the page's paragraphs, headings, lists and quotes.

const BAND_HEIGHT = 44;

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10.5,
    color: C.ink2,
    paddingTop: BAND_HEIGHT + 20, // band height + breathing room, so page 2+ clears the fixed band
    paddingBottom: 46,
  },
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BAND_HEIGHT,
    backgroundColor: C.band,
    paddingHorizontal: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: { width: 100, height: 100 / LOGO_ASPECT_RATIO },
  bandNote: { color: 'rgba(255,255,255,0.7)', fontSize: 8.5 },
  // lineHeight lives here, not on the page: inherited into the fixed footer, it makes react-pdf
  // (4.9) silently drop the whole footer, page numbers included. fontSize repeats the page's
  // because react-pdf resolves an inherited lineHeight against the declaring element's size.
  body: { paddingHorizontal: 44, fontSize: 10.5, lineHeight: 1.45 },

  // Header
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  chip: {
    height: 15,
    paddingHorizontal: 8,
    borderRadius: 7.5,
    backgroundColor: C.accentTint,
    justifyContent: 'center',
  },
  chipText: { fontSize: 7.5, fontWeight: 600, color: C.accent, lineHeight: 1 },
  title: { fontSize: 24, fontWeight: 500, color: C.ink, letterSpacing: -0.6, lineHeight: 1.15 },
  byline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarInitials: { backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center' },
  avatarInitialsText: { fontSize: 11, fontWeight: 600, color: C.ink4 },
  bylineText: { flex: 1 },
  // Own lineHeights: the body's inherited one is fixed at ~15pt, which spread these small lines apart.
  authorName: { fontSize: 10.5, fontWeight: 600, color: C.ink, lineHeight: 1.25 },
  designation: { fontSize: 8.5, color: C.ink3, lineHeight: 1.3, marginTop: 1 },
  meta: { fontSize: 8.5, color: C.ink3, lineHeight: 1.3, marginTop: 2 },
  qrBox: { alignItems: 'center', width: 60 },
  qr: { width: 40, height: 40 },
  qrCaption: { fontSize: 6, color: C.ink4, lineHeight: 1.2, marginTop: 2, textAlign: 'center' },

  // AI summary callout — the page's tinted accent box.
  summary: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#bde5da',
    backgroundColor: '#ecf3ee',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  summaryLabel: { fontSize: 8, fontWeight: 700, color: C.accent, letterSpacing: 0.4, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 3 },
  summaryDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.accent, marginTop: 5 },
  summaryText: { flex: 1, fontSize: 10, color: C.ink2, lineHeight: 1.5 },

  // Article body — mirrors ARTICLE_PROSE (lib/articles/prose.ts).
  content: { marginTop: 14 },
  p: { fontSize: 10.5, color: C.ink2, lineHeight: 1.6, marginBottom: 7 },
  h2: {
    fontSize: 15,
    fontWeight: 500,
    color: C.ink,
    letterSpacing: -0.3,
    lineHeight: 1.25,
    marginTop: 9,
    marginBottom: 5,
  },
  h3: {
    fontSize: 12,
    fontWeight: 500,
    color: C.ink,
    letterSpacing: -0.1,
    lineHeight: 1.3,
    marginTop: 6,
    marginBottom: 4,
  },
  bold: { fontWeight: 600, color: C.ink },
  italic: { fontStyle: 'italic' },
  underline: { textDecoration: 'underline' },
  code: { backgroundColor: C.bgAlt, fontSize: 9.5 },
  link: { color: C.accent, textDecoration: 'underline' },
  list: { marginBottom: 7, gap: 3 },
  nestedList: { marginTop: 3, gap: 3 },
  listRow: { flexDirection: 'row' },
  bulletCell: { width: 15 },
  bulletDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.accent, marginTop: 5.8 },
  number: { fontSize: 10.5, color: C.ink3, lineHeight: 1.6 },
  listBody: { flex: 1 },
  listText: { fontSize: 10.5, color: C.ink2, lineHeight: 1.6 },
  quote: {
    marginTop: 4,
    marginBottom: 9,
    backgroundColor: C.bgAlt,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  // Cormorant is registered at one weight/style only, so inline marks inside a quote stay plain.
  quoteText: { fontFamily: PDF_HEADING_FONT_FAMILY, fontSize: 14, color: C.ink, lineHeight: 1.45 },
  pre: { backgroundColor: C.ink, borderRadius: 8, padding: 10, marginBottom: 8 },
  preText: { fontSize: 9, color: C.white, lineHeight: 1.5 },

  disclaimer: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bgAlt,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 7.5,
    color: C.ink4,
    lineHeight: 1.6,
  },

  footer: {
    position: 'absolute',
    bottom: 18,
    left: 44,
    right: 44,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 7.5,
    color: C.ink4,
  },
  footerLeft: { flex: 1, marginRight: 12 },
  footerBrand: { color: C.ink3, fontWeight: 600 },
  footerLink: { color: C.accent, textDecoration: 'none' },
});

type TextStyle = (typeof s)[keyof typeof s];

function Inlines({ runs, plain = false }: { runs: InlineRun[]; plain?: boolean }) {
  return (
    <>
      {runs.map((run, i) => {
        if (plain) return <Fragment key={i}>{run.text}</Fragment>;
        const style: TextStyle[] = [];
        if (run.bold) style.push(s.bold);
        if (run.italic) style.push(s.italic);
        if (run.underline) style.push(s.underline);
        if (run.code) style.push(s.code);
        if (run.href) {
          return (
            <Link key={i} src={run.href} style={[...style, s.link]}>
              {run.text}
            </Link>
          );
        }
        return style.length ? (
          <Text key={i} style={style}>
            {run.text}
          </Text>
        ) : (
          <Fragment key={i}>{run.text}</Fragment>
        );
      })}
    </>
  );
}

function PdfList({ list, nested = false }: { list: ListBlock; nested?: boolean }) {
  return (
    <View style={nested ? s.nestedList : s.list}>
      {list.items.map((item, i) => (
        <View key={i} style={s.listRow} wrap={false}>
          <View style={s.bulletCell}>
            {list.ordered ? <Text style={s.number}>{i + 1}.</Text> : <View style={s.bulletDot} />}
          </View>
          <View style={s.listBody}>
            {item.inlines.length > 0 && (
              <Text style={s.listText}>
                <Inlines runs={item.inlines} />
              </Text>
            )}
            {item.lists.map((sub, j) => (
              <PdfList key={j} list={sub} nested />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function PdfBlock({ block, inQuote = false }: { block: ArticleBlock; inQuote?: boolean }) {
  switch (block.kind) {
    case 'h2':
    case 'h3':
      return (
        // minPresenceAhead keeps a heading from being stranded alone at the bottom of a page.
        <Text style={s[block.kind]} minPresenceAhead={48}>
          <Inlines runs={block.inlines} />
        </Text>
      );
    case 'p':
      return (
        // An all-bold paragraph is a sub-heading in practice (editors often write them that way),
        // so it gets the same "don't strand at the page foot" rule as a real heading.
        <Text
          style={inQuote ? [s.quoteText, { marginBottom: 4 }] : s.p}
          minPresenceAhead={!inQuote && block.inlines.every((run) => run.bold) ? 48 : undefined}
        >
          <Inlines runs={block.inlines} plain={inQuote} />
        </Text>
      );
    case 'list':
      return <PdfList list={block} />;
    case 'blockquote':
      return (
        <View style={s.quote} wrap={false}>
          {block.blocks.map((inner, i) => (
            <PdfBlock key={i} block={inner} inQuote />
          ))}
        </View>
      );
    case 'pre':
      return (
        <View style={s.pre} wrap={false}>
          {/* Non-breaking spaces keep the code's indentation, which react-pdf would collapse. */}
          <Text style={s.preText}>{block.text.replace(/^ +/gm, (m) => '\u00a0'.repeat(m.length))}</Text>
        </View>
      );
  }
}

export interface ArticlePdfProps {
  article: ArticleDto;
  blocks: ArticleBlock[];
  articleUrl: string;
  qrDataUrl: string;
  logoSrc: string;
  /** PNG data URL; null falls back to initials. */
  authorPhotoDataUrl: string | null;
  generatedAt: Date;
}

export function ArticlePdf({
  article,
  blocks,
  articleUrl,
  qrDataUrl,
  logoSrc,
  authorPhotoDataUrl,
  generatedAt,
}: ArticlePdfProps) {
  const designation = formatAuthorDesignation(article.authorHeadline, article.authorFirmName);
  const meta = [
    formatDate(new Date(article.createdAt)),
    `${article.readTimeMinutes} min read`,
    article.countries.join(', '),
  ]
    .filter(Boolean)
    .join('   ·   ');
  const initials = article.authorName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
  const summary = aiSummaryPoints(article.aiSummary);

  return (
    <Document
      title={article.title}
      author={article.authorName}
      creator="GrowXQ"
      producer="GrowXQ"
      subject={article.excerpt}
    >
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
          <Image src={logoSrc} style={s.brand} />
          <Text style={s.bandNote}>Expert insight</Text>
        </View>

        <View style={s.body}>
          {article.services.length > 0 && (
            <View style={s.chipRow}>
              {article.services.map((service) => (
                <View key={service.id} style={s.chip}>
                  <Text style={s.chipText}>{service.name}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={s.title}>{article.title}</Text>

          <View style={s.byline}>
            {authorPhotoDataUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop
              <Image src={authorPhotoDataUrl} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarInitials]}>
                <Text style={s.avatarInitialsText}>{initials}</Text>
              </View>
            )}
            <View style={s.bylineText}>
              <Text style={s.authorName}>{article.authorName}</Text>
              {designation ? <Text style={s.designation}>{designation}</Text> : null}
              <Text style={s.meta}>{meta}</Text>
            </View>
            <View style={s.qrBox}>
              <Link src={articleUrl}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop */}
                <Image src={qrDataUrl} style={s.qr} />
              </Link>
              <Text style={s.qrCaption}>Scan to read online</Text>
            </View>
          </View>

          {summary.length > 0 && (
            <View style={s.summary} wrap={false}>
              <Text style={s.summaryLabel}>AI SUMMARY</Text>
              {summary.map((point, i) => (
                <View key={i} style={s.summaryRow}>
                  <View style={s.summaryDot} />
                  <Text style={s.summaryText}>{point}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={s.content}>
            {blocks.map((block, i) => (
              <PdfBlock key={i} block={block} />
            ))}
          </View>

          <Text style={s.disclaimer} wrap={false}>
            {ARTICLE_LEGAL_DISCLAIMER}
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerLeft}>
            <Text style={s.footerBrand}>Generated by GrowXQ</Text> on {formatDate(generatedAt)} ·{' '}
            <Link src={articleUrl} style={s.footerLink}>
              {/* Domain only: a full article slug overran the page number. */}
              {displayHost(new URL(articleUrl).origin)}
            </Link>
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
