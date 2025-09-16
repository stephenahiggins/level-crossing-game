import { useMemo, useState } from 'react';
import { GameConfig } from '../lib/config';
import type { GameMode } from '../lib/types';
import { useAppSelector } from '../store/hooks';
import { useGetTopScoresQuery } from '../store/api';

interface LeaderboardProps {
  mode?: GameMode;
  compact?: boolean;
}

const MODE_LABELS: Record<GameMode, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export function Leaderboard({ mode: modeProp = 'easy', compact = false }: LeaderboardProps) {
  const [mode, setMode] = useState<GameMode>(modeProp);
  const localScores = useAppSelector((state) => state.leaderboard.local[mode] ?? []);
  const { data: globalScores, isFetching } = useGetTopScoresQuery({
    mode,
    limit: GameConfig.leaderboardPageSize,
  });

  const topLocal = localScores[0];

  const content = useMemo(() => {
    if (compact) {
      return (
        <div className="bg-black/30 rounded-2xl px-4 py-3 text-sm font-semibold shadow">
          <div className="uppercase tracking-wider text-white/80">Local best</div>
          {topLocal ? (
            <div className="text-white text-xl">{topLocal.score} pts</div>
          ) : (
            <div className="text-white/70">Play to set a score!</div>
          )}
        </div>
      );
    }

    return (
      <div className="bg-white/90 text-dark rounded-3xl p-6 shadow-2xl w-full max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="text-3xl font-extrabold text-dark">Leaderboards</h2>
          <div className="flex gap-2">
            {(Object.keys(MODE_LABELS) as GameMode[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`px-4 py-2 rounded-full font-bold ${mode === key ? 'bg-secondary text-dark shadow-lg' : 'bg-dark/10'}`}
              >
                {MODE_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-2xl font-bold mb-3">Your top scores</h3>
            <ol className="space-y-2">
              {localScores.length === 0 && <li className="text-dark/70">No scores yet — give it a go!</li>}
              {localScores.map((entry, index) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between bg-dark/10 rounded-2xl px-4 py-3"
                >
                  <span className="font-bold text-lg">#{index + 1}</span>
                  <span className="text-lg">{entry.score} pts</span>
                  <span className="text-sm opacity-70">{new Date(entry.timestamp).toLocaleDateString()}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-3 flex items-center gap-2">
              Global top {GameConfig.leaderboardPageSize}
              {isFetching && <span className="text-sm animate-pulse">Loading…</span>}
            </h3>
            <ol className="max-h-80 overflow-y-auto pr-2 space-y-2">
              {(globalScores ?? []).length === 0 && <li className="text-dark/70">No submissions yet.</li>}
              {(globalScores ?? []).map((entry, index) => (
                <li
                  key={`${entry.id}-${entry.displayName}`}
                  className="flex items-center justify-between bg-secondary/40 rounded-2xl px-4 py-3"
                >
                  <span className="font-bold text-lg">#{index + 1}</span>
                  <span className="font-semibold text-lg">{entry.displayName}</span>
                  <span className="text-lg font-extrabold">{entry.score}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    );
  }, [compact, globalScores, isFetching, localScores, mode, topLocal]);

  return content;
}
