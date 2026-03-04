import { createClient } from '@supabase/supabase-js';

const url  = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const key  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!url || !key) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
}

// Service-role client — bypasses RLS. Never expose this to the browser.
export const supabaseAdmin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});