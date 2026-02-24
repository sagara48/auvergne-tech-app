import { useState, useEffect, useRef } from 'react';
import { Building2, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck, Clock } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

type AuthMode = 'login' | 'forgot';

// ═══ SÉCURITÉ : Protection brute force ═══
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;  // Fenêtre de 10 minutes

function getLoginAttempts(): { count: number; firstAttempt: number; lockedUntil: number } {
  try {
    const raw = localStorage.getItem('_auth_attempts');
    if (!raw) return { count: 0, firstAttempt: 0, lockedUntil: 0 };
    const data = JSON.parse(raw);
    // Reset si la fenêtre est dépassée
    if (data.firstAttempt && Date.now() - data.firstAttempt > ATTEMPT_WINDOW_MS) {
      localStorage.removeItem('_auth_attempts');
      return { count: 0, firstAttempt: 0, lockedUntil: 0 };
    }
    return data;
  } catch {
    return { count: 0, firstAttempt: 0, lockedUntil: 0 };
  }
}

function recordFailedAttempt(): { locked: boolean; remainingSeconds: number } {
  const attempts = getLoginAttempts();
  const now = Date.now();
  const updated = {
    count: attempts.count + 1,
    firstAttempt: attempts.firstAttempt || now,
    lockedUntil: attempts.count + 1 >= MAX_ATTEMPTS ? now + LOCKOUT_DURATION_MS : attempts.lockedUntil,
  };
  localStorage.setItem('_auth_attempts', JSON.stringify(updated));

  if (updated.count >= MAX_ATTEMPTS) {
    return { locked: true, remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000) };
  }
  return { locked: false, remainingSeconds: 0 };
}

function clearAttempts() {
  localStorage.removeItem('_auth_attempts');
}

function isLocked(): { locked: boolean; remainingSeconds: number } {
  const attempts = getLoginAttempts();
  if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
    return { locked: true, remainingSeconds: Math.ceil((attempts.lockedUntil - Date.now()) / 1000) };
  }
  if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) {
    clearAttempts();
  }
  return { locked: false, remainingSeconds: 0 };
}

// ═══ COMPOSANT ═══

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lockCountdown, setLockCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Countdown timer pour le lockout ──
  useEffect(() => {
    const lock = isLocked();
    if (lock.locked) {
      setLockCountdown(lock.remainingSeconds);
    }
  }, []);

  useEffect(() => {
    if (lockCountdown > 0) {
      countdownRef.current = setInterval(() => {
        setLockCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            clearAttempts();
            setError(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
    }
  }, [lockCountdown]);

  // ── Login ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Vérifier le lockout
    const lock = isLocked();
    if (lock.locked) {
      setLockCountdown(lock.remainingSeconds);
      setError(`Trop de tentatives. Réessayez dans ${formatCountdown(lock.remainingSeconds)}.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      if (data.user) {
        clearAttempts();
        onAuthSuccess();
      }
    } catch (err: any) {
      // Enregistrer la tentative échouée
      const result = recordFailedAttempt();
      const attempts = getLoginAttempts();
      const remaining = MAX_ATTEMPTS - attempts.count;

      if (result.locked) {
        setLockCountdown(result.remainingSeconds);
        setError(`Compte temporairement verrouillé. Réessayez dans ${formatCountdown(result.remainingSeconds)}.`);
      } else if (remaining <= 2) {
        setError(`Identifiants incorrects. ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''} avant verrouillage.`);
      } else {
        setError('Email ou mot de passe incorrect.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Mot de passe oublié ──
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setMessage('Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.');
      setMode('login');
    } catch (err: any) {
      // Message volontairement vague (ne pas révéler si l'email existe)
      setMessage('Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.');
      setMode('login');
    } finally {
      setLoading(false);
    }
  };

  const isLockedOut = lockCountdown > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#B91C1C]/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#B91C1C] rounded-2xl shadow-lg shadow-[#B91C1C]/25 mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">AuvergneTech</h1>
          <p className="text-slate-400 mt-2">Gestion intégrée pour ascensoristes</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Title */}
          {mode === 'login' && (
            <div className="flex items-center gap-2 mb-6">
              <ShieldCheck className="w-5 h-5 text-[#B91C1C]" />
              <h2 className="text-lg font-semibold text-white">Connexion sécurisée</h2>
            </div>
          )}

          {/* Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
              {message}
            </div>
          )}

          {/* Lockout indicator */}
          {isLockedOut && (
            <div className="mb-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl flex items-center gap-3">
              <Clock className="w-5 h-5 text-orange-400 animate-pulse" />
              <div>
                <p className="text-sm font-semibold text-orange-400">Compte verrouillé temporairement</p>
                <p className="text-xs text-orange-300/70">Réessayez dans {formatCountdown(lockCountdown)}</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    autoComplete="email"
                    disabled={isLockedOut}
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    disabled={isLockedOut}
                    className="w-full pl-11 pr-11 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null); setMessage(null); }}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || isLockedOut}
                className="w-full py-3 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-medium rounded-xl shadow-lg shadow-[#B91C1C]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Connexion…
                  </>
                ) : isLockedOut ? (
                  <>
                    <Clock className="w-5 h-5" />
                    Verrouillé ({formatCountdown(lockCountdown)})
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    Se connecter
                  </>
                )}
              </button>
            </form>
          )}

          {/* Forgot Password Form */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold text-white">Mot de passe oublié</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Entrez votre email pour recevoir un lien de réinitialisation
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    autoComplete="email"
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-medium rounded-xl shadow-lg shadow-[#B91C1C]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Envoi…
                  </>
                ) : (
                  'Envoyer le lien'
                )}
              </button>

              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setMessage(null); }}
                className="w-full py-3 text-slate-400 hover:text-white transition-colors text-sm"
              >
                ← Retour à la connexion
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          © {new Date().getFullYear()} AuvergneTech — Auvergne Ascenseurs
        </p>
      </div>
    </div>
  );
}

// ═══ HELPERS ═══

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}min ${s.toString().padStart(2, '0')}s` : `${s}s`;
}
