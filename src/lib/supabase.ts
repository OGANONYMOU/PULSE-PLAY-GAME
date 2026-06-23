import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// ── Environment variable validation ────────────────────────────────────────────
// On Vercel, env vars must be added in the Vercel dashboard under
// Settings → Environment Variables as VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
// .env.local is gitignored and NOT deployed — it is only for local development.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key || url === 'undefined' || key === 'undefined') {
  const isProduction = import.meta.env.PROD;
  const msg = isProduction
    ? '⚠️ PulsePlay: Missing Supabase credentials. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Vercel project environment variables (Settings → Environment Variables).'
    : '⚠️ PulsePlay: Missing Supabase credentials. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.';

  console.error(msg);

  if (typeof document !== 'undefined') {
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;
        background:#0a0a12;color:#fff;font-family:monospace;padding:2rem;text-align:center;gap:1.5rem;">
        <div style="font-size:2.5rem">⚠️</div>
        <h1 style="font-size:1.5rem;color:#00d9ff;margin:0">Configuration Missing</h1>
        <p style="color:#aaa;max-width:520px;line-height:1.7;margin:0">
          ${isProduction
            ? '<strong style="color:#fff">VITE_SUPABASE_URL</strong> and <strong style="color:#fff">VITE_SUPABASE_ANON_KEY</strong> are not set.<br/><br/>Go to your Vercel project → <code style="color:#a78bfa">Settings → Environment Variables</code> and add both keys. Then redeploy.'
            : '<strong style="color:#fff">VITE_SUPABASE_URL</strong> and <strong style="color:#fff">VITE_SUPABASE_ANON_KEY</strong> are not set.<br/>Add them to your <code style="color:#a78bfa">.env.local</code> file and restart.'
          }
        </p>
      </div>`;
  }
  throw new Error(msg);
}

export const supabase = createClient<Database>(
  url,
  key,
  {
    auth: {
      autoRefreshToken:   true,
      persistSession:     true,
      // Required for OAuth PKCE flow — reads the ?code= param on the callback URL
      detectSessionInUrl: true,
      // Stable storage key — must not change between deploys
      storageKey:         'pulseplay-auth',
      // flowType pkce is the secure default for SPAs
      flowType:           'pkce',
    },
  },
);