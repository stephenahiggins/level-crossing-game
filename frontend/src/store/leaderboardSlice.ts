import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { api, type ScoreEntry } from './api';

type Mode = 'easy' | 'medium' | 'hard';

export interface LocalScore {
  id: string;
  score: number;
  correctCount: number;
  duration: number;
  avgTimePerCorrect: number;
  timestamp: string;
}

export interface LeaderboardState {
  local: Record<Mode, LocalScore[]>;
  global: Record<Mode, ScoreEntry[]>;
}

const storageKey = 'wtlc-local-highs';

const emptyModeMap = (): Record<Mode, any[]> => ({
  easy: [],
  medium: [],
  hard: [],
});

const readLocalScores = (): Record<Mode, LocalScore[]> => {
  if (typeof window === 'undefined') {
    return emptyModeMap();
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return emptyModeMap();
    const parsed = JSON.parse(raw) as Record<Mode, LocalScore[]>;
    return {
      easy: parsed.easy ?? [],
      medium: parsed.medium ?? [],
      hard: parsed.hard ?? [],
    };
  } catch (err) {
    console.warn('Failed to parse local leaderboard', err);
    return emptyModeMap();
  }
};

const persistLocalScores = (scores: Record<Mode, LocalScore[]>) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(scores));
  } catch (err) {
    console.warn('Failed to persist local leaderboard', err);
  }
};

const initialState: LeaderboardState = {
  local: emptyModeMap() as Record<Mode, LocalScore[]>,
  global: emptyModeMap() as Record<Mode, ScoreEntry[]>,
};

const leaderboardSlice = createSlice({
  name: 'leaderboard',
  initialState,
  reducers: {
    restoreFromStorage: (state) => {
      state.local = readLocalScores();
    },
    recordLocalScore: (
      state,
      action: PayloadAction<{ mode: Mode; score: LocalScore }>,
    ) => {
      const { mode, score } = action.payload;
      const list = state.local[mode];
      list.push(score);
      list.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.avgTimePerCorrect - b.avgTimePerCorrect;
      });
      if (list.length > 10) {
        list.length = 10;
      }
      persistLocalScores(state.local);
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(api.endpoints.getTopScores.matchFulfilled, (state, { meta, payload }) => {
      const mode = meta?.arg.originalArgs.mode as Mode;
      state.global[mode] = payload;
    });
  },
});

export const { restoreFromStorage, recordLocalScore } = leaderboardSlice.actions;
export const leaderboardReducer = leaderboardSlice.reducer;
