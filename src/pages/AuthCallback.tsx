import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Gamepad2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export function AuthCallback(): React.ReactElement {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      try {
        // Give Supabase time to exchange the token from the URL hash
        const { data: { session }, error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error) {
          setErrorMsg(error.message);
          setStatus('error');
          return;
        }

        if (session?.user) {
          setStatus('success');
          setTimeout(() => { if (!cancelled) navigate('/'); }, 1200);
        } else {
          // Token not yet exchanged — poll once more after short delay
          await new Promise((r) => setTimeout(r, 1500));
          if (cancelled) return;
          const { data: { session: session2 }, error: err2 } = await supabase.auth.getSession();
          if (cancelled) return;
          if (session2?.user) {
            setStatus('success');
            setTimeout(() => { if (!cancelled) navigate('/'); }, 800);
          } else {
            setErrorMsg(err2?.message ?? 'Authentication failed. Please try again.');
            setStatus('error');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Unexpected error');
          setStatus('error');
        }
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="gaming-card p-12 text-center max-w-md w-full"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
          <Gamepad2 className="w-8 h-8 text-white" />
        </div>
        <div className="font-orbitron text-xl font-bold gradient-text mb-4">PulsePlay</div>

        {status === 'loading' ? (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Completing Sign In...</h2>
            <p className="text-muted-foreground text-sm">Verifying your session...</p>
          </>
        ) : status === 'success' ? (
          <>
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Welcome!</h2>
            <p className="text-muted-foreground text-sm">Signed in successfully. Redirecting...</p>
          </>
        ) : (
          <>
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Sign In Failed</h2>
            <p className="text-muted-foreground text-sm mb-6">{errorMsg}</p>
            <Button onClick={() => navigate('/signin')} className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
              Back to Sign In
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
}