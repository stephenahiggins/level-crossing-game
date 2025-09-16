import { useNavigate } from 'react-router-dom';
import type { GameMode } from '../lib/types';

const MODES: Array<{ mode: GameMode; title: string; description: string; color: string }> = [
  { mode: 'easy', title: 'Easy', description: 'See the flags and their names.', color: 'from-green-400 to-green-600' },
  { mode: 'medium', title: 'Medium', description: 'Flags only – no text clues!', color: 'from-yellow-400 to-yellow-600' },
  { mode: 'hard', title: 'Hard', description: 'Type the country name yourself.', color: 'from-red-400 to-red-600' },
];

export function ModeSelector() {
  const navigate = useNavigate();
  const handleSelect = (mode: GameMode) => {
    navigate(`/game/${mode}`);
  };

  return (
    <div className="grid md:grid-cols-3 gap-6 mt-6">
      {MODES.map((item) => (
        <button
          key={item.mode}
          type="button"
          onClick={() => handleSelect(item.mode)}
          className={`rounded-3xl p-6 text-left shadow-xl bg-gradient-to-br ${item.color} hover:scale-[1.02] transition-transform focus:outline-none focus:ring-4 focus:ring-white/60`}
        >
          <div className="text-3xl font-extrabold mb-2 drop-shadow-md">{item.title}</div>
          <div className="text-lg font-semibold opacity-90">{item.description}</div>
        </button>
      ))}
    </div>
  );
}
