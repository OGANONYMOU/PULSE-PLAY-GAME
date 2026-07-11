-- fraudDetection.ts queried a nonexistent 'tournament_matches' table (renamed to
-- 'matches' at some point without the fraud-detection/dispute/realtime call sites
-- being updated -- fixed on the code side) and also selected a 'score_details'
-- column that never existed on 'matches'. Add it so the fraud-detection score-
-- anomaly queries stop 42703'ing.
alter table public.matches add column if not exists score_details jsonb null;

-- disputeSystem.ts applyMatchOverride() (fired when an admin/moderator resolves a
-- dispute with a match-result override) writes winner_id/score/status plus
-- provenance columns that never existed on 'matches', so every dispute resolution
-- with a result override silently failed.
alter table public.matches
  add column if not exists score                   text        null,
  add column if not exists result_overridden        boolean     not null default false,
  add column if not exists result_override_reason   text        null,
  add column if not exists result_overridden_by     uuid        null references public.profiles(id);
