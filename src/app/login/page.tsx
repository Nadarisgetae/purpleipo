'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, ShieldAlert, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';

function LoginForm() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the access password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push(redirectPath);
        router.refresh();
      } else {
        setError(data.message || 'Incorrect password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-shake">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="password-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          Access Password
        </label>
        <div className="relative">
          <input
            id="password-input"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password..."
            className="w-full px-4 py-3.5 pr-12 rounded-xl bg-slate-900/80 border border-slate-700/60 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-sm"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.99] text-white font-semibold text-sm shadow-lg shadow-purple-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <span>Unlock Access</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </>
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-[#090d16]">
      {/* Background Decorative Ambient Lights */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Main Glass Card */}
      <div className="relative w-full max-w-md glass-panel-glow rounded-3xl p-8 sm:p-10 shadow-2xl transition-all border border-purple-500/20">
        
        {/* Brand Icon Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-700 via-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-600/30 mb-4 ring-4 ring-purple-500/10">
            <Lock className="w-8 h-8 text-white" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Private Personal Tool</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-purple-200 bg-clip-text text-transparent">
            PurpleIPO
          </h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Enter master password to access dashboard
          </p>
        </div>

        {/* Login Form wrapped in Suspense for Next.js prerendering */}
        <Suspense fallback={
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        }>
          <LoginForm />
        </Suspense>

        {/* Footer Note */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-500">
          Gated single-password environment. Managed via Vercel env.
        </div>
      </div>
    </div>
  );
}
