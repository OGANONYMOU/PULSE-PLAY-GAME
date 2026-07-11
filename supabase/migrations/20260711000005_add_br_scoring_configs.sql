-- br_scoring_configs and its upsert RPC never existed live, so:
-- (1) TournamentDetail.tsx's unconditional lookup on every tournament page silently
--     404'd (PGRST205) on every single load, and
-- (2) TournamentCreateNew.tsx's battle_royale branch silently failed to persist
--     kill/placement point rules for every BR tournament created.
create table if not exists public.br_scoring_configs (
  id                 uuid        primary key default gen_random_uuid(),
  tournament_id      uuid        not null references public.tournaments(id) on delete cascade,
  kill_points        integer     not null default 1,
  placement_points   jsonb       not null default '[]'::jsonb,
  preset_name        text        null,
  game_mode          text        null,
  games_per_session  integer     not null default 4,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tournament_id)
);

alter table public.br_scoring_configs enable row level security;

drop policy if exists "br_scoring_configs_read" on public.br_scoring_configs;
create policy "br_scoring_configs_read" on public.br_scoring_configs for select using (true);

drop policy if exists "br_scoring_configs_write" on public.br_scoring_configs;
create policy "br_scoring_configs_write" on public.br_scoring_configs for all using (
  exists (select 1 from public.tournaments t where t.id = tournament_id and t.created_by = auth.uid())
  or exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','SUPER_ADMIN'))
  or public.get_tournament_role(auth.uid(), tournament_id) = 'host'
) with check (
  exists (select 1 from public.tournaments t where t.id = tournament_id and t.created_by = auth.uid())
  or exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','SUPER_ADMIN'))
  or public.get_tournament_role(auth.uid(), tournament_id) = 'host'
);

create or replace function public.upsert_br_scoring_config(
  p_tournament_id uuid,
  p_kill_points integer,
  p_placement_points jsonb,
  p_preset_name text,
  p_game_mode text,
  p_games_per_session integer
) returns public.br_scoring_configs
language plpgsql security definer as $$
declare
  v_row public.br_scoring_configs;
begin
  insert into public.br_scoring_configs (tournament_id, kill_points, placement_points, preset_name, game_mode, games_per_session)
  values (p_tournament_id, p_kill_points, p_placement_points, p_preset_name, p_game_mode, p_games_per_session)
  on conflict (tournament_id) do update set
    kill_points        = excluded.kill_points,
    placement_points   = excluded.placement_points,
    preset_name        = excluded.preset_name,
    game_mode           = excluded.game_mode,
    games_per_session  = excluded.games_per_session,
    updated_at         = now()
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function public.upsert_br_scoring_config(uuid, integer, jsonb, text, text, integer) to authenticated;
