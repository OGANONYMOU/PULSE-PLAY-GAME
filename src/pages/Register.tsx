import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, Gamepad2, User, Mail, Lock,
  Phone, AlertCircle, CheckCircle, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type FormData = {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
};

type FieldErrors = Partial<Record<keyof FormData, string>>;

function getStrength(pw: string): { label: string; color: string; pct: string } {
  if (!pw) return { label: '', color: '', pct: '0%' };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { label: 'Weak', color: 'bg-red-500', pct: '25%' };
  if (s === 2) return { label: 'Fair', color: 'bg-yellow-500', pct: '50%' };
  if (s === 3) return { label: 'Good', color: 'bg-blue-500', pct: '75%' };
  return { label: 'Strong', color: 'bg-green-500', pct: '100%' };
}

// Allows letters, numbers, underscores, hyphens, dots, and common special chars
// but blocks SQL injection and path characters
function validateUsername(u: string): string | null {
  if (!u.trim()) return 'Username is required.';
  if (u.length < 3) return 'Username must be at least 3 characters.';
  if (u.length > 30) return 'Username must be 30 characters or fewer.';
  if (/['"`;/\\<>]/.test(u)) return 'Username cannot contain quotes, slashes or angle brackets.';
  if (/\s/.test(u)) return 'Username cannot contain spaces.';
  return null;
}

export function Register(): React.ReactElement {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormData>({
    first_name: '', last_name: '', username: '',
    email: '', phone: '', password: '', confirm_password: '',
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registeredUsername, setRegisteredUsername] = useState('');

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    setCheckingUsername(true);
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username.trim())
      .maybeSingle();
    setCheckingUsername(false);
    return !data;
  };

  const handleSubmit = async () => {
    const newErrors: FieldErrors = {};

    if (!form.first_name.trim()) newErrors.first_name = 'First name is required.';
    if (!form.last_name.trim()) newErrors.last_name = 'Last name is required.';

    const usernameError = validateUsername(form.username);
    if (usernameError) newErrors.username = usernameError;

    if (!form.email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = 'Enter a valid email address.';
    }

    if (!form.password) {
      newErrors.password = 'Password is required.';
    } else if (form.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }

    if (form.password !== form.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    // Check username uniqueness
    const available = await checkUsernameAvailable(form.username);
    if (!available) {
      setErrors({ username: 'This username is already taken.' });
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(form.email.trim(), form.password, {
      username: form.username.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone.trim(),
    });

    if (error) {
      const msg = error.message ?? '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        setErrors({ email: 'An account with this email already exists.' });
      } else if (msg.toLowerCase().includes('password')) {
        setErrors({ password: msg });
      } else {
        toast.error(msg || 'Registration failed. Please try again.');
      }
      setIsLoading(false);
      return;
    }

    setRegisteredEmail(form.email.trim());
    setRegisteredUsername(form.username.trim());
    setSuccess(true);
    setIsLoading(false);
  };

  const strength = getStrength(form.password);

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="gaming-card p-10 max-w-md w-full text-center"
        >
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="font-orbitron text-2xl font-bold mb-3">Welcome, {registeredUsername}!</h2>
          <p className="text-muted-foreground text-sm mb-2">
            Your account has been created successfully.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            A confirmation email was sent to{' '}
            <span className="text-cyan-400 font-medium">{registeredEmail}</span>.
            If you don't see it, check your spam folder — or sign in directly if email confirmation is disabled.
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => navigate('/signin')}
              className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 font-orbitron"
            >
              Sign In Now
            </Button>
            <Button variant="ghost" onClick={() => navigate('/')} className="w-full">
              Back to Home
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 mb-4">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-orbitron text-3xl font-bold mb-2">
            Join <span className="gradient-text">PulsePay</span>
          </h1>
          <p className="text-muted-foreground">Create your gaming account</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="gaming-card p-8 space-y-5"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">First Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={form.first_name}
                  onChange={set('first_name')}
                  placeholder="John"
                  className={'pl-10 bg-muted/50' + (errors.first_name ? ' border-destructive' : '')}
                />
              </div>
              {errors.first_name && <p className="text-xs text-destructive mt-1">{errors.first_name}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Last Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={form.last_name}
                  onChange={set('last_name')}
                  placeholder="Doe"
                  className={'pl-10 bg-muted/50' + (errors.last_name ? ' border-destructive' : '')}
                />
              </div>
              {errors.last_name && <p className="text-xs text-destructive mt-1">{errors.last_name}</p>}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Username *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">@</span>
              {checkingUsername && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
              <Input
                value={form.username}
                onChange={set('username')}
                placeholder="your_gamertag"
                className={'pl-8 bg-muted/50' + (errors.username ? ' border-destructive' : '')}
              />
            </div>
            {errors.username && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.username}
              </p>
            )}
            {!errors.username && (
              <p className="text-xs text-muted-foreground mt-1">Letters, numbers, underscores, hyphens, dots allowed. No spaces.</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email Address *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="you@example.com"
                className={'pl-10 bg-muted/50' + (errors.email ? ' border-destructive' : '')}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Phone <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                placeholder="+234 800 000 0000"
                className="pl-10 bg-muted/50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Password *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder="Min 8 characters"
                className={'pl-10 pr-10 bg-muted/50' + (errors.password ? ' border-destructive' : '')}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.password && (
              <div className="mt-2">
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Strength</span>
                  <span className="text-xs font-medium">{strength.label}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={'h-full rounded-full transition-all ' + strength.color} style={{ width: strength.pct }} />
                </div>
              </div>
            )}
            {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Confirm Password *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={form.confirm_password}
                onChange={set('confirm_password')}
                placeholder="Repeat your password"
                className={'pl-10 pr-10 bg-muted/50' + (errors.confirm_password ? ' border-destructive' : '')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirm_password && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.confirm_password}
              </p>
            )}
            {!errors.confirm_password && form.confirm_password && form.password === form.confirm_password && (
              <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Passwords match
              </p>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isLoading || checkingUsername}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 font-orbitron h-12 text-base"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Account...
              </span>
            ) : 'Create Account'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/signin" className="text-cyan-400 hover:underline font-medium">Sign In</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}