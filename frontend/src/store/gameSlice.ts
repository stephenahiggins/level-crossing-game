import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { GameConfig } from "../lib/config";
import { generateRound } from "../lib/roundGenerator";
import type { GameMode, RoundData, RoundOutcome } from "../lib/types";
import {
  GAME_STATUS,
  FEEDBACK_STATE,
  type GameStatus,
  type FeedbackState,
} from "../constants/gameStatus";

interface ActiveRound extends RoundData {
  attempts: number;
  failed: boolean;
  lastAnswer?: string;
}

// GameStatus & FeedbackState imported from constants

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
  lastTimeoutAnswer?: { code: string; latitude: number | null; longitude: number | null } | null;
}

const createInitialState = (): GameState => ({
  mode: null,
  status: GAME_STATUS.IDLE,
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
  lastTimeoutAnswer: null,
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
  name: "game",
  initialState,
  reducers: {
    startGame: (state, action: PayloadAction<StartGamePayload>) => {
      Object.assign(state, createInitialState());
      state.mode = action.payload.mode;
      state.status = GAME_STATUS.PLAYING;
      const next = generateRound(state.mode);
      state.round = toActiveRound(next);
      state.previousCrossingId = next.crossing.id;
      state.roundStartedAt = Date.now();
    },
    submitAnswer: (state, action: PayloadAction<SubmitAnswerPayload>) => {
      if (!state.round || state.status !== GAME_STATUS.PLAYING) {
        return;
      }
      const { answer, timeTaken } = action.payload;
      state.round.lastAnswer = answer;
      state.round.attempts += 1;
      const isCorrect = answer === state.round.correctCode;

      if (isCorrect) {
        state.feedback = FEEDBACK_STATE.CORRECT;
        state.status = GAME_STATUS.FEEDBACK;
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
          state.status = GAME_STATUS.GAME_OVER;
          // Ensure the game over screen is visible instead of a stale feedback overlay
          state.feedback = null;
          // record the round that just ended due to timeout (already solved so nothing to show)
          state.lastTimeoutAnswer = null;
        }
      } else if (state.round.attempts < GameConfig.maxAttemptsPerRound) {
        state.feedback = FEEDBACK_STATE.TRY_AGAIN;
        state.status = GAME_STATUS.FEEDBACK;
      } else {
        state.feedback = FEEDBACK_STATE.FAILED;
        state.status = GAME_STATUS.FEEDBACK;
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
          state.status = GAME_STATUS.GAME_OVER;
          // Clear feedback so the player sees the game over / high score UI
          state.feedback = null;
          state.lastTimeoutAnswer = {
            code: state.round.correctCode,
            latitude: state.round.crossing.latitude ?? null,
            longitude: state.round.crossing.longitude ?? null,
          };
        }
      }
    },
    nextRound: (state) => {
      if (!state.mode) return;
      if (state.timer <= 0) {
        state.status = GAME_STATUS.GAME_OVER;
        return;
      }
      const next = generateRound(state.mode, state.round?.crossing.id ?? state.previousCrossingId);
      state.round = toActiveRound(next);
      state.status = GAME_STATUS.PLAYING;
      state.feedback = null;
      state.previousCrossingId = next.crossing.id;
      state.roundStartedAt = Date.now();
    },
    tickTimer: (state) => {
      if (state.status !== GAME_STATUS.PLAYING) return;
      if (state.timer <= 0) {
        state.status = GAME_STATUS.GAME_OVER;
        return;
      }
      state.timer -= 1;
      if (state.timer <= 0) {
        state.timer = 0;
        state.status = GAME_STATUS.GAME_OVER;
        if (state.round) {
          state.lastTimeoutAnswer = {
            code: state.round.correctCode,
            latitude: state.round.crossing.latitude ?? null,
            longitude: state.round.crossing.longitude ?? null,
          };
        }
      }
    },
    endGame: (state) => {
      state.status = GAME_STATUS.GAME_OVER;
      state.roundStartedAt = null;
      if (state.round) {
        state.lastTimeoutAnswer = {
          code: state.round.correctCode,
          latitude: state.round.crossing.latitude ?? null,
          longitude: state.round.crossing.longitude ?? null,
        };
      }
    },
    resetGame: () => createInitialState(),
    setFeedbackAcknowledged: (state) => {
      // Always clear feedback; if the game already ended, just reveal the gameover screen
      if (state.feedback) {
        state.feedback = null;
      }
      if (state.status === GAME_STATUS.FEEDBACK) {
        if (state.timer <= 0) {
          state.status = GAME_STATUS.GAME_OVER;
        } else {
          state.status = GAME_STATUS.PLAYING;
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
