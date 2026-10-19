import { describe, expect, it } from 'vitest';
import { aggDistinct } from './card-text';

// GOLDEN: produced by the dev database (en_US.UTF-8), 2026-10-12:
//   select string_agg(distinct n, ' | ') from (values …) t(n);
// The card builder must order string_agg(distinct …) exactly like Postgres, or card text (and its
// hash) would silently differ and every card would be re-embedded. Do NOT edit EXPECTED to make
// this pass — fix pgCompare in card-text.ts instead.
const INPUT = [
  'Zürich Advisory', 'zurich advisory', 'Zebra Tax', 'Émile Legal', 'Emile Legal', 'émile law',
  'Ångström & Co', 'Angstrom', 'apple', 'Apple', 'APPLE', 'Banana', 'banana', 'Ünal', 'Una',
  "O'Brien", 'OBrien', 'O-Brien', 'Al-Farsi', 'Al Farsi', 'AlFarsi', 'İstanbul', 'Istanbul', '東京',
  'Łódź', 'Lodz', 'Straße Tax', 'Strasse Tax', 'a b', 'ab', 'a-b', '_x', '1 Tax', '10 Tax', '2 Tax',
  'Zeta', 'zeta', 'Ñandú', 'Nandu', 'Oslo', 'Øresund',
];

const EXPECTED =
  "_x | 1 Tax | 10 Tax | 2 Tax | a b | a-b | ab | Al Farsi | Al-Farsi | AlFarsi | Angstrom | Ångström & Co | apple | Apple | APPLE | banana | Banana | émile law | Emile Legal | Émile Legal | Istanbul | İstanbul | Lodz | Łódź | Nandu | Ñandú | O-Brien | O'Brien | OBrien | Øresund | Oslo | Strasse Tax | Straße Tax | Una | Ünal | Zebra Tax | zeta | Zeta | zurich advisory | Zürich Advisory | 東京";

describe('aggDistinct vs Postgres string_agg(distinct …) (en_US.UTF-8)', () => {
  it('orders non-ASCII and mixed-case names exactly like the database', () => {
    expect(aggDistinct(INPUT, ' | ')).toBe(EXPECTED);
  });
  it('is independent of input order', () => {
    expect(aggDistinct([...INPUT].reverse(), ' | ')).toBe(EXPECTED);
  });
});
