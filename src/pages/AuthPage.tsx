import { ArrowRight, KeyRound, Mail } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { BrandLogo } from '../components/BrandLogo.tsx';
import { useStore } from '../context/StoreContext.tsx';
import {
  loginWithEmail,
  registerWithEmail,
  resetUserPassword,
  signInWithGooglePopup,
} from '../lib/firebase.ts';

type AuthMode = 'login' | 'register' | 'reset';

export function AuthPage() {
  const { user, navigate, pushToast } = useStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate('/account');
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGooglePopup();
      pushToast('Signed in to Diamond Market', 'success');
      navigate('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        pushToast('Welcome back to Diamond Market', 'success');
        navigate('/account');
      } else if (mode === 'register') {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await registerWithEmail(email, password, displayName);
        pushToast('Account created successfully', 'success');
        navigate('/account');
      } else {
        await resetUserPassword(email);
        setNotice('Password reset link sent to your email address.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      if (msg.includes('operation-not-allowed')) {
        setError(
          'Email/Password sign-in is not yet enabled in Firebase Console. Use Google Sign-In above or enable Email/Password in Firebase Console.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#FAF8F3] min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white border border-[#E8E8E8] rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="space-y-2">
          <BrandLogo variant="light" compact />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8C6D34] pt-2">
            Customer Account
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111111]">
            {mode === 'login'
              ? 'Sign In to Diamond Market'
              : mode === 'register'
              ? 'Create Customer Account'
              : 'Reset Password'}
          </h1>
          <p className="text-xs text-[#333333]/75">
            Track your shoes &amp; wears orders, save Nigerian addresses, and sync your wishlist.
          </p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={handleGoogleSignIn}
          className="w-full py-3 px-4 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#2a2a2a] transition-colors cursor-pointer flex items-center justify-center gap-3"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="relative flex items-center justify-center">
          <span className="border-t border-[#E8E8E8] w-full" />
          <span className="bg-white px-3 text-xs text-neutral-400 uppercase">or</span>
          <span className="border-t border-[#E8E8E8] w-full" />
        </div>

        <div className="flex gap-1 p-1 bg-[#FAF8F3] border border-[#E8E8E8] rounded-full">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-full cursor-pointer ${
              mode === 'login' ? 'bg-white text-[#111111] shadow-xs' : 'text-[#333333]/75'
            }`}
          >
            Email Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-full cursor-pointer ${
              mode === 'register' ? 'bg-white text-[#111111] shadow-xs' : 'text-[#333333]/75'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-semibold text-[#111111] mb-1.5">
                Full Name
              </label>
              <input
                id="auth-name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Tunde Adebayo"
                className="w-full border border-[#E8E8E8] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-semibold text-[#111111] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-[#E8E8E8] rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
              />
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <label htmlFor="auth-pass" className="block text-xs font-semibold text-[#111111] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-[#E8E8E8] rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                />
                <KeyRound className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 leading-relaxed">
              {error}
            </div>
          )}
          {notice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-[#C6A15B] text-[#111111] text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#b58f48] transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <span>
              {busy
                ? 'Please wait...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Create Account'
                : 'Send Reset Email'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {mode !== 'reset' ? (
            <button
              type="button"
              onClick={() => {
                setMode('reset');
                setError(null);
              }}
              className="w-full text-center text-xs text-[#333333]/75 hover:text-[#111111] cursor-pointer"
            >
              Forgot your password?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full text-center text-xs text-[#333333]/75 hover:text-[#111111] cursor-pointer"
            >
              Back to Sign In
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
