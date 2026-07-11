-- disputes.match_id was NOT NULL, but the fixture-based dispute flow
-- (Fixtureresultmodal.tsx handleDispute) legitimately has no match_id and only a
-- fixture_id. This blocked every fixture-result dispute with a 23502 violation.
-- Loosen match_id and add an integrity check requiring at least one target.
alter table public.disputes alter column match_id drop not null;

alter table public.disputes
  drop constraint if exists disputes_has_target_check;
alter table public.disputes
  add constraint disputes_has_target_check
  check (match_id is not null or fixture_id is not null);
