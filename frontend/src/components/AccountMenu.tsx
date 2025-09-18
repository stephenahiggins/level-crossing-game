import { Link } from 'react-router-dom';
import { clearCredentials } from '../store/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

export function AccountMenu() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  if (!user) {
    return (
      <Link
        to="/login"
        className="bg-white/80 text-dark font-semibold px-4 py-2 rounded-full shadow hover:-translate-y-0.5 transition"
      >
        Sign in
      </Link>
    );
  }

  const handleSignOut = () => {
    dispatch(clearCredentials());
  };

  return (
    <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-full shadow">
      <span className="font-semibold">{user.displayName}</span>
      <button
        type="button"
        onClick={handleSignOut}
        className="bg-secondary text-dark font-bold px-3 py-1 rounded-full shadow hover:-translate-y-0.5 transition"
      >
        Sign out
      </button>
    </div>
  );
}
