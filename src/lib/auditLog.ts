/**
 * Audit log writer — writes to audit_log table for every sensitive action.
 * Silently no-ops if table doesn't exist yet (graceful degradation).
 */
import { supabase } from '@/lib/supabase';
import { getFlag, FLAG_KEYS } from '@/lib/featureFlags';

export type AuditAction =
  | 'tournament.join'
  | 'tournament.leave'
  | 'tournament.create'
  | 'tournament.update'
  | 'tournament.delete'
  | 'tournament.status_change'
  | 'match.start'
  | 'match.status_change'
  | 'dispute.open'
  | 'dispute.resolve'
  | 'dispute.cancel'
  | 'evidence.upload'
  | 'user.ban'
  | 'user.unban'
  | 'user.role_change'
  | 'game.create'
  | 'game.update'
  | 'game.delete'
  | 'announcement.create'
  | 'post.delete';

export interface AuditEntry {
  actor_id?: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id?: string | null;
  data?: Record<string, unknown>;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  if (!getFlag(FLAG_KEYS.USE_AUDIT_LOG)) return;
  try {
    await supabase.from('audit_log').insert({
      actor_id    : entry.actor_id ?? null,
      action      : entry.action,
      entity_type : entry.entity_type,
      entity_id   : entry.entity_id ?? null,
      data        : entry.data ?? {},
    } as never);
  } catch {
    // audit failure must never break the main flow
  }
}

export async function writeOutboxEvent(
  topic: string, key: string | null, payload: Record<string, unknown>
): Promise<void> {
  if (!getFlag(FLAG_KEYS.USE_AUDIT_LOG)) return;
  try {
    await supabase.from('outbox_events').insert({ topic, key, payload } as never);
  } catch { /* noop */ }
}
