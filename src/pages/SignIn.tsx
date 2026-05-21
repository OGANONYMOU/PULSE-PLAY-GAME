import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Gamepad2, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AuthSEO } from '@/components/SEO';

export function SignIn(): React.ReactElement {
  const { signIn, signInWithOAuth, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

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

        <div className="gaming-card p-6 space-y-4">
          <Button
            onClick={async () => {
              setError('');
              setOauthLoading(true);
              const { error: err } = await signInWithOAuth('google');
              if (err) {
                setError(err.message || 'Unable to sign in with Google. Please try again.');
                setOauthLoading(false);
              }
            }}
            disabled={oauthLoading}
            className="w-full h-11 flex items-center justify-center gap-2 border border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <span className="inline-flex h-5 w-5 rounded-full bg-white text-black font-bold items-center justify-center text-[10px]">G</span>
            {oauthLoading ? 'Opening Google…' : 'Continue with Google'}
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase tracking-[0.24em]">
            <span className="h-px flex-1 bg-white/10" />
            <span>or use email</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

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

          <Button onClick={handleSubmit} disabled={loading}
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