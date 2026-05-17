-- ═══════════════════════════════════════════════════════════════════════════════
-- [PULSEPLAY] Rivalries — head-to-head player records
-- Paste entire file into Supabase SQL Editor and click Run.
-- Safe to re-run: uses IF NOT EXISTS everywhere.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── [1/5] TABLE ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rivalries (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  player_a    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_b    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id     uuid,
  wins_a      integer     DEFAULT 0 NOT NULL,
  wins_b      integer     DEFAULT 0 NOT NULL,
  matches     integer     DEFAULT 0 NOT NULL,
  last_match  timestamptz,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (player_a, player_b, game_id)
);

-- ── [2/5] OPTIONAL FOREIGN KEY ────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'games') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'rivalries_game_id_fkey' AND table_name = 'rivalries'
    ) THEN
      ALTER TABLE public.rivalries ADD CONSTRAINT rivalries_game_id_fkey
        FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ── [3/5] INDEXES ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_rivalries_player_a ON public.rivalries(player_a);
CREATE INDEX IF NOT EXISTS idx_rivalries_player_b ON public.rivalries(player_b);
CREATE INDEX IF NOT EXISTS idx_rivalries_game_id  ON public.rivalries(game_id);

-- ── [4/5] ROW LEVEL SECURITY ──────────────────────────────────────────────────

ALTER TABLE public.rivalries ENABLE ROW LEVEL SECURITY;

-- ── [5/5] POLICIES ────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rivalries' AND policyname='rivalries_select') THEN
    CREATE POLICY "rivalries_select" ON public.rivalries FOR SELECT USING (true);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Done. Table created: rivalries
-- ═══════════════════════════════════════════════════════════════════════════════
