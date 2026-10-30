import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  aggDistinct,
  btrim,
  concatLines,
  formatEventDate,
  jsonbEachText,
  jsonbText,
  line,
  nz,
  pgCompare,
  type JsonValue,
} from './card-text';
import type { ArticleSource, CardResult, DocType, EventSource, MemberSource, SearchCard } from './card.types';
import { redactCardText } from './redaction';

const OTHER_PLACEHOLDER = /^other \(please/i;

/**
 * Builds the denormalised search "card" for a member / article / event. Port of
 * search_rebuild_member / _article / _event + search_put. The card TEXT FORMAT (line labels and
 * order) is what the embeddings and the judge prompt were tuned on — keep it byte-identical.
 */
@Injectable()
export class CardBuilderService {
  buildMember(src: MemberSource): CardResult {
    const r = src.profile;
    const person = src.person;
    if (!person || r.status !== 'active' || person.status !== 'active' || person.deleted_at !== null) return null;

    const services = aggDistinct(
      src.services.map((s) =>
        OTHER_PLACEHOLDER.test(s.service_name)
          ? nz(s.custom_label)
          : s.service_name + (nz(s.custom_label) !== null ? ' - ' + s.custom_label : '')
      ),
      '; '
    );
    const categories = aggDistinct(
      src.services.map((s) => s.category_name),
      '; '
    );
    const serviceIds = [...new Set(src.services.map((s) => s.service_id))].sort();

    const name = btrim((person.first_name ?? '') + ' ' + (person.last_name ?? ''));
    const location = nz([nz(r.city), nz(r.state), nz(r.country)].filter((p): p is string => p !== null).join(', '));

    const content = concatLines([
      'Member: ' + name,
      line('Headline: ', nz(r.headline)),
      line('Firm: ', nz(r.firm_name)),
      line('Location: ', location),
      line('Practice areas: ', services),
      line('Practice categories: ', categories),
      line('Years of experience: ', r.years_of_experience === null ? null : String(r.years_of_experience)),
      line('About: ', nz(r.bio)),
      line('Work experience: ', jsonbText(r.work_experiences)),
      line('Education: ', jsonbText(r.educations)),
      line('Notable engagements: ', jsonbText(r.engagements)),
      line('Key clients: ', jsonbText(r.key_clients)),
      line('Qualifications: ', jsonbText(r.qualifications)),
      line('Credentials: ', jsonbText(r.credentials)),
      line('Awards: ', jsonbText(r.awards)),
      line('Availability: ', nz(r.availability_notes)),
    ]);

    return this.put({
      docType: 'member',
      sourceId: r.profile_id,
      title: nz(name) ?? r.slug,
      firm: r.firm_name,
      content,
      serviceIds,
      countries: nz(r.country) !== null ? [r.country] : [],
      city: r.city,
      eventStart: null,
      eventEnd: null,
      rateMinCents: r.rate_min_cents,
      rateMaxCents: r.rate_max_cents,
      isAvailable: r.is_available,
      docDate: r.membership_started_at ?? r.created_at,
    });
  }

  buildArticle(src: ArticleSource): CardResult {
    const a = src.article;
    if (a.status !== 'published') return null;

    const topics =
      src.serviceNames
        .filter((n) => !OTHER_PLACEHOLDER.test(n))
        .sort(pgCompare)
        .join('; ') || null;
    const labels = a.custom_service_labels;
    const custom =
      labels !== null && typeof labels === 'object' && !Array.isArray(labels)
        ? jsonbEachText(labels as { [key: string]: JsonValue })
            .map((kv) => kv.value)
            .filter((v): v is string => v !== null && v !== '')
            .join('; ') || null
        : null;
    const author = src.author ? nz(btrim((src.author.first_name ?? '') + ' ' + (src.author.last_name ?? ''))) : null;

    const content = concatLines([
      'Article: ' + a.title,
      line('Author: ', author),
      // concat_ws('; ', topics, custom) is '' (not NULL) when both are NULL, so this line stays.
      'Topics: ' + [topics, custom].filter((p): p is string => p !== null).join('; '),
      line('Countries: ', nz(a.countries.join(', '))),
      line('State or region: ', nz(a.state)),
      line('Summary: ', nz(a.ai_summary)),
      line('Excerpt: ', nz(a.excerpt)),
      line('Body: ', nz(a.body)),
    ]);

    return this.put({
      docType: 'article',
      sourceId: a.id,
      title: a.title,
      firm: null,
      content,
      serviceIds: a.service_ids,
      countries: a.countries,
      city: null,
      eventStart: null,
      eventEnd: null,
      rateMinCents: null,
      rateMaxCents: null,
      isAvailable: null,
      docDate: a.created_at,
    });
  }

  buildEvent(e: EventSource): CardResult {
    if (e.status !== 'published') return null;

    const location = nz([nz(e.city), nz(e.country)].filter((p): p is string => p !== null).join(', '));
    const content = concatLines([
      'Event: ' + e.title,
      line('Type: ', nz(e.event_type)),
      line('Format: ', e.event_format === null ? null : e.event_format.replace(/_/g, ' ')),
      line('Organiser: ', nz(e.organiser_name)),
      line('Venue: ', nz(e.venue_name)),
      line('Location: ', location),
      'Date: ' + formatEventDate(e.start_date),
      'Admission: ' + (e.is_free ? 'Free' : 'Paid'),
      line('Summary: ', nz(e.short_description)),
      line('Details: ', nz(e.description)),
    ]);

    return this.put({
      docType: 'event',
      sourceId: e.id,
      title: e.title,
      firm: e.organiser_name,
      content,
      serviceIds: [],
      countries: nz(e.country) !== null ? [e.country as string] : [],
      city: e.city,
      eventStart: e.start_date,
      eventEnd: e.end_date,
      rateMinCents: null,
      rateMaxCents: null,
      isAvailable: null,
      docDate: e.start_date,
    });
  }

  /** search_put(): redact contact details BEFORE hashing, then derive search_name and the hash. */
  private put(p: {
    docType: DocType;
    sourceId: string;
    title: string;
    firm: string | null;
    content: string;
    serviceIds: string[];
    countries: string[];
    city: string | null;
    eventStart: string | null;
    eventEnd: string | null;
    rateMinCents: number | null;
    rateMaxCents: number | null;
    isAvailable: boolean | null;
    docDate: string;
  }): SearchCard {
    const content = redactCardText(p.content);
    return {
      docType: p.docType,
      sourceId: p.sourceId,
      title: p.title,
      searchName: btrim(p.title + ' ' + (p.firm ?? '')),
      content,
      contentHash: createHash('md5')
        .update(p.title + '\n' + content, 'utf8')
        .digest('hex'),
      serviceIds: p.serviceIds,
      countries: p.countries,
      city: nz(p.city),
      eventStart: p.eventStart,
      eventEnd: p.eventEnd,
      rateMinCents: p.rateMinCents,
      rateMaxCents: p.rateMaxCents,
      isAvailable: p.isAvailable,
      docDate: p.docDate,
    };
  }
}
