import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { useGoogleTokenMutation, useLoginMutation, useRegisterMutation } from '../store/api';

interface CredentialsForm {
  email: string;
  password: string;
  displayName?: string;
}

declare global {
  interface Window {
    google?: any;
  }
}

export function Login() {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [login, { isLoading: loggingIn, error: loginError }] = useLoginMutation();
  const [registerUser, { isLoading: registering, error: registerError }] = useRegisterMutation();
  const [googleToken, { isLoading: googleLoading, error: googleError }] = useGoogleTokenMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CredentialsForm>({ defaultValues: { email: '', password: '', displayName: '' } });

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [navigate, user]);

  const onSubmit = async (data: CredentialsForm) => {
    if (mode === 'login') {
      await login({ email: data.email, password: data.password }).unwrap();
    } else {
      await registerUser({
        email: data.email,
        password: data.password,
        displayName: data.displayName ?? '',
      }).unwrap();
    }
    reset();
    navigate('/');
  };

  const handleGoogleSignIn = async () => {
    if (!window.google?.accounts?.id) {
      alert('Google Identity Services SDK not loaded. Include the GIS script to enable Google sign-in.');
      return;
    }
    let resolved = false;
    const client = window.google.accounts.id;
    client.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (response: { credential: string }) => {
        resolved = true;
        await googleToken({ idToken: response.credential }).unwrap();
        navigate('/');
      },
      auto_select: true,
    });
    client.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        console.warn('Google prompt skipped', notification);
      }
    });
    setTimeout(() => {
      if (!resolved) {
        client.cancel();
      }
    }, 60000);
  };

  const errorMessage = loginError || registerError || googleError;

  return (
    <div className="max-w-lg mx-auto bg-white/90 text-dark rounded-3xl shadow-2xl p-8 mt-10">
      <h2 className="text-3xl font-black mb-6 text-center">Sign in to save your scores</h2>
      <div className="flex justify-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`px-4 py-2 rounded-full font-bold ${mode === 'login' ? 'bg-secondary' : 'bg-dark/10'}`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={`px-4 py-2 rounded-full font-bold ${mode === 'register' ? 'bg-secondary' : 'bg-dark/10'}`}
        >
          Register
        </button>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {mode === 'register' && (
          <div>
            <label className="block text-sm font-semibold mb-1" htmlFor="displayName">
              Display name
            </label>
            <input
              id="displayName"
              className="w-full rounded-2xl border border-dark/20 px-4 py-3"
              {...register('displayName', { required: true, minLength: 2 })}
            />
            {errors.displayName && <p className="text-red-600 text-sm">Please enter a name.</p>}
          </div>
        )}
        <div>
          <label className="block text-sm font-semibold mb-1" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="w-full rounded-2xl border border-dark/20 px-4 py-3"
            {...register('email', { required: true })}
          />
          {errors.email && <p className="text-red-600 text-sm">Email is required.</p>}
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="w-full rounded-2xl border border-dark/20 px-4 py-3"
            {...register('password', { required: true, minLength: 6 })}
          />
          {errors.password && <p className="text-red-600 text-sm">Min 6 characters.</p>}
        </div>
        <button
          type="submit"
          disabled={loggingIn || registering}
          className="bg-primary text-white font-bold rounded-full px-6 py-3 shadow-lg hover:-translate-y-1 transition disabled:opacity-60"
        >
          {mode === 'login' ? (loggingIn ? 'Logging in…' : 'Login') : registering ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full bg-white border border-dark/20 rounded-full px-6 py-3 font-semibold shadow hover:-translate-y-1 transition disabled:opacity-60"
        >
          {googleLoading ? 'Connecting…' : 'Continue with Google'}
        </button>
        <p className="text-sm text-dark/70 mt-3">
          Google sign-in uses the Google Identity Services SDK. Add your client ID to
          <code className="bg-dark/10 px-2 py-1 rounded ml-1">VITE_GOOGLE_CLIENT_ID</code>.
        </p>
      </div>
      {errorMessage && (
        <div className="mt-4 text-red-600 text-center text-sm">
          Something went wrong. Please check your details and try again.
        </div>
      )}
    </div>
  );
}
