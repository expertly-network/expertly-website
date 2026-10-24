import { City, Country, State } from 'country-state-city';

// Same dataset (and version) as the frontend's cascading Country -> State -> City dropdowns, so a
// combination the form offers always passes. Names, not ISO codes, are what the application
// stores. Returns a human-readable problem, or null when the combination is consistent.
//
// Countries outside the dataset ("Other", or a free-text fallback) can't be checked and pass.
export function findLocationMismatch(
  country: string | null | undefined,
  state: string | null | undefined,
  city: string | null | undefined
): string | null {
  if (!country) return null;
  const countryIso = Country.getAllCountries().find((c) => c.name === country)?.isoCode;
  if (!countryIso) return null;

  const states = State.getStatesOfCountry(countryIso);
  let cityNames: string[];

  if (states.length === 0) {
    if (state) return `state "${state}" — ${country} has no states/provinces; leave it empty`;
    cityNames = (City.getCitiesOfCountry(countryIso) ?? []).map((c) => c.name);
  } else if (state) {
    const stateIso = states.find((s) => s.name === state)?.isoCode;
    if (!stateIso) return `state "${state}" is not in ${country}`;
    cityNames = City.getCitiesOfState(countryIso, stateIso).map((c) => c.name);
  } else {
    cityNames = (City.getCitiesOfCountry(countryIso) ?? []).map((c) => c.name);
  }

  // Some regions have no city data at all — nothing to check against there.
  if (city && cityNames.length > 0 && !cityNames.includes(city)) {
    return `city "${city}" is not in ${state ? `${state}, ` : ''}${country}`;
  }
  return null;
}
