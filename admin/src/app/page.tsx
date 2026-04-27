'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { user, loading, isAdmin, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && isAdmin) {
      router.replace('/dashboard');
    }
  }, [user, loading, isAdmin, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-800">
        <div className="w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(#00ff88 1px, transparent 1px), linear-gradient(90deg, #00ff88 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Glow orb */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-neon-green opacity-5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-neon-green-dim border border-neon-green/30 mb-4 neon-glow">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#00ff88" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="4" fill="#00ff88" />
              <path d="M12 2C12 2 8 6 8 12s4 10 4 10" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M12 2C12 2 16 6 16 12s-4 10-4 10" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M2 12h20" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white neon-text">Openly Admin</h1>
          <p className="text-slate-400 text-sm mt-1">Moderation Dashboard</p>
        </div>

        {/* Login card */}
        <form onSubmit={handleSubmit} className="bg-navy-700 border border-navy-400 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">Sign in to continue</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@openlypal.com"
                className="w-full bg-navy-800 border border-navy-400 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-neon-green focus:ring-1 focus:ring-neon-green transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-navy-800 border border-navy-400 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-neon-green focus:ring-1 focus:ring-neon-green transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full bg-neon-green text-navy-900 font-bold py-3 rounded-xl hover:bg-neon-green-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed neon-glow"
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-slate-600 text-xs mt-6">
          Admin access only · openlypal.com
        </p>
      </div>
    </div>
  );
}
