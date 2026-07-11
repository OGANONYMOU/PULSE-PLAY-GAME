-- profiles.gamercred_score already existed; several call sites (organizer panel
-- participants list, AdminModeration reporter lookup, AdminTournaments participant
-- list) queried a nonexistent 'gamercred' column, causing 42703 and silently
-- empty participant lists. Fixed on the code side via `gamercred:gamercred_score`
-- select aliases -- no schema change needed for that part.

-- AdminUsers.tsx (mute/suspend/verify actions, trust-score calc, last-active sort)
-- reads/writes these profiles columns, none of which existed live -- every mute,
-- suspend, and verify action was a silent no-op, and sort-by-last-active/verified
-- filters always evaluated against undefined.
alter table public.profiles
  add column if not exists is_suspended     boolean     not null default false,
  add column if not exists suspended_until  timestamptz null,
  add column if not exists muted_until      timestamptz null,
  add column if not exists verified         boolean     not null default false,
  add column if not exists last_active      timestamptz null;

create index if not exists idx_profiles_last_active on public.profiles(last_active);

-- Available for a future auth-activity hook to bump last_active on sign-in; not
-- wired to a trigger yet since "last active" should reflect real activity, not
-- every profile field edit.
create or replace function public.touch_profile_last_active()
returns trigger language plpgsql as $$
begin
  new.last_active := now();
  return new;
end;
$$;
