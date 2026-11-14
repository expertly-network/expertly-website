// The application stores the app's canonical country names (the keys of COUNTRY_TO_REGION in
// ./country-region.ts). The `country-state-city` dataset used for the submit-time State/City
// consistency check spells 18 of them differently; this maps canonical -> dataset name. Names not
// listed are spelled the same in both.
//
// Mirror of apps/frontend/lib/location/dataset-aliases.ts (the wizard's cascading dropdowns) —
// the frontend may only `import type` from shared-types, so keep both in sync by hand.
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
