-- ══════════════════════════════════════════════════════════════════════════════
-- PulsePlay Phase 1: Core Infrastructure Migration
-- Organizer System + RBAC Permissions + Audit Foundation
-- Run AFTER existing migrations
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. EXTEND PROFILES: Add SUPER_ADMIN role ─────────────────────────────────
alter table public.profiles 
  drop constraint if exists profiles_role_check,
  add constraint profiles_role_check 
    check (role in ('USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'));

-- Update existing profiles to have proper role defaults
update public.profiles set role = 'USER' where role is null;

-- ── 2. ORGANIZERS TABLE ─────────────────────────────────────────────────────
create table if not exists public.organizers (
  id                  uuid        primary key default gen_random_uuid(),
  name                text        not null,
  slug                text        not null unique,
  description         text        null,
  avatar_url          text        null,
  banner_url          text        null,
  owner_id            uuid        not null references public.profiles(id) on delete cascade,
  visibility          text        not null default 'public' 
                                    check (visibility in ('public', 'private', 'unlisted')),
  verified_status     text        not null default 'unverified'
                                    check (verified_status in ('unverified', 'pending', 'verified', 'featured')),
  website_url         text        null,
  twitter_url         text        null,
  discord_url         text        null,
  youtube_url         text        null,
  twitch_url          text        null,
  tournament_count    int         not null default 0,
  follower_count      int         not null default 0,
  total_prize_pool    bigint      not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.organizers enable row level security;

-- RLS: Owner or admin can manage (doesn't depend on other tables)
 drop policy if exists "organizers_manage" on public.organizers;
 create policy "organizers_manage" on public.organizers for all using (
   owner_id = auth.uid() or
   exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'SUPER_ADMIN'))
 );

-- Index for slug lookups
 create index if not exists idx_organizers_slug on public.organizers(slug);
 create index if not exists idx_organizers_owner on public.organizers(owner_id);
 create index if not exists idx_organizers_verified on public.organizers(verified_status) where verified_status = 'verified';

-- ── 3. ORGANIZER MEMBERS (Staff) ──────────────────────────────────────────────
create table if not exists public.organizer_members (
  id                  uuid        primary key default gen_random_uuid(),
  organizer_id        uuid        not null references public.organizers(id) on delete cascade,
  user_id             uuid        not null references public.profiles(id) on delete cascade,
  role                text        not null default 'member'
                                    check (role in ('member', 'moderator', 'manager', 'co_host')),
  can_host_tournaments boolean    not null default false,
  can_manage_staff    boolean     not null default false,
  can_edit_branding   boolean     not null default false,
  added_by            uuid        null references public.profiles(id) on delete set null,
  added_at            timestamptz not null default now(),
  unique (organizer_id, user_id)
);

alter table public.organizer_members enable row level security;

 drop policy if exists "organizer_members_view" on public.organizer_members;
 create policy "organizer_members_view" on public.organizer_members for select using (true);

 drop policy if exists "organizer_members_manage" on public.organizer_members;
 create policy "organizer_members_manage" on public.organizer_members for all using (
   exists (
     select 1 from public.organizers o 
     where o.id = organizer_id 
     and (o.owner_id = auth.uid() or exists (
       select 1 from public.organizer_members om 
       where om.organizer_id = o.id 
       and om.user_id = auth.uid() 
       and om.can_manage_staff = true
     ))
   ) or exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'SUPER_ADMIN'))
 );

 create index if not exists idx_organizer_members_org on public.organizer_members(organizer_id);
 create index if not exists idx_organizer_members_user on public.organizer_members(user_id);

-- RLS: Public can view public organizers (must be after organizer_members table exists)
 drop policy if exists "organizers_public_view" on public.organizers;
 create policy "organizers_public_view" on public.organizers for select using (
   visibility = 'public' or 
   owner_id = auth.uid() or
   exists (select 1 from public.organizer_members where organizer_id = id and user_id = auth.uid())
 );

-- ── 4. GLOBAL PERMISSIONS TABLE (Admin-granted moderator permissions) ─────────
create table if not exists global_permissions (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references public.profiles(id) on delete cascade,
  granted_by          uuid        not null references public.profiles(id) on delete cascade,
  permission          text        not null check (permission in (
    'host_tournaments',      -- Can create tournaments under assigned organizers
    'moderate_content',     -- Can moderate posts/comments
    'review_disputes',      -- Can resolve match disputes
    'manage_users',         -- Can ban/mute users
    'access_audit_logs',    -- Can view audit logs
    'featured_host'         -- Gets featured organizer status
  )),
  scope_type          text        not null default 'global' 
                                    check (scope_type in ('global', 'organizer', 'tournament')),
  scope_id            uuid        null,  -- organizer_id or tournament_id if scoped
  is_active           boolean     not null default true,
  granted_at          timestamptz not null default now(),
  revoked_at          timestamptz null,
  revoked_by          uuid        null references public.profiles(id) on delete set null,
  notes               text        null,
  unique (user_id, permission, scope_type, scope_id)
);

alter table public.global_permissions enable row level security;

-- Only admins can see/manage permissions
 drop policy if exists "permissions_admin_view" on public.global_permissions;
 create policy "permissions_admin_view" on public.global_permissions for select using (
   user_id = auth.uid() or  -- Users can see their own permissions
   exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'SUPER_ADMIN'))
 );

 drop policy if exists "permissions_admin_manage" on public.global_permissions;
 create policy "permissions_admin_manage" on public.global_permissions for all using (
   exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'SUPER_ADMIN'))
 );

 create index if not exists idx_permissions_user on public.global_permissions(user_id);
 create index if not exists idx_permissions_active on public.global_permissions(user_id, is_active) where is_active = true;

-- ── 5. EXTEND TOURNAMENTS: Add organizer linkage and tournament types ─────────
alter table public.tournaments
  add column if not exists organizer_id      uuid        null references public.organizers(id) on delete set null,
  add column if not exists tournament_family text        not null default 'esports' 
                                                  check (tournament_family in ('esports', 'football', 'league')),
  add column if not exists tournament_type   text        not null default 'single_elimination'
                                                  check (tournament_type in (
                                                    'single_elimination', 'double_elimination', 'swiss', 
                                                    'round_robin', 'ladder', 'free_for_all', 'gauntlet',
                                                    'league', 'group_stage', 'group_knockout', 'custom'
                                                  )),
  add column if not exists season_name       text        null,  -- For football leagues
  add column if not exists season_year       int         null,
  add column if not exists category          text        null,  -- For multi-category tournaments
  add column if not exists requires_check_in boolean     not null default false,
  add column if not exists bracket_lock_at   timestamptz null,
  add column if not exists refund_policy     text        null,
  add column if not exists min_players       int         null default 2,
  add column if not exists team_size         int         null default 1;  -- 1 = solo, >1 = team

-- Index for organizer lookups
 create index if not exists idx_tournaments_organizer on public.tournaments(organizer_id);
 create index if not exists idx_tournaments_family on public.tournaments(tournament_family);

-- ── 6. TOURNAMENT STAFF (Granular tournament-level permissions) ─────────────
create table if not exists public.tournament_staff (
  id                  uuid        primary key default gen_random_uuid(),
  tournament_id       uuid        not null references public.tournaments(id) on delete cascade,
  user_id             uuid        not null references public.profiles(id) on delete cascade,
  role                text        not null check (role in (
    'host',           -- Full control
    'manager',        -- Can edit setup, manage registrations
    'bracket_manager', -- Can manage brackets, seeding, scores
    'reporter',       -- Can report results
    'referee',        -- Can attest/confirm results
    'streamer',       -- Can update stream info
    'observer'        -- Read-only access
  )),
  added_by            uuid        null references public.profiles(id) on delete set null,
  added_at            timestamptz not null default now(),
  unique (tournament_id, user_id)
);

alter table public.tournament_staff enable row level security;

 drop policy if exists "tournament_staff_view" on public.tournament_staff;
 create policy "tournament_staff_view" on public.tournament_staff for select using (true);

 drop policy if exists "tournament_staff_manage" on public.tournament_staff;
 create policy "tournament_staff_manage" on public.tournament_staff for all using (
   exists (
     select 1 from public.tournaments t
     left join public.tournament_staff ts on ts.tournament_id = t.id and ts.user_id = auth.uid()
     left join public.organizers o on o.id = t.organizer_id
     left join public.organizer_members om on om.organizer_id = o.id and om.user_id = auth.uid()
     where t.id = tournament_id
     and (
       t.created_by = auth.uid() or
       ts.role = 'host' or
       o.owner_id = auth.uid() or
       om.can_host_tournaments = true or
       exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'SUPER_ADMIN'))
     )
   )
 );

 create index if not exists idx_tournament_staff_tournament on public.tournament_staff(tournament_id);
 create index if not exists idx_tournament_staff_user on public.tournament_staff(user_id);

-- ── 7. EXTEND TOURNAMENT PARTICIPANTS: Add team support ──────────────────────
alter table public.tournament_participants
  add column if not exists team_id           uuid        null,  -- Future: teams support
  add column if not exists display_name      text        null,  -- For team tournaments
  add column if not exists seed_source       text        null,  -- 'manual', 'ranking', 'random', 'registration_order'
  add column if not exists division          text        null,  -- For multi-division tournaments
  add column if not exists group_id          uuid        null;  -- For group stage tournaments

-- ── 8. STANDINGS SNAPSHOTS (For football/league tournaments) ───────────────
create table if not exists public.standings_snapshots (
  id                  uuid        primary key default gen_random_uuid(),
  tournament_id       uuid        not null references public.tournaments(id) on delete cascade,
  group_id            uuid        null,  -- null = overall
  round_number        int         not null default 1,
  user_id             uuid        not null references public.profiles(id) on delete cascade,
  position            int         not null,
  played              int         not null default 0,
  wins                int         not null default 0,
  draws               int         not null default 0,
  losses              int         not null default 0,
  goals_for           int         not null default 0,
  goals_against       int         not null default 0,
  goal_difference     int         not null default 0,
  points              int         not null default 0,
  clean_sheets        int         not null default 0,
  form                text[]      null,  -- Last 5 results: ['W', 'D', 'L', 'W', 'W']
  snapshot_at         timestamptz not null default now()
);

alter table public.standings_snapshots enable row level security;
 create policy "standings_public_view" on public.standings_snapshots for select using (true);

 create index if not exists idx_standings_tournament on public.standings_snapshots(tournament_id);
 create index if not exists idx_standings_round on public.standings_snapshots(tournament_id, round_number);

-- ── 9. FIXTURES (For football tournaments) ───────────────────────────────────
create table if not exists public.fixtures (
  id                  uuid        primary key default gen_random_uuid(),
  tournament_id       uuid        not null references public.tournaments(id) on delete cascade,
  round_number        int         not null,  -- Matchday/Round
  group_id            uuid        null,
  home_participant_id uuid        null references public.profiles(id) on delete set null,
  away_participant_id uuid        null references public.profiles(id) on delete set null,
  home_score          int         null,
  away_score          int         null,
  home_forfeit        boolean     not null default false,
  away_forfeit        boolean     not null default false,
  scheduled_at        timestamptz null,
  played_at           timestamptz null,
  venue               text        null,
  status              text        not null default 'scheduled'
                                    check (status in ('scheduled', 'in_progress', 'completed', 'postponed', 'cancelled')),
  notes               text        null,
  created_at          timestamptz not null default now()
);

alter table public.fixtures enable row level security;
 create policy "fixtures_public_view" on public.fixtures for select using (true);
 create policy "fixtures_staff_manage" on public.fixtures for all using (
   exists (
     select 1 from public.tournament_staff ts 
     where ts.tournament_id = fixtures.tournament_id 
     and ts.user_id = auth.uid()
     and ts.role in ('host', 'manager', 'bracket_manager', 'reporter')
   ) or exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'SUPER_ADMIN'))
 );

 create index if not exists idx_fixtures_tournament on public.fixtures(tournament_id);
 create index if not exists idx_fixtures_round on public.fixtures(tournament_id, round_number);

-- ── 10. PLAYER STATS (For football tournaments) ──────────────────────────────
create table if not exists public.player_stats (
  id                  uuid        primary key default gen_random_uuid(),
  tournament_id       uuid        not null references public.tournaments(id) on delete cascade,
  user_id             uuid        not null references public.profiles(id) on delete cascade,
  matches_played      int         not null default 0,
  goals               int         not null default 0,
  assists             int         not null default 0,
  clean_sheets        int         not null default 0,
  yellow_cards        int         not null default 0,
  red_cards           int         not null default 0,
  mvp_count           int         not null default 0,
  updated_at          timestamptz not null default now(),
  unique (tournament_id, user_id)
);

alter table public.player_stats enable row level security;
 create policy "player_stats_public_view" on public.player_stats for select using (true);
 create policy "player_stats_staff_manage" on public.player_stats for all using (
   exists (
     select 1 from public.tournament_staff ts 
     where ts.tournament_id = player_stats.tournament_id 
     and ts.user_id = auth.uid()
     and ts.role in ('host', 'manager', 'bracket_manager', 'reporter')
   ) or exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'SUPER_ADMIN'))
 );

-- ── 11. EXTENDED AUDIT LOGS ──────────────────────────────────────────────────
alter table public.audit_logs
  add column if not exists ip_address      text        null,
  add column if not exists user_agent      text        null,
  add column if not exists severity        text        not null default 'info'
                                                  check (severity in ('debug', 'info', 'warning', 'critical')),
  add column if not exists change_type     text        null,  -- 'create', 'update', 'delete', 'grant', 'revoke'
  add column if not exists previous_value  jsonb       null,
  add column if not exists new_value       jsonb       null;

-- Index for audit log queries
 create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);
 create index if not exists idx_audit_logs_action on public.audit_logs(action);
 create index if not exists idx_audit_logs_target on public.audit_logs(target_type, target_id);
 create index if not exists idx_audit_logs_severity on public.audit_logs(severity) where severity in ('warning', 'critical');
 create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

-- ── 12. SECURITY FUNCTIONS ───────────────────────────────────────────────────

-- Check if user has global permission
create or replace function public.has_global_permission(
  p_user_id uuid,
  p_permission text,
  p_scope_type text default 'global',
  p_scope_id uuid default null
) returns boolean language plpgsql security definer as $$
begin
  return exists (
    select 1 from public.global_permissions
    where user_id = p_user_id
      and permission = p_permission
      and is_active = true
      and (scope_type = p_scope_type or scope_type = 'global')
      and (scope_id = p_scope_id or scope_id is null)
  ) or exists (
    select 1 from public.profiles where id = p_user_id and role in ('ADMIN', 'SUPER_ADMIN')
  );
end;
$$;

-- Check if user can host tournaments for an organizer
create or replace function public.can_host_for_organizer(
  p_user_id uuid,
  p_organizer_id uuid
) returns boolean language plpgsql security definer as $$
begin
  -- Super admins and admins always can
  if exists (select 1 from public.profiles where id = p_user_id and role in ('ADMIN', 'SUPER_ADMIN')) then
    return true;
  end if;
  
  -- Organizer owner can
  if exists (select 1 from public.organizers where id = p_organizer_id and owner_id = p_user_id) then
    return true;
  end if;
  
  -- Members with can_host_tournaments can
  if exists (
    select 1 from public.organizer_members
    where organizer_id = p_organizer_id
      and user_id = p_user_id
      and can_host_tournaments = true
  ) then
    return true;
  end if;
  
  -- Global host_tournaments permission grants access to assigned organizers
  if exists (
    select 1 from public.global_permissions
    where user_id = p_user_id
      and permission = 'host_tournaments'
      and is_active = true
      and (scope_type = 'organizer' and scope_id = p_organizer_id)
  ) then
    return true;
  end if;
  
  return false;
end;
$$;

-- Check tournament staff role
create or replace function public.get_tournament_role(
  p_user_id uuid,
  p_tournament_id uuid
) returns text language plpgsql security definer as $$
declare
  v_role text;
begin
  -- Check if user is admin/superadmin
  select role into v_role from public.profiles where id = p_user_id;
  if v_role in ('ADMIN', 'SUPER_ADMIN') then
    return 'admin';
  end if;
  
  -- Check if tournament creator
  if exists (select 1 from public.tournaments where id = p_tournament_id and created_by = p_user_id) then
    return 'host';
  end if;
  
  -- Check tournament staff role
  select ts.role into v_role
  from public.tournament_staff ts
  where ts.tournament_id = p_tournament_id and ts.user_id = p_user_id;
  
  if v_role is not null then
    return v_role;
  end if;
  
  -- Check organizer ownership
  if exists (
    select 1 from public.tournaments t
    join public.organizers o on o.id = t.organizer_id
    where t.id = p_tournament_id and o.owner_id = p_user_id
  ) then
    return 'host';
  end if;
  
  return null;
end;
$$;

-- Grant execute permissions
grant execute on function public.has_global_permission(uuid, text, text, uuid) to authenticated;
grant execute on function public.can_host_for_organizer(uuid, uuid) to authenticated;
grant execute on function public.get_tournament_role(uuid, uuid) to authenticated;

-- ── 13. TRIGGER: Update organizer stats ───────────────────────────────────────
create or replace function public.update_organizer_stats()
returns trigger language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') and new.organizer_id is not null then
    update public.organizers set
      tournament_count = (select count(*) from public.tournaments where organizer_id = new.organizer_id),
      total_prize_pool = coalesce((select sum(prize_amount) from public.tournaments where organizer_id = new.organizer_id), 0),
      updated_at = now()
    where id = new.organizer_id;
  end if;
  
  if (tg_op = 'DELETE' or tg_op = 'UPDATE') and old.organizer_id is not null and old.organizer_id is distinct from new.organizer_id then
    update public.organizers set
      tournament_count = (select count(*) from public.tournaments where organizer_id = old.organizer_id),
      total_prize_pool = coalesce((select sum(prize_amount) from public.tournaments where organizer_id = old.organizer_id), 0),
      updated_at = now()
    where id = old.organizer_id;
  end if;
  
  return coalesce(new, old);
end;
$$;

 drop trigger if exists update_organizer_stats_trigger on public.tournaments;
 create trigger update_organizer_stats_trigger
   after insert or update or delete on public.tournaments
   for each row execute function public.update_organizer_stats();

-- ── 14. SEED DEFAULT PLATFORM ORGANIZER ───────────────────────────────────────
insert into public.organizers (id, name, slug, description, owner_id, visibility, verified_status)
select 
  '00000000-0000-0000-0000-000000000001'::uuid,
  'PulsePlay Official',
  'pulseplay-official',
  'The official PulsePlay tournament organizer. Hosting premium esports and football competitions.',
  id,
  'public',
  'verified'
from public.profiles 
where role = 'SUPER_ADMIN' or role = 'ADMIN'
limit 1
on conflict (id) do nothing;

-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ══════════════════════════════════════════════════════════════════════════════
