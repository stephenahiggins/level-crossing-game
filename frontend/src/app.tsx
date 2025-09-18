import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { Game } from './pages/Game';
import { Login } from './pages/Login';
import { Leaderboard } from './components/Leaderboard';
import { AccountMenu } from './components/AccountMenu';
import { useAppDispatch } from './store/hooks';
import { restoreFromStorage } from './store/leaderboardSlice';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(restoreFromStorage());
  }, [dispatch]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary via-secondary to-dark text-white">
      <ScrollToTop />
      <header className="py-4 px-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold drop-shadow-lg">
          Where&apos;s This Level Crossing?
        </h1>
        <div className="flex items-center gap-4">
          <Leaderboard compact />
          <AccountMenu />
        </div>
      </header>
      <main className="flex-1 px-4 pb-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game/:mode" element={<Game />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
      <footer className="py-4 text-center text-sm opacity-80">
        Built for curious kids – spot the crossing, guess the country!
      </footer>
    </div>
  );
}
