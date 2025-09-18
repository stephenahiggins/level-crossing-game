import { GameConfig } from "./config";
import { allCountryOptions, getCountryName } from "./countries";
import type { GameMode, LevelCrossing, LevelCrossingRecord, RoundData, RoundOption } from "./types";

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const computeAssetBase = (): string => {
  const override = (import.meta.env.VITE_ASSET_BASE_URL as string | undefined) ?? "";
  if (override) {
    return trimTrailingSlash(override);
  }
  const apiUrl =
    (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000/api";
  if (!apiUrl) return "";
  try {
    const parsed = new URL(apiUrl);
    const pathname = parsed.pathname.replace(/\/api\/?$/, "");
    const base = trimTrailingSlash(`${parsed.origin}${pathname}`);
    return base || parsed.origin;
  } catch (error) {
    return trimTrailingSlash(apiUrl.replace(/\/api\/?$/, ""));
  }
};

const assetBase = computeAssetBase();

const resolveImagePath = (value: string): string => {
  if (!value) return "";
  const cleaned = value.replace(/\\/g, "/");
  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }
  const relative = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  if (!assetBase) {
    return relative;
  }
  return `${assetBase}${relative}`;
};

let crossings: LevelCrossing[] = [];

// Frequency + ranking data (computed whenever crossings are (re)loaded)
let countryFrequency: Map<string, number> = new Map();
let rankedCountries: string[] = [];// most common -> least common
let rankIndex: Record<string, number> = {}; // countryCode -> rank (0 = most common)

const toNumberOrNull = (value: unknown): number | null => {
  const num = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(num) ? num : null;
};

const toLevelCrossing = (record: LevelCrossingRecord): LevelCrossing | null => {
  if (!record) return null;
  const id = Number(record.id);
  if (!Number.isFinite(id)) return null;
  const countryCode = String(record.country_code ?? record.countryCode ?? "")
    .trim()
    .toUpperCase();
  const rawImage = String(record.image_path ?? record.imagePath ?? record.url ?? "").trim();
  const imagePath = resolveImagePath(rawImage);
  if (!imagePath || !countryCode) {
    return null;
  }
  return {
    id,
    imagePath,
    countryCode,
    latitude: toNumberOrNull(record.latitude),
    longitude: toNumberOrNull(record.longitude),
  };
};

export const setCrossingsData = (records: LevelCrossingRecord[] | undefined | null): void => {
  if (!Array.isArray(records)) {
    crossings = [];
    countryFrequency = new Map();
    rankedCountries = [];
    rankIndex = {};
    return;
  }
  const unique = new Map<number, LevelCrossing>();
  for (const record of records) {
    const crossing = toLevelCrossing(record);
    if (crossing) {
      unique.set(crossing.id, crossing);
    }
  }
  crossings = Array.from(unique.values());

  // Build frequency map & rankings for difficulty scaling
  countryFrequency = new Map();
  for (const c of crossings) {
    countryFrequency.set(c.countryCode, (countryFrequency.get(c.countryCode) ?? 0) + 1);
  }
  rankedCountries = Array.from(countryFrequency.entries())
    .sort((a, b) => b[1] - a[1]) // most common first
    .map(([code]) => code);
  rankIndex = rankedCountries.reduce<Record<string, number>>((acc, code, idx) => {
    acc[code] = idx;
    return acc;
  }, {});
};

export const hasCrossingsData = (): boolean => crossings.some((item) => Boolean(item.imagePath));

const shuffle = <T>(items: T[]): T[] => {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

let lastCountryCode: string | null = null;

// Strict client-side picker safeguard: avoid showing the same country twice consecutively
// if there is any alternative country in the current dataset. Falls back gracefully when only
// one country's crossings are available.
/**
 * Picks a crossing with progressive difficulty.
 * Difficulty increases with roundIndex: earlier rounds bias toward common countries,
 * later rounds toward rare/obscure ones (based on frequency in the loaded dataset).
 */
const pickCrossing = (previousId: number | undefined, roundIndex: number | undefined): LevelCrossing => {
  const available = crossings.filter((item) => item.imagePath);
  if (!available.length) {
    throw new Error("No level crossings available. Populate the backend assets to continue.");
  }

  const distinctCountries = new Set(available.map((c) => c.countryCode).filter(Boolean));

  // Exclude previous crossing by id first (legacy behavior to reduce exact duplicate image)
  let pool = available;
  if (previousId != null && available.length > 1) {
    const withoutPrev = available.filter((c) => c.id !== previousId);
    if (withoutPrev.length) pool = withoutPrev;
  }

  // Enforce no consecutive country repeat when multiple distinct countries exist
  if (distinctCountries.size > 1 && lastCountryCode) {
    const withoutLastCountry = pool.filter((c) => c.countryCode !== lastCountryCode);
    if (withoutLastCountry.length) pool = withoutLastCountry;
  }

  // If we have no ranking data (e.g. insufficient or not yet computed) fallback to uniform
  if (!rankedCountries.length || pool.length <= 1 || roundIndex == null) {
    const pickedSimple = pool[Math.floor(Math.random() * pool.length)];
    lastCountryCode = pickedSimple.countryCode;
    return pickedSimple;
  }

  // Progressive difficulty parameters
  const maxProgressRounds = 12; // after ~12 rounds we've hit full difficulty (typical game length)
  const p = Math.min(Math.max(roundIndex / (maxProgressRounds - 1), 0), 1); // 0..1
  // alpha controls how strongly we bias toward rare countries (higher rank index)
  const alphaStart = 0.15; // near-uniform at beginning
  const alphaEnd = 3.2; // heavily skewed to rare at the end
  const alpha = alphaStart + (alphaEnd - alphaStart) * p;

  // Build weighted list from pool
  let totalWeight = 0;
  const weighted: { crossing: LevelCrossing; w: number }[] = [];
  for (const c of pool) {
    const rank = rankIndex[c.countryCode] ?? 0; // 0 common -> high index rare
    // Weight grows with rank so rare items (higher rank) become more likely as alpha increases
    const weight = Math.pow(rank + 1, alpha);
    if (Number.isFinite(weight) && weight > 0) {
      totalWeight += weight;
      weighted.push({ crossing: c, w: weight });
    }
  }

  if (!weighted.length || !Number.isFinite(totalWeight) || totalWeight <= 0) {
    const fallback = pool[Math.floor(Math.random() * pool.length)];
    lastCountryCode = fallback.countryCode;
    return fallback;
  }

  let threshold = Math.random() * totalWeight;
  for (const item of weighted) {
    threshold -= item.w;
    if (threshold <= 0) {
      lastCountryCode = item.crossing.countryCode;
      return item.crossing;
    }
  }
  // Fallback (floating point edge case)
  const picked = weighted[weighted.length - 1].crossing;
  lastCountryCode = picked.countryCode;
  return picked;
};

const buildOptions = (correctCode: string, mode: GameMode): RoundOption[] => {
  if (mode === "hard") {
    return [];
  }
  const desired = mode === "easy" ? GameConfig.easyChoices : GameConfig.mediumChoices;
  const pool = shuffle(allCountryOptions.filter((option) => option.code !== correctCode));
  const selected = pool.slice(0, Math.max(0, desired - 1));
  selected.push({ code: correctCode, name: getCountryName(correctCode) });
  return shuffle(selected);
};

export const generateRound = (mode: GameMode, previousId?: number, roundIndex?: number): RoundData => {
  const crossing = pickCrossing(previousId, roundIndex);
  return {
    crossing,
    options: buildOptions(crossing.countryCode, mode),
    correctCode: crossing.countryCode,
  };
};

export const getCrossings = (): LevelCrossing[] => [...crossings];
