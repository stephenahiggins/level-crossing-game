// Central definition of game status constants to avoid scattered string literals.
// Keep this file lightweight: pure constants + type derivations only.

export const GAME_STATUS = {
  IDLE: "idle",
  PLAYING: "playing",
  FEEDBACK: "feedback",
  GAME_OVER: "gameover",
} as const;

export type GameStatus = (typeof GAME_STATUS)[keyof typeof GAME_STATUS];

export const FEEDBACK_STATE = {
  CORRECT: "correct",
  TRY_AGAIN: "try-again",
  FAILED: "failed",
} as const;

export type FeedbackState = (typeof FEEDBACK_STATE)[keyof typeof FEEDBACK_STATE] | null;
