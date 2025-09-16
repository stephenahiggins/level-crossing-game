import crossingsData from '../assets/level_crossings.json';
import { GameConfig } from './config';
import { allCountryOptions, getCountryName } from './countries';
import type { GameMode, LevelCrossing, RoundData, RoundOption } from './types';

type RawCrossing = {
  id: number;
  image_path?: string;
  imagePath?: string;
  country_code?: string;
  countryCode?: string;
};

const crossings: LevelCrossing[] = (crossingsData as RawCrossing[]).map((item) => ({
  id: item.id,
  imagePath: item.image_path ?? item.imagePath ?? '',
  countryCode: (item.country_code ?? item.countryCode ?? '').toUpperCase(),
}));

const shuffle = <T,>(items: T[]): T[] => {
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
    throw new Error('No level crossings available. Ensure the JSON asset is generated.');
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
  if (mode === 'hard') {
    return [];
  }
  const desired = mode === 'easy' ? GameConfig.easyChoices : GameConfig.mediumChoices;
  const pool = shuffle(
    allCountryOptions.filter((option) => option.code !== correctCode),
  );
  const selected = pool.slice(0, Math.max(0, desired - 1));
  selected.push({ code: correctCode, name: getCountryName(correctCode) });
  return shuffle(selected);
};

export const generateRound = (
  mode: GameMode,
  previousId?: number,
): RoundData => {
  const crossing = pickCrossing(previousId);
  return {
    crossing,
    options: buildOptions(crossing.countryCode, mode),
    correctCode: crossing.countryCode,
  };
};

export const getCrossings = (): LevelCrossing[] => crossings;
