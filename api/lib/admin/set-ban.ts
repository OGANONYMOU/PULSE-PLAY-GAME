import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

const PRIMARY_ADMIN_EMAIL = 'adegbesanadebola@outlook.com';

async function getCallerProfile(req: VercelRequest) {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error: uErr } = await supabaseAdmin.auth.getUser(token);
  if (uErr || !user) return null;
  const { data, error: pErr } = await supabaseAdmin
    .from('profiles').select('id, role, email').eq('id', user.id).single();
  if (pErr || !data) return null;
  return data as { id: string; role: string; email: string };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const caller = await getCallerProfile(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });
  if (caller.role !== 'ADMIN' && caller.role !== 'MODERATOR') {
    return res.status(403).json({ error: 'Admin or Moderator only' });
  }

  const { userId, is_banned } = req.body as { userId: string; is_banned: boolean };
  if (!userId || typeof is_banned !== 'boolean') {
    return res.status(400).json({ error: 'userId and is_banned (boolean) are required' });
  }

  // Prevent self-ban and primary admin ban
  if (userId === caller.id) return res.status(403).json({ error: 'Cannot ban yourself' });
  const { data: target } = await supabaseAdmin
    .from('profiles').select('email').eq('id', userId).single();
  if (target?.email === PRIMARY_ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Cannot ban primary admin' });
  }

  const { error } = await supabaseAdmin
    .from('profiles').update({ is_banned, updated_at: new Date().toISOString() }).eq('id', userId);
  if (error) {
    console.error('[set-ban]', error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}