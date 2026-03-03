import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Gamepad2, User, Mail, Lock, Phone, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
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

type FieldError = Partial<Record<keyof FormData, string>>;

function validate(form: FormData): FieldError {
  const errors: FieldError = {};
  if (!form.first_name.trim()) errors.first_name = 'First name is required.';
  if (!form.last_name.trim()) errors.last_name = 'Last name is required.';
  if (!form.username.trim()) errors.username = 'Username is required.';
  else if (form.username.length < 3) errors.username = 'Username must be at least 3 characters.';
  else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) errors.username = 'Only letters, numbers and underscores.';
  if (!form.email.trim()) errors.email = 'Email is required.';
  else if (!/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Enter a valid email address.';
  if (!form.password) errors.password = 'Password is required.';
  else if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.';
  if (form.password !== form.confirm_password) errors.confirm_password = 'Passwords do not match.';
  return errors;
}

const passwordStrength = (pw: string): { label: string; color: string; width: string } => {
  if (!pw) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: '25%' };
  if (score === 2) return { label: 'Fair', color: 'bg-yellow-500', width: '50%' };
  if (score === 3) return { label: 'Good', color: 'bg-blue-500', width: '75%' };
  return { label: 'Strong', color: 'bg-green-500', width: '100%' };
};

export function Register(): React.ReactElement {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormData>({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });

  const [errors, setErrors] = useState<FieldError>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(form.email, form.password, {
      username: form.username.toLowerCase().trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone.trim(),
    });

    if (error) {
      if (error.message.includes('already registered')) {
        setErrors({ email: 'This email is already registered.' });
      } else {
        toast.error(error.message);
      }
      setIsLoading(false);
      return;
    }

    setSuccess(true);
    setIsLoading(false);
  };

  const strength = passwordStrength(form.password);

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
          <h2 className="font-orbitron text-2xl font-bold mb-3">Account Created!</h2>
          <p className="text-muted-foreground mb-2">
            Welcome to PulsePay, <span className="text-cyan-400 font-medium">{form.username}</span>!
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Check your email <span className="text-foreground font-medium">{form.email}</span> and click the confirmation link before signing in.
          </p>
          <Button
            onClick={() => navigate('/signin')}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 font-orbitron"
          >
            Go to Sign In
          </Button>
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
          transition={{ duration: 0.5 }}
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
          transition={{ duration: 0.5, delay: 0.1 }}
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
              <Input
                value={form.username}
                onChange={set('username')}
                placeholder="gamertag"
                className={'pl-8 bg-muted/50' + (errors.username ? ' border-destructive' : '')}
              />
            </div>
            {errors.username && <p className="text-xs text-destructive mt-1">{errors.username}</p>}
            {!errors.username && form.username && (
              <p className="text-xs text-muted-foreground mt-1">Your public display name</p>
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
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone Number <span className="text-muted-foreground/60">(optional)</span></label>
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
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder="Min 8 characters"
                className={'pl-10 pr-10 bg-muted/50' + (errors.password ? ' border-destructive' : '')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.password && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Password strength</span>
                  <span className="text-xs font-medium">{strength.label}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={'h-full rounded-full transition-all ' + strength.color} style={{ width: strength.width }} />
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

          <p className="text-xs text-muted-foreground">
            By creating an account you agree to our{' '}
            <span className="text-cyan-400 cursor-pointer hover:underline">Terms of Service</span>
            {' '}and{' '}
            <span className="text-cyan-400 cursor-pointer hover:underline">Privacy Policy</span>.
          </p>

          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 font-orbitron h-12 text-base"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/signin" className="text-cyan-400 hover:underline font-medium">
              Sign In
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}