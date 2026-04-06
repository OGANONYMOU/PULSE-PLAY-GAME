import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Gamepad2, User, Mail, Lock, Phone,
  AlertCircle, CheckCircle, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  },
  {
    id: 'twitter' as const,
    label: 'X / Twitter',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.26 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    id: 'discord' as const,
    label: 'Discord',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 71 55" fill="#5865F2">
        <path d="M60.1 4.9C55.6 2.8 50.7 1.3 45.7.4c-.6 1.1-1.3 2.6-1.8 3.8-5.5-.8-11-.8-16.4 0-.5-1.2-1.2-2.7-1.8-3.8C21.3 1.3 16.4 2.8 11.9 4.9 2.6 18.7.1 32.1 1.3 45.4c6.1 4.5 12 7.2 17.8 9 1.4-2 2.6-4 3.7-6.1-2-.7-3.8-1.6-5.6-2.7.5-.3.9-.7 1.4-1 11.6 5.3 24.2 5.3 35.6 0 .5.3.9.7 1.4 1-1.8 1.1-3.6 2-5.6 2.7 1 2.1 2.2 4 3.7 5.9 5.8-1.8 11.6-4.5 17.8-9 1.5-14.7-2.5-28-10.5-40zM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.4 3.2 6.4 7.2-.1 4-2.9 7.2-6.4 7.2zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.4 3.2 6.4 7.2 0 4-2.8 7.2-6.4 7.2z"/>
      </svg>
    ),
  },
] as const;

type FormData = {
  first_name: string; last_name: string; username: string;
  email: string; phone: string; password: string; confirm_password: string;
};
type Errors = Partial<Record<keyof FormData, string>>;

function pwStrength(pw: string): { label: string; color: string; pct: string } {
  if (!pw) return { label: '', color: 'bg-muted', pct: '0%' };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { label: 'Weak',   color: 'bg-red-500',    pct: '25%' };
  if (s === 2) return { label: 'Fair',  color: 'bg-yellow-500', pct: '50%' };
  if (s === 3) return { label: 'Good',  color: 'bg-blue-500',   pct: '75%' };
  return           { label: 'Strong', color: 'bg-green-500',   pct: '100%' };
}

export function Register(): React.ReactElement {
  const { signUp, signInWithOAuth } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]           = useState<FormData>({
    first_name: '', last_name: '', username: '', email: '', phone: '', password: '', confirm_password: '',
  });
  const [errors, setErrors]       = useState<Errors>({});
  const [loading, setLoading]     = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [showPw, setShowPw]       = useState(false);
  const [success, setSuccess]     = useState(false);

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const validate = (): boolean => {
    const e: Errors = {};
    if (!form.first_name.trim())  e.first_name = 'First name is required.';
    if (!form.username.trim())    e.username = 'Username is required.';
    else if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username))
      e.username = '3–20 chars, letters/numbers/underscore only.';
    if (!form.email.trim())       e.email = 'Email is required.';
    if (!form.password)           e.password = 'Password is required.';
    else if (form.password.length < 8) e.password = 'Minimum 8 characters.';
    if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    const { error } = await signUp(form.email, form.password, {
      username: form.username,
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone,
    });
    if (error) {
      const msg = error.message ?? '';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setErrors({ email: 'Email is already registered.' });
      } else if (msg.includes('Username')) {
        setErrors({ username: msg });
      } else {
        toast.error(msg || 'Registration failed. Please try again.');
      }
      setLoading(false);
      return;
    }
    setSuccess(true);
    toast.success('Account created! Check your email to confirm.');
    setLoading(false);
  };

  const handleOAuth = async (provider: 'google' | 'twitter' | 'discord' | 'facebook') => {
    setOauthLoading(provider);
    const { error } = await signInWithOAuth(provider);
    if (error) {
      toast.error(error.message || `${provider} sign up failed.`);
      setOauthLoading(null);
    }
  };

  const strength = pwStrength(form.password);

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 mb-6">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="font-orbitron text-2xl font-bold mb-3 text-white">Check your email</h2>
          <p className="text-muted-foreground mb-6">
            We sent a confirmation link to <strong className="text-white">{form.email}</strong>.
            Click it to activate your account.
          </p>
          <Button onClick={() => navigate('/signin')} className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  const err = (k: keyof FormData) => errors[k] ? (
    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />{errors[k]}
    </p>
  ) : null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-10 overflow-x-hidden">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 mb-4">
            <Gamepad2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-orbitron text-2xl font-bold mb-1">
            Join <span className="gradient-text">PulsePay</span>
          </h1>
          <p className="text-muted-foreground text-sm">Create your free gaming account</p>
        </div>

        {/* OAuth */}
        <div className="space-y-2">
          {OAUTH_PROVIDERS.map(p => (
            <button key={p.id}
              onClick={() => handleOAuth(p.id)}
              disabled={!!oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 h-10 rounded-xl border border-white/10 bg-white/5 text-sm font-medium transition-all disabled:opacity-50 hover:bg-white/8 hover:border-white/20">
              {oauthLoading === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : p.icon}
              <span>Continue with {p.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-xs text-muted-foreground">or sign up with email</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        {/* Form */}
        <div className="gaming-card p-6 space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">First Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={form.first_name} onChange={set('first_name')} placeholder="John" className="pl-9 h-9" />
              </div>
              {err('first_name')}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Last Name</label>
              <Input value={form.last_name} onChange={set('last_name')} placeholder="Doe" className="h-9" />
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Gaming Username *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
              <Input value={form.username} onChange={set('username')} placeholder="xX_Legend_Xx"
                className="pl-8 h-9" autoComplete="username" />
            </div>
            {err('username')}
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Email *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com"
                className="pl-9 h-9" autoComplete="email" />
            </div>
            {err('email')}
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Phone (optional)</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input type="tel" value={form.phone} onChange={set('phone')} placeholder="+234 8012345678"
                className="pl-9 h-9" autoComplete="tel" />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Password *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')}
                placeholder="Min. 8 characters" className="pl-9 pr-9 h-9" autoComplete="new-password" />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {form.password && (
              <div className="mt-1.5">
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Strength</span>
                  <span className="text-[10px] font-medium">{strength.label}</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: strength.pct }} />
                </div>
              </div>
            )}
            {err('password')}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Confirm Password *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input type={showPw ? 'text' : 'password'} value={form.confirm_password} onChange={set('confirm_password')}
                placeholder="Re-enter password" className="pl-9 h-9" autoComplete="new-password" />
            </div>
            {err('confirm_password')}
          </div>

          <Button onClick={handleSubmit} disabled={loading || !!oauthLoading}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white h-10 mt-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating Account…</> : 'Create Account →'}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            By signing up you agree to our{' '}
            <a href="#" className="text-cyan-400 hover:underline">Terms of Service</a> and{' '}
            <a href="#" className="text-cyan-400 hover:underline">Privacy Policy</a>.
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/signin" className="text-cyan-400 hover:text-cyan-300 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}