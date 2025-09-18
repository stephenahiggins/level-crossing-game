import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { GameConfig } from '../lib/config';
import { generateRound } from '../lib/roundGenerator';
import type { GameMode, RoundData, RoundOutcome } from '../lib/types';

interface ActiveRound extends RoundData {
  attempts: number;
  failed: boolean;
  lastAnswer?: string;
}

type GameStatus = 'idle' | 'playing' | 'feedback' | 'gameover';

type FeedbackState = 'correct' | 'try-again' | 'failed' | null;

interface GameState {
  mode: GameMode | null;
  status: GameStatus;
  timer: number;
  round: ActiveRound | null;
  feedback: FeedbackState;
  score: number;
  correctCount: number;
  failedRounds: number;
  totalCorrectTime: number;
  outcomes: RoundOutcome[];
  previousCrossingId?: number;
  roundStartedAt: number | null;
  roundIndex: number; // zero-based round counter for difficulty scaling
}

const createInitialState = (): GameState => ({
  mode: null,
  status: 'idle',
  timer: GameConfig.gameSeconds,
  round: null,
  feedback: null,
  score: 0,
  correctCount: 0,
  failedRounds: 0,
  totalCorrectTime: 0,
  outcomes: [],
  previousCrossingId: undefined,
  roundStartedAt: null,
  roundIndex: 0,
});

const initialState: GameState = createInitialState();

interface StartGamePayload {
  mode: GameMode;
}

interface SubmitAnswerPayload {
  answer: string;
  timeTaken: number;
}

const toActiveRound = (round: RoundData): ActiveRound => ({
  ...round,
  attempts: 0,
  failed: false,
});

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    startGame: (state, action: PayloadAction<StartGamePayload>) => {
      Object.assign(state, createInitialState());
      state.mode = action.payload.mode;
      state.status = 'playing';
      const next = generateRound(state.mode, undefined, state.roundIndex);
      state.round = toActiveRound(next);
      state.previousCrossingId = next.crossing.id;
      state.roundStartedAt = Date.now();
    },
    submitAnswer: (state, action: PayloadAction<SubmitAnswerPayload>) => {
      if (!state.round || state.status !== 'playing') {
        return;
      }
      const { answer, timeTaken } = action.payload;
      state.round.lastAnswer = answer;
      state.round.attempts += 1;
      const isCorrect = answer === state.round.correctCode;

      if (isCorrect) {
        state.feedback = 'correct';
        state.status = 'feedback';
        state.score += 1;
        state.correctCount += 1;
        state.totalCorrectTime += timeTaken;
        state.outcomes.push({
          crossingId: state.round.crossing.id,
          countryCode: state.round.correctCode,
          attempts: state.round.attempts,
          success: true,
          duration: timeTaken,
        });
        state.round.failed = false;
        state.roundStartedAt = null;
        state.timer = Math.max(0, state.timer - GameConfig.secondsPerTurn);
        if (state.timer <= 0) {
          state.status = 'gameover';
        }
      } else if (state.round.attempts < GameConfig.maxAttemptsPerRound) {
        state.feedback = 'try-again';
        state.status = 'feedback';
      } else {
        state.feedback = 'failed';
        state.status = 'feedback';
        state.failedRounds += 1;
        state.outcomes.push({
          crossingId: state.round.crossing.id,
          countryCode: state.round.correctCode,
          attempts: state.round.attempts,
          success: false,
          duration: timeTaken,
        });
        state.round.failed = true;
        state.roundStartedAt = null;
        state.timer = Math.max(0, state.timer - GameConfig.secondsPerTurn);
        if (state.timer <= 0) {
          state.status = 'gameover';
        }
      }
    },
    nextRound: (state) => {
      if (!state.mode) return;
      if (state.timer <= 0) {
        // Game already over; ensure feedback overlay is dismissed
        state.status = 'gameover';
        state.feedback = null;
        return;
      }
      state.roundIndex += 1;
      const next = generateRound(
        state.mode,
        state.round?.crossing.id ?? state.previousCrossingId,
        state.roundIndex
      );
      state.round = toActiveRound(next);
      state.status = 'playing';
      state.feedback = null;
      state.previousCrossingId = next.crossing.id;
      state.roundStartedAt = Date.now();
    },
    tickTimer: (state) => {
      if (state.status !== 'playing') return;
      if (state.timer <= 0) {
        state.status = 'gameover';
        return;
      }
      state.timer -= 1;
      if (state.timer <= 0) {
        state.timer = 0;
        state.status = 'gameover';
      }
    },
    endGame: (state) => {
      state.status = 'gameover';
      state.roundStartedAt = null;
    },
    resetGame: () => createInitialState(),
    setFeedbackAcknowledged: (state) => {
      if (state.status === 'feedback') {
        state.feedback = null;
        if (state.timer <= 0) {
          state.status = 'gameover';
        } else {
          state.status = 'playing';
        }
      }
    },
  },
});

export const {
  startGame,
  submitAnswer,
  nextRound,
  tickTimer,
  endGame,
  resetGame,
  setFeedbackAcknowledged,
} = gameSlice.actions;

export const gameReducer = gameSlice.reducer;
