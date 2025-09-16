import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';
import { authReducer } from './authSlice';
import { gameReducer } from './gameSlice';
import { leaderboardReducer } from './leaderboardSlice';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    auth: authReducer,
    game: gameReducer,
    leaderboard: leaderboardReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
