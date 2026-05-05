import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Gamepad2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

/**
 * AuthCallback — handles the OAuth/magic-link redirect from Supabase.
 *
 * Supabase PKCE flow:
 *  1. User clicks OAuth → redirected to provider
 *  2. Provider redirects to /auth/callback?code=xxx (or #access_token=xxx for implicit)
 *  3. Supabase client exchanges the code for a session
 *  4. We redirect to the home page
 *
 * Why the previous version was broken on Vercel:
 *  - It called getSession() immediately before the code exchange was complete
 *  - It didn't check for error params in the URL (provider can return error=access_denied etc)
 *  - With PKCE flow, you must call exchangeCodeForSession() explicitly
 */
export function AuthCallback(): React.ReactElement {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));

        // ── Check for error from the OAuth provider ──────────────────────────
        const oauthError = params.get('error') || hashParams.get('error');
        const oauthErrorDesc = params.get('error_description') || hashParams.get('error_description');
        if (oauthError) {
          const msg = oauthErrorDesc
            ? decodeURIComponent(oauthErrorDesc.replace(/\+/g, ' '))
            : oauthError;
          if (!cancelled) { setErrorMsg(msg); setStatus('error'); }
          return;
        }

        // ── PKCE flow: exchange the code for a session ───────────────────────
        const code = params.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (cancelled) return;
          if (error) { setErrorMsg(error.message); setStatus('error'); return; }
          if (data.session) {
            setStatus('success');
            setTimeout(() => { if (!cancelled) navigate('/', { replace: true }); }, 1000);
            return;
          }
        }

        // ── Implicit flow fallback: token already in hash ────────────────────
        const accessToken = hashParams.get('access_token');
        if (accessToken) {
          // With detectSessionInUrl:true, getSession() picks this up automatically
          const { data, error } = await supabase.auth.getSession();
          if (cancelled) return;
          if (error) { setErrorMsg(error.message); setStatus('error'); return; }
          if (data.session) {
            setStatus('success');
            setTimeout(() => { if (!cancelled) navigate('/', { replace: true }); }, 1000);
            return;
          }
        }

        // ── No code or token — may already be signed in (e.g. email confirm) ─
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (cancelled) return;
        if (sessionErr) { setErrorMsg(sessionErr.message); setStatus('error'); return; }
        if (session) {
          setStatus('success');
          setTimeout(() => { if (!cancelled) navigate('/', { replace: true }); }, 1000);
          return;
        }

        // ── Nothing worked ───────────────────────────────────────────────────
        setErrorMsg('Authentication could not be completed. Please try signing in again.');
        setStatus('error');

      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.');
          setStatus('error');
        }
      }
    };

    handleCallback();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="gaming-card p-8 sm:p-12 text-center max-w-md w-full"
      >
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center mx-auto mb-5">
          <Gamepad2 className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
        </div>
        <div className="font-orbitron text-lg sm:text-xl font-bold gradient-text mb-5">PulsePlay</div>

        {status === 'loading' && (
          <>
            <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-cyan-400 mx-auto mb-4" />
            <h2 className="text-lg sm:text-xl font-bold mb-2">Completing Sign In...</h2>
            <p className="text-muted-foreground text-sm">Verifying your session...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-green-400 mx-auto mb-4" />
            <h2 className="text-lg sm:text-xl font-bold mb-2">Welcome!</h2>
            <p className="text-muted-foreground text-sm">Signed in successfully. Redirecting...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-7 h-7 sm:w-8 sm:h-8 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg sm:text-xl font-bold mb-2">Sign In Failed</h2>
            <p className="text-muted-foreground text-sm mb-6 break-words">{errorMsg}</p>
            <Button
              onClick={() => navigate('/signin', { replace: true })}
              className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white"
            >
              Back to Sign In
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
}