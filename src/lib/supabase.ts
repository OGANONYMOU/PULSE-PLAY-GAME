import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Surface a readable banner instead of a cryptic white screen
if (!url || !key) {
  const msg =
    '⚠️ PulsePlay: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in your .env file. ' +
    'Check the README for setup instructions.';
  console.error(msg);
  // Inject visible DOM error so the screen is never blank
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;
        background:#0a0a12;color:#fff;font-family:monospace;padding:2rem;text-align:center;gap:1.5rem;">
        <div style="font-size:2.5rem">⚠️</div>
        <h1 style="font-size:1.5rem;color:#00d9ff;margin:0">Configuration Missing</h1>
        <p style="color:#aaa;max-width:480px;line-height:1.6;margin:0">
          <strong style="color:#fff">VITE_SUPABASE_URL</strong> and
          <strong style="color:#fff">VITE_SUPABASE_ANON_KEY</strong>
          are not set.<br/>Add them to your <code style="color:#a78bfa">.env</code> file and restart the dev server.
        </p>
      </div>`;
  }
}

export const supabase = createClient<Database>(
  url  ?? 'https://placeholder.supabase.co',
  key  ?? 'placeholder-key',
  {
    auth: {
      autoRefreshToken:  true,
      persistSession:    true,
      detectSessionInUrl: true,
      storageKey:        'pulseplay-auth',
    },
  },
);