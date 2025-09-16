import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { AuthState } from './authSlice';

export interface ScorePayload {
  mode: 'easy' | 'medium' | 'hard';
  score: number;
  duration: number;
  correctCount: number;
  avgTimePerCorrect: number;
}

export interface ScoreEntry extends ScorePayload {
  id: number;
  displayName: string;
  createdAt: string;
}

export interface UserPayload {
  id: number;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  token: string;
  user: UserPayload;
}

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers, { getState }) => {
      const state = getState() as { auth: AuthState };
      if (state.auth.token) {
        headers.set('authorization', `Bearer ${state.auth.token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Scores', 'Me'],
  endpoints: (builder) => ({
    getTopScores: builder.query<ScoreEntry[], { mode: ScorePayload['mode']; limit?: number }>({
      query: ({ mode, limit = 50 }) => ({
        url: `/scores/top`,
        params: { mode, limit },
      }),
      providesTags: (result) =>
        result ? [...result.map((entry) => ({ type: 'Scores' as const, id: `${entry.mode}-${entry.id}` })), { type: 'Scores', id: 'LIST' }] : [{ type: 'Scores', id: 'LIST' }],
    }),
    postScore: builder.mutation<{ ok: boolean }, ScorePayload>({
      query: (body) => ({
        url: `/scores`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Scores', id: 'LIST' }],
    }),
    login: builder.mutation<AuthResponse, { email: string; password: string }>({
      query: (body) => ({
        url: `/auth/login`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Me', id: 'ME' }],
    }),
    register: builder.mutation<AuthResponse, { email: string; password: string; displayName: string }>({
      query: (body) => ({
        url: `/auth/register`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Me', id: 'ME' }],
    }),
    googleToken: builder.mutation<AuthResponse, { idToken: string }>({
      query: (body) => ({
        url: `/auth/google/token`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Me', id: 'ME' }],
    }),
    getMe: builder.query<UserPayload, void>({
      query: () => ({
        url: `/me`,
        method: 'GET',
      }),
      providesTags: [{ type: 'Me', id: 'ME' }],
    }),
  }),
});

export const {
  useGetTopScoresQuery,
  usePostScoreMutation,
  useLoginMutation,
  useRegisterMutation,
  useGoogleTokenMutation,
  useGetMeQuery,
} = api;
