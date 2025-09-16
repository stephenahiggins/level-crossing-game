import type { RoundOption } from './types';

interface CountryInfo {
  code: string;
  name: string;
  synonyms: string[];
}

const buildCountry = (code: string, name: string, synonyms: string[] = []): CountryInfo => ({
  code,
  name,
  synonyms: [name, code, ...synonyms].map((value) => value.toLowerCase()),
});

const countryList: CountryInfo[] = [
  buildCountry('GB', 'United Kingdom', ['uk', 'great britain', 'britain', 'england']),
  buildCountry('US', 'United States', ['usa', 'u.s.', 'u.s.a', 'america', 'united states of america', 'us']),
  buildCountry('FR', 'France', []),
  buildCountry('DE', 'Germany', ['deutschland']),
  buildCountry('JP', 'Japan', []),
  buildCountry('CA', 'Canada', []),
  buildCountry('ES', 'Spain', ['españa']),
  buildCountry('IT', 'Italy', ['italia']),
  buildCountry('AU', 'Australia', []),
  buildCountry('NZ', 'New Zealand', ['aotearoa']),
  buildCountry('IE', 'Ireland', []),
  buildCountry('NL', 'Netherlands', ['holland']),
  buildCountry('BE', 'Belgium', []),
  buildCountry('CH', 'Switzerland', ['schweiz', 'suisse', 'svizzera']),
  buildCountry('NO', 'Norway', ['norge']),
  buildCountry('SE', 'Sweden', ['sverige']),
  buildCountry('FI', 'Finland', ['suomi']),
  buildCountry('PL', 'Poland', ['polska']),
];

export const countries = countryList.reduce<Record<string, CountryInfo>>((acc, country) => {
  acc[country.code] = country;
  return acc;
}, {});

export const allCountryOptions: RoundOption[] = countryList.map((country) => ({
  code: country.code,
  name: country.name,
}));

const clean = (value: string) => value.trim().toLowerCase();

export const normalizeCountryInput = (value: string): string | null => {
  const normalized = clean(value);
  if (!normalized) return null;
  for (const country of countryList) {
    if (country.synonyms.includes(normalized)) {
      return country.code;
    }
  }
  return null;
};

export const findSuggestions = (value: string, limit = 5): RoundOption[] => {
  const normalized = clean(value);
  if (!normalized) return allCountryOptions.slice(0, limit);
  const matches = countryList
    .filter((country) => country.synonyms.some((synonym) => synonym.startsWith(normalized)))
    .slice(0, limit)
    .map((country) => ({ code: country.code, name: country.name }));
  if (matches.length < limit) {
    const extra = countryList
      .filter((country) => country.name.toLowerCase().includes(normalized))
      .slice(0, limit - matches.length)
      .map((country) => ({ code: country.code, name: country.name }));
    matches.push(...extra);
  }
  return matches;
};

export const getCountryName = (code: string): string => countries[code]?.name ?? code;
