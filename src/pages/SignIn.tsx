import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { Eye, EyeOff, Gamepad2, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function SignIn(): React.ReactElement {
  const { signIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      const msg = err.message ?? '';
      if (msg.includes('Invalid login') || msg.includes('invalid_credentials')) {
        setError('Incorrect email or password.');
      } else if (msg.includes('Email not confirmed')) {
        setError('Please confirm your email before signing in.');
      } else {
        setError(msg || 'Sign in failed. Please try again.');
      }
      setLoading(false);
      return;
    }
    toast.success('Welcome back!');
    navigate('/');
    setLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const btnLabel = loading ? 'Signing In...' : 'Sign In';

  // Already signed in — bounce to home immediately
  if (isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 mb-4">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-orbitron text-3xl font-bold mb-2">
            Welcome Back to <span className="gradient-text">PulsePay</span>
          </h1>
          <p className="text-muted-foreground">Sign in to your account</p>
        </div>

        <div className="gaming-card p-8 space-y-5">
          {error ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKey}
                placeholder="you@example.com"
                className="pl-10 bg-muted/50"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Your password"
                className="pl-10 pr-10 bg-muted/50"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 font-orbitron h-12 text-base"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {btnLabel}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-cyan-400 hover:underline font-medium">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}