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
  };
};

export const setCrossingsData = (records: LevelCrossingRecord[] | undefined | null): void => {
  if (!Array.isArray(records)) {
    crossings = [];
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

const pickCrossing = (previousId?: number): LevelCrossing => {
  const available = crossings.filter((item) => item.imagePath);
  if (!available.length) {
    throw new Error("No level crossings available. Populate the backend assets to continue.");
  }
  let candidate: LevelCrossing = available[Math.floor(Math.random() * available.length)];
  if (previousId != null && available.length > 1) {
    let attempts = 0;
    while (candidate.id === previousId && attempts < 10) {
      candidate = available[Math.floor(Math.random() * available.length)];
      attempts += 1;
    }
  }
  return candidate;
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

export const generateRound = (mode: GameMode, previousId?: number): RoundData => {
  const crossing = pickCrossing(previousId);
  return {
    crossing,
    options: buildOptions(crossing.countryCode, mode),
    correctCode: crossing.countryCode,
  };
};

export const getCrossings = (): LevelCrossing[] => [...crossings];
