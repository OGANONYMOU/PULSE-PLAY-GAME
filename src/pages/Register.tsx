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
import { AuthSEO } from '@/components/SEO';

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
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]           = useState<FormData>({
    first_name: '', last_name: '', username: '', email: '', phone: '', password: '', confirm_password: '',
  });
  const [errors, setErrors]       = useState<Errors>({});
  const [loading, setLoading]     = useState(false);
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
      <AuthSEO mode="register" />
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 mb-4">
            <Gamepad2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-orbitron text-2xl font-bold mb-1">
            Join <span className="gradient-text">PulsePlay</span>
          </h1>
          <p className="text-muted-foreground text-sm">Create your free gaming account</p>
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

          <Button onClick={handleSubmit} disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white h-10 mt-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating Account…</> : 'Create Account →'}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            By signing up you agree to our{' '}
            <Link to="/about" className="text-cyan-400 hover:underline">Terms of Service</Link> and{' '}
            <Link to="/about" className="text-cyan-400 hover:underline">Privacy Policy</Link>.
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