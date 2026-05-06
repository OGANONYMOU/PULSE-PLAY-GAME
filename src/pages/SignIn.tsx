import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Gamepad2, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AuthSEO } from '@/components/SEO';

const OAUTH_PROVIDERS = [
  {
    id: 'google' as const,
    label: 'Google',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 20 20">
        <path fill="#4285F4" d="M19.6 10.23c0-.82-.1-1.42-.25-2.05H10v3.72h5.5c-.15.96-.74 2.31-2.04 3.22v2.45h3.16c1.89-1.73 2.98-4.3 2.98-7.34z"/>
        <path fill="#34A853" d="M10 20c2.7 0 4.96-.89 6.62-2.42l-3.16-2.45c-.9.6-2.04.96-3.46.96-2.64 0-4.88-1.74-5.68-4.15H1.07v2.52C2.72 17.75 6.09 20 10 20z"/>
        <path fill="#FBBC05" d="M4.32 12.17c-.2-.6-.32-1.24-.32-1.9s.12-1.3.32-1.9V5.85H1.07A9.97 9.97 0 000 10c0 1.61.39 3.14 1.07 4.49l3.25-2.32z"/>
        <path fill="#EA4335" d="M10 3.88c1.88 0 3.13.81 3.85 1.48l2.84-2.76C14.96.99 12.7 0 10 0 6.09 0 2.72 2.25 1.07 5.51l3.25 2.32C5.12 5.62 7.36 3.88 10 3.88z"/>
      </svg>
    ),
    hoverCls: 'hover:border-blue-500/50 hover:bg-blue-500/8',
  },
  {
    id: 'twitter' as const,
    label: 'X / Twitter',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.26 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    hoverCls: 'hover:border-white/40 hover:bg-white/8',
  },
  {
    id: 'discord' as const,
    label: 'Discord',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 71 55" fill="#5865F2">
        <path d="M60.1 4.9C55.6 2.8 50.7 1.3 45.7.4c-.6 1.1-1.3 2.6-1.8 3.8-5.5-.8-11-.8-16.4 0-.5-1.2-1.2-2.7-1.8-3.8C21.3 1.3 16.4 2.8 11.9 4.9 2.6 18.7.1 32.1 1.3 45.4c6.1 4.5 12 7.2 17.8 9 1.4-2 2.6-4 3.7-6.1-2-.7-3.8-1.6-5.6-2.7.5-.3.9-.7 1.4-1 11.6 5.3 24.2 5.3 35.6 0 .5.3.9.7 1.4 1-1.8 1.1-3.6 2-5.6 2.7 1 2.1 2.2 4 3.7 5.9 5.8-1.8 11.6-4.5 17.8-9 1.5-14.7-2.5-28-10.5-40zM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.4 3.2 6.4 7.2-.1 4-2.9 7.2-6.4 7.2zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.4 3.2 6.4 7.2 0 4-2.8 7.2-6.4 7.2z"/>
      </svg>
    ),
    hoverCls: 'hover:border-indigo-500/50 hover:bg-indigo-500/8',
  },
] as const;

export function SignIn(): React.ReactElement {
  const { signIn, signInWithOAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError('');
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      const msg = err.message ?? '';
      if (msg.includes('Invalid login') || msg.includes('invalid_credentials')) { setError('Incorrect email or password.'); }
      else if (msg.includes('Email not confirmed')) { setError('Please confirm your email before signing in.'); }
      else { setError(msg || 'Sign in failed. Please try again.'); }
      setLoading(false);
      return;
    }
    toast.success('Welcome back!');
    navigate('/');
  };

  const handleOAuth = async (provider: 'google' | 'twitter' | 'discord' | 'facebook') => {
    setOauthLoading(provider);
    const { error: err } = await signInWithOAuth(provider);
    if (err) {
      toast.error(err.message || `${provider} sign in failed.`);
      setOauthLoading(null);
    }
    // Redirect happens automatically — no need to clear loading
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-10 overflow-x-hidden">
      <AuthSEO mode="signin" />
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 mb-4">
            <Gamepad2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-orbitron text-2xl font-bold mb-1">
            Welcome back to <span className="gradient-text">PulsePlay</span>
          </h1>
          <p className="text-muted-foreground text-sm">Sign in to your account</p>
        </div>

        {/* OAuth buttons */}
        <div className="space-y-2">
          {OAUTH_PROVIDERS.map(p => (
            <button key={p.id}
              onClick={() => handleOAuth(p.id)}
              disabled={!!oauthLoading || loading}
              className={`w-full flex items-center justify-center gap-3 h-10 rounded-xl border border-white/10 bg-white/5 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${p.hoverCls}`}>
              {oauthLoading === p.id
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : p.icon}
              <span>Continue with {p.label}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-xs text-muted-foreground">or continue with email</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        {/* Email form */}
        <div className="gaming-card p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email" value={email} placeholder="you@example.com"
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="pl-10" autoComplete="email" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showPw ? 'text' : 'password'} value={password} placeholder="••••••••"
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="pl-10 pr-10" autoComplete="current-password" />
              <button type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                onClick={() => setShowPw(p => !p)}>
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={loading || !!oauthLoading}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white h-10">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Signing In…</> : 'Sign In'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/register" className="text-cyan-400 hover:text-cyan-300 font-medium">Sign up free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}