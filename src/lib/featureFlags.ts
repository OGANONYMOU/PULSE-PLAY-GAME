/**
 * Feature flags — safe rollout switches.
 * Toggle via localStorage (Admin → Settings → Feature Flags).
 * Defaults are all-on for new installs.
 */

export const FLAG_KEYS = {
  USE_PARTICIPANT_MODEL : 'ff_use_participant_model',
  USE_EVIDENCE_V1       : 'ff_use_evidence_v1',
  USE_AUDIT_LOG         : 'ff_use_audit_log',
  USE_MATCHES           : 'ff_use_matches',
  USE_DISPUTES          : 'ff_use_disputes',
  USE_CLUBS             : 'ff_use_clubs',
  USE_PULSEPOINTS       : 'ff_use_pulsepoints',
  USE_CLIPS             : 'ff_use_clips',
  USE_LEADERBOARDS      : 'ff_use_leaderboards',
  USE_GAMERCRED         : 'ff_use_gamercred',
} as const;

export type FlagKey = typeof FLAG_KEYS[keyof typeof FLAG_KEYS];

const DEFAULTS: Record<FlagKey, boolean> = {
  ff_use_participant_model : true,
  ff_use_evidence_v1       : true,
  ff_use_audit_log         : true,
  ff_use_matches           : true,
  ff_use_disputes          : true,
  ff_use_clubs             : true,
  ff_use_pulsepoints       : true,
  ff_use_clips             : true,
  ff_use_leaderboards      : true,
  ff_use_gamercred         : true,
};

export function getFlag(key: FlagKey): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return DEFAULTS[key];
    return raw === 'true';
  } catch { return DEFAULTS[key]; }
}

export function setFlag(key: FlagKey, value: boolean): void {
  try { localStorage.setItem(key, String(value)); } catch { /* noop */ }
}

export function getAllFlags(): Record<FlagKey, boolean> {
  return Object.fromEntries(
    Object.values(FLAG_KEYS).map(k => [k, getFlag(k)])
  ) as Record<FlagKey, boolean>;
}
