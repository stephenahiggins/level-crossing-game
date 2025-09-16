interface TimerProps {
  seconds: number;
}

export function Timer({ seconds }: TimerProps) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  const formatted = `${minutes}:${remainder.toString().padStart(2, '0')}`;
  const warn = seconds <= 10;
  return (
    <div className={`inline-flex items-center gap-3 px-5 py-2 rounded-full bg-black/40 text-white text-2xl font-extrabold shadow ${warn ? 'animate-pulse bg-red-600/80' : ''}`}>
      <span role="img" aria-label="timer">
        ⏱️
      </span>
      <span>{formatted}</span>
    </div>
  );
}
