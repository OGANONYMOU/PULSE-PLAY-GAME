import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

// Verify the caller is a real authenticated Supabase user
async function getCallerUserId(req: VercelRequest): Promise<string | null> {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const callerId = await getCallerUserId(req);
  if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

  const { id, email, username, first_name, last_name, phone } = req.body as {
    id: string;
    email: string;
    username: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  };

  // Caller can only create their own profile
  if (callerId !== id) return res.status(403).json({ error: 'Forbidden' });

  if (!id || !email || !username) {
    return res.status(400).json({ error: 'id, email, and username are required' });
  }

  const { error } = await supabaseAdmin.from('profiles').upsert({
    id,
    email,
    username,
    first_name:  first_name  ?? null,
    last_name:   last_name   ?? null,
    phone:       phone       ?? null,
    role:        'USER',
    is_banned:   false,
    created_at:  new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  }, { onConflict: 'id' });

  if (error) {
    console.error('[create-profile]', error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}