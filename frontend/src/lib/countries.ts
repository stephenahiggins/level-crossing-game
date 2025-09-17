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
  buildCountry('AE', 'United Arab Emirates', ['uae', 'emirates']),
  buildCountry('AL', 'Albania', ['shqipëria']),
  buildCountry('AO', 'Angola', []),
  buildCountry('AR', 'Argentina', []),
  buildCountry('AT', 'Austria', ['österreich']),
  buildCountry('AU', 'Australia', []),
  buildCountry('BA', 'Bosnia and Herzegovina', ['bosna i hercegovina']),
  buildCountry('BD', 'Bangladesh', []),
  buildCountry('BE', 'Belgium', []),
  buildCountry('BO', 'Bolivia', []),
  buildCountry('BR', 'Brazil', ['brasil']),
  buildCountry('BY', 'Belarus', ['беларусь']),
  buildCountry('CA', 'Canada', []),
  buildCountry('CH', 'Switzerland', ['schweiz', 'suisse', 'svizzera']),
  buildCountry('CL', 'Chile', []),
  buildCountry('CN', 'China', ['中国']),
  buildCountry('CZ', 'Czech Republic', ['česko', 'česká republika']),
  buildCountry('DE', 'Germany', ['deutschland']),
  buildCountry('DK', 'Denmark', ['danmark']),
  buildCountry('DZ', 'Algeria', ['الجزائر']),
  buildCountry('EE', 'Estonia', ['eesti']),
  buildCountry('ES', 'Spain', ['españa']),
  buildCountry('FI', 'Finland', ['suomi']),
  buildCountry('FR', 'France', []),
  buildCountry('GB', 'United Kingdom', ['uk', 'great britain', 'britain', 'england']),
  buildCountry('GH', 'Ghana', []),
  buildCountry('GR', 'Greece', ['ελλάδα', 'hellas']),
  buildCountry('HR', 'Croatia', ['hrvatska']),
  buildCountry('HU', 'Hungary', ['magyarország']),
  buildCountry('ID', 'Indonesia', []),
  buildCountry('IE', 'Ireland', []),
  buildCountry('IL', 'Israel', ['ישראל']),
  buildCountry('IM', 'Isle of Man', ['mannin']),
  buildCountry('IN', 'India', ['भारत', 'bharat']),
  buildCountry('IT', 'Italy', ['italia']),
  buildCountry('JP', 'Japan', ['日本', 'nippon']),
  buildCountry('KE', 'Kenya', []),
  buildCountry('KG', 'Kyrgyzstan', ['кыргызстан']),
  buildCountry('KR', 'South Korea', ['korea', '한국']),
  buildCountry('KZ', 'Kazakhstan', ['қазақстан']),
  buildCountry('LT', 'Lithuania', ['lietuva']),
  buildCountry('LU', 'Luxembourg', ['lëtzebuerg']),
  buildCountry('LV', 'Latvia', ['latvija']),
  buildCountry('MD', 'Moldova', []),
  buildCountry('ML', 'Mali', []),
  buildCountry('MX', 'Mexico', ['méxico']),
  buildCountry('MY', 'Malaysia', []),
  buildCountry('NA', 'Namibia', []),
  buildCountry('NE', 'Niger', []),
  buildCountry('NL', 'Netherlands', ['holland']),
  buildCountry('NO', 'Norway', ['norge']),
  buildCountry('NZ', 'New Zealand', ['aotearoa']),
  buildCountry('PA', 'Panama', []),
  buildCountry('PH', 'Philippines', ['pilipinas']),
  buildCountry('PK', 'Pakistan', ['پاکستان']),
  buildCountry('PL', 'Poland', ['polska']),
  buildCountry('PT', 'Portugal', []),
  buildCountry('PY', 'Paraguay', []),
  buildCountry('RO', 'Romania', ['românia']),
  buildCountry('RS', 'Serbia', ['србија', 'srbija']),
  buildCountry('RU', 'Russia', ['россия', 'rossiya']),
  buildCountry('SE', 'Sweden', ['sverige']),
  buildCountry('SI', 'Slovenia', ['slovenija']),
  buildCountry('SK', 'Slovakia', ['slovensko']),
  buildCountry('SN', 'Senegal', []),
  buildCountry('TH', 'Thailand', ['ประเทศไทย']),
  buildCountry('TR', 'Turkey', ['türkiye']),
  buildCountry('TW', 'Taiwan', ['臺灣']),
  buildCountry('UA', 'Ukraine', ['україна']),
  buildCountry('US', 'United States', ['usa', 'u.s.', 'u.s.a', 'america', 'united states of america']),
  buildCountry('UY', 'Uruguay', []),
  buildCountry('VN', 'Vietnam', ['việt nam']),
  buildCountry('ZA', 'South Africa', [])
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
