import { ModeSelector } from '../components/ModeSelector';
import { Leaderboard } from '../components/Leaderboard';

export function Home() {
  return (
    <div className="max-w-6xl mx-auto">
      <section className="bg-white/15 backdrop-blur rounded-3xl p-8 md:p-12 shadow-2xl text-white">
        <h2 className="text-4xl md:text-5xl font-black mb-4">Spot the level crossing!</h2>
        <p className="text-xl md:text-2xl leading-relaxed max-w-3xl">
          Peek at a real railway crossing from around the world. Tap the right flag
          or type the country name before the timer runs out. Friendly voices and bouncy
          animations cheer you on. Ready to travel?
        </p>
        <ModeSelector />
      </section>

      <section className="mt-10">
        <Leaderboard mode="easy" />
      </section>
    </div>
  );
}
