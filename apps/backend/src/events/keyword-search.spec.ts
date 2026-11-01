import { describe, expect, it } from 'vitest';
import { keywordOrFilter, keywordTerms } from './keyword-search';

describe('keywordTerms', () => {
  it('drops stopwords, trims plurals and lower-cases', () => {
    expect(keywordTerms('Tax webinars in Singapore')).toEqual(['tax', 'webinar', 'singapore']);
  });

  it('strips characters that would break a PostgREST or-filter', () => {
    expect(keywordTerms('GST),title.eq.x (IBC*) 100%')).toEqual(['gsttitleeqx', 'ibc', '100']);
  });

  it('keeps short meaningful words and caps at six', () => {
    expect(keywordTerms('m&a ai uk us eu gcc vat cfo')).toEqual(['m&a', 'ai', 'uk', 'us', 'eu', 'gcc']);
  });
});

describe('keywordOrFilter', () => {
  it('matches the term against every searched column', () => {
    expect(keywordOrFilter('gst')).toBe(
      'title.ilike.*gst*,description.ilike.*gst*,event_type.ilike.*gst*,organiser_name.ilike.*gst*,city.ilike.*gst*,country.ilike.*gst*'
    );
  });
});
