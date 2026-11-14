// The application stores and displays the app's canonical country names (ALL_COUNTRIES in
// lib/members/countries.ts — the same names the backend's region map and the member-directory
// country filter use). The cascading State -> City options come from the `country-state-city`
// dataset, which spells 18 of those names differently. This maps canonical -> dataset name so
// every canonical country resolves to a dataset ISO code; names not listed here are spelled the
// same in both.
//
// Mirrored on the backend in apps/backend/src/applications/constants/country-dataset-aliases.ts
// (the submit-time state/city consistency check); the frontend may only `import type` from
// shared-types, so keep both in sync by hand.
export const DATASET_NAME_BY_COUNTRY: Readonly<Record<string, string>> = {
  'Antigua and Barbuda': 'Antigua And Barbuda',
  Bahamas: 'The Bahamas',
  'Cabo Verde': 'Cape Verde',
  'Congo, Democratic Republic of the': 'Democratic Republic of the Congo',
  'Congo, Republic of the': 'Congo',
  Czechia: 'Czech Republic',
  Eswatini: 'Swaziland',
  Fiji: 'Fiji Islands',
  Gambia: 'The Gambia',
  'Ivory Coast': "Cote D'Ivoire (Ivory Coast)",
  'North Macedonia': 'Macedonia',
  Palestine: 'Palestinian Territory Occupied',
  'Papua New Guinea': 'Papua new Guinea',
  'Saint Kitts and Nevis': 'Saint Kitts And Nevis',
  'Saint Vincent and the Grenadines': 'Saint Vincent And The Grenadines',
  'Timor-Leste': 'East Timor',
  'Trinidad and Tobago': 'Trinidad And Tobago',
  'Vatican City': 'Vatican City State (Holy See)',
};

/** The dataset's spelling of a canonical country name (itself when they agree). */
export function datasetCountryName(country: string): string {
  return DATASET_NAME_BY_COUNTRY[country] ?? country;
}
