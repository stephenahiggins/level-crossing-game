import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { api, type AuthResponse } from './api';

export interface AuthState {
  token: string | null;
  user: AuthResponse['user'] | null;
}

const storageKey = 'wtlc-auth';

const readInitialState = (): AuthState => {
  if (typeof window === 'undefined') {
    return { token: null, user: null };
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { token: null, user: null };
    const parsed = JSON.parse(raw) as AuthState;
    return parsed;
  } catch (err) {
    console.warn('Failed to parse auth storage', err);
    return { token: null, user: null };
  }
};

const persistState = (state: AuthState) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to persist auth storage', err);
  }
};

const initialState: AuthState = readInitialState();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<AuthResponse>) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      persistState(state);
    },
    clearCredentials: (state) => {
      state.token = null;
      state.user = null;
      persistState(state);
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(api.endpoints.login.matchFulfilled, (state, { payload }) => {
        state.token = payload.token;
        state.user = payload.user;
        persistState(state);
      })
      .addMatcher(api.endpoints.register.matchFulfilled, (state, { payload }) => {
        state.token = payload.token;
        state.user = payload.user;
        persistState(state);
      })
      .addMatcher(api.endpoints.googleToken.matchFulfilled, (state, { payload }) => {
        state.token = payload.token;
        state.user = payload.user;
        persistState(state);
      })
      .addMatcher(api.endpoints.getMe.matchFulfilled, (state, { payload }) => {
        state.user = payload;
        persistState(state);
      });
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export const authReducer = authSlice.reducer;
