import { supabase } from '@/lib/supabase';
import type { Clip } from '@/components/community/ClipCard';

const BUCKET = 'clips';
export const STORAGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;

export function getClipUrl(objectKey: string): string {
  return `${STORAGE_BASE}/${objectKey}`;
}

export type UploadProgress = { loaded: number; total: number; pct: number };

export async function uploadClipFile(
  userId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'mp4';
  const key = `${userId}/${Date.now()}.${ext}`;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({ loaded: e.loaded, total: e.total, pct: Math.round((e.loaded / e.total) * 100) });
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    });
    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.open('POST', `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`);
    xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.send(file);
  });

  return key;
}

export async function uploadThumbnail(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const key = `${userId}/thumb_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(key, file, { upsert: false });
  if (error) throw error;
  return key;
}

export async function createClip(params: {
  userId: string;
  title: string;
  description: string;
  objectKey: string;
  thumbnailKey: string | null;
  durationSecs: number;
  gameId: string | null;
  tournamentId: string | null;
}): Promise<string> {
  const { data, error } = await supabase.from('clips').insert({
    user_id:       params.userId,
    title:         params.title,
    description:   params.description || null,
    object_key:    params.objectKey,
    thumbnail_key: params.thumbnailKey,
    duration_secs: params.durationSecs,
    game_id:       params.gameId,
    tournament_id: params.tournamentId,
    week_start:    getWeekStart(),
  } as never).select('id').single();

  if (error) throw error;
  return (data as { id: string }).id;
}

export type ClipQuery = {
  tab: 'this-week' | 'previous' | 'all-time';
  limit?: number;
  offset?: number;
};

export async function fetchClips(query: ClipQuery): Promise<Clip[]> {
  let q = supabase
    .from('clips')
    .select('*, games(name, icon), profiles(username, avatar_url), tournaments(name)')
    .order('likes_count', { ascending: false })
    .limit(query.limit ?? 30);

  if (query.tab === 'this-week') {
    q = q.gte('week_start', getWeekStart());
  } else if (query.tab === 'previous') {
    q = q.lt('week_start', getWeekStart()).gte('week_start', getPrevWeekStart());
  }

  if (query.offset) q = q.range(query.offset, query.offset + (query.limit ?? 30) - 1);

  const { data, error } = await q;
  if (error) throw error;
  return (data as Clip[]) ?? [];
}

export async function toggleLike(clipId: string, userId: string, currentlyLiked: boolean): Promise<void> {
  if (currentlyLiked) {
    await supabase.from('clip_interactions')
      .delete().eq('clip_id', clipId).eq('user_id', userId).eq('type', 'like');
    await (supabase as any).rpc('increment_clip_likes', { clip_id: clipId, delta: -1 });
  } else {
    await supabase.from('clip_interactions')
      .insert({ clip_id: clipId, user_id: userId, type: 'like' } as never);
    await (supabase as any).rpc('increment_clip_likes', { clip_id: clipId, delta: 1 });
  }
}

export async function fetchUserLikes(userId: string, clipIds: string[]): Promise<Set<string>> {
  if (!clipIds.length) return new Set();
  const { data } = await supabase
    .from('clip_interactions')
    .select('clip_id')
    .eq('user_id', userId)
    .eq('type', 'like')
    .in('clip_id', clipIds);
  return new Set((data as Array<{ clip_id: string }> ?? []).map(r => r.clip_id));
}

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

function getPrevWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}
