-- Extend audit_logs to match the AuditLogEntry shape the app's centralized
-- writeAudit() (src/lib/audit/auditSystem.ts) and AdminAuditLog.tsx already assume.
-- The table only had the older minimal shape (target_type/target_id/meta), so every
-- writeAudit() call -- including the one fired right after tournament creation --
-- was failing with PGRST204 "column not found in schema cache".
alter table public.audit_logs
  add column if not exists actor_email      text        null,
  add column if not exists actor_role       text        null,
  add column if not exists action_category  text        null,
  add column if not exists target_name      text        null,
  add column if not exists previous_state   jsonb       null,
  add column if not exists new_state        jsonb       null,
  add column if not exists change_summary   text        null,
  add column if not exists reason           text        null,
  add column if not exists session_id       text        null,
  add column if not exists is_reversible    boolean     not null default false,
  add column if not exists reversed_at      timestamptz null,
  add column if not exists reversed_by      uuid        null,
  add column if not exists reversal_reason  text        null;

-- app code reads/writes 'meta' as 'metadata' in some places (auditSystem.ts inserts
-- into a column named 'metadata', the old schema named it 'meta') -- add an alias
-- column and keep both in sync via trigger so neither call site breaks.
alter table public.audit_logs
  add column if not exists metadata jsonb null;

create or replace function public.sync_audit_logs_meta_metadata()
returns trigger language plpgsql as $$
begin
  if new.metadata is null and new.meta is not null then
    new.metadata := new.meta;
  elsif new.meta is null and new.metadata is not null then
    new.meta := new.metadata;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_audit_logs_meta on public.audit_logs;
create trigger trg_sync_audit_logs_meta
  before insert or update on public.audit_logs
  for each row execute function public.sync_audit_logs_meta_metadata();
