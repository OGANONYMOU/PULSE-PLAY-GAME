# PulsePlay — Developer README

> Competitive mobile gaming tournament platform. React 19 + TypeScript + Vite + Supabase + Tailwind + Framer Motion.

---

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

### First-time Supabase setup

1. Open Supabase → **SQL Editor → New Query**
2. Run `supabase_migration.sql` (base schema: profiles, games, tournaments, posts, announcements)
3. Run `supabase_trust_migration.sql` (trust tables: participants, matches, evidence, disputes, audit_log, outbox_events)
4. Create Storage bucket named `avatars` and set it to **Public**
5. Register an account in the app, then go to Supabase → `profiles` table and set your row's `role` to `ADMIN`
6. Log back in → admin panel appears at `/admin`

---

## Feature Flags

All trust features are controlled by localStorage-backed flags. Toggle them live in **Admin → Settings → Feature Flags** without a redeploy.

| Flag key | Default | What it controls |
|---|---|---|
| `ff_use_participant_model` | ✅ on | Tournament joins create `tournament_participants` rows instead of incrementing a counter |
| `ff_use_evidence_v1` | ✅ on | Evidence upload flow enabled in matches |
| `ff_use_audit_log` | ✅ on | Writes `audit_log` + `outbox_events` rows for all sensitive actions |
| `ff_use_matches` | ✅ on | Match scheduling and state machine UI visible |
| `ff_use_disputes` | ✅ on | Dispute adjudication admin UI visible |

### Rollback procedure

Any flag can be disabled without a deployment:
1. Go to **Admin → Settings → Feature Flags**
2. Toggle the flag off
3. Changes take effect immediately for all new sessions

Or via browser console:
```js
localStorage.setItem('ff_use_participant_model', 'false');
location.reload();
```

---

## Architecture

```
src/
├── lib/
│   ├── featureFlags.ts     — localStorage flag system
│   ├── auditLog.ts         — writeAuditLog / writeOutboxEvent helpers
│   ├── supabase.ts         — typed Supabase client
│   └── currency.ts         — multi-currency support (NGN/USD/EUR/GBP/GHS/KES/ZAR/CAD/AUD)
├── contexts/
│   ├── AuthContext.tsx      — Supabase auth, session persistence, profile
│   ├── ThemeContext.tsx     — dark/light toggle
│   └── CurrencyContext.tsx  — currency detection + persistence
├── pages/
│   ├── admin/
│   │   ├── AdminMatches.tsx    — Match CRUD + state machine UI + evidence upload
│   │   ├── AdminDisputes.tsx   — Dispute queue + adjudication
│   │   ├── AdminAuditLog.tsx   — Immutable audit trail viewer + CSV export
│   │   ├── AdminSettings.tsx   — Feature flags + currency + DB overview
│   │   └── ...
│   └── ...
└── public/
    ├── games/              — Game cover images
    └── pulseplay-logo.jpg
```

---

## Match State Machine

```
scheduled → in_progress → awaiting_proof ──→ verified → settled
                                         ↘ disputed → verified → settled
                                                    ↘ settled
Any state → canceled
```

All transitions are:
- **Idempotent** — re-applying the same transition is safe
- **Logged** — every transition writes to `audit_log`
- **Admin-only** — enforced by Supabase RLS

---

## Audit Log

Every sensitive write emits two records (if flags are on):

| Table | Purpose |
|---|---|
| `audit_log` | Immutable append-only log. Admin-readable, user-writable (insert only). |
| `outbox_events` | Transactional outbox for downstream event consumers (future: webhooks, notifications). |

Audited actions: tournament join/leave/create/update/delete/status_change, match start/status_change, dispute open/resolve/cancel, evidence upload, user ban/unban/role_change, game create/update/delete.

View audit trail: **Admin → Audit Log**. Filterable by entity type, searchable by action. CSV export available.

---

## Database Schema (new tables)

### tournament_participants
```sql
-- Replaces current_players counter increment
-- Unique(tournament_id, user_id) prevents double-join
-- status: joined | checked_in | dropped
```

### matches
```sql
-- status: scheduled | in_progress | awaiting_proof | disputed | verified | settled | canceled
-- proof_due_at set to +24h when entering awaiting_proof
```

### evidence_objects
```sql
-- Immutable. object_key = Supabase Storage path
-- sha256 populated by server worker (client stores placeholder until then)
-- phash for perceptual duplicate detection (future)
```

### disputes
```sql
-- Unique per match. state: open | needs_more_info | resolved | canceled
-- resolution + resolved_by + resolved_at written when admin resolves
-- due_by for SLA tracking (highlighted in admin UI when < 4h)
```

### audit_log + outbox_events
```sql
-- Append-only. audit_log is admin-readable, user insert-only via RLS.
-- outbox_events for async event processing.
```

---

## Rollout Plan

| Phase | Week | Scope |
|---|---|---|
| A — MVP fixes | 0–2 | Auth CTA fix ✅, clickable game cards ✅, logo upload ✅, seed games ✅ |
| B — Trust core | 2–8 | Participants ✅, matches ✅, evidence ✅, disputes ✅, audit log ✅, loyalty rules ✅ |
| C — Hardening | 8–12 | BFF migration, RLS lockdown, monitoring, wallet primitives |

---

## Environment Variables

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## Deployment

Push to `main` → Vercel auto-deploys. Force-push if local is ahead:

```bash
git remote set-url origin https://OGANONYMOU:<TOKEN>@github.com/OGANONYMOU/PULSE-PLAY-GAME.git
git push origin main --force
```

GitHub token needs `repo` scope: **GitHub → Settings → Developer Settings → Personal Access Tokens → Classic**.

---

## Payments

Intentionally deferred. Do not implement wallet/payout logic until the trust infrastructure (matches, evidence, disputes, audit) is validated in production.

---

## Community System (v3)

### New pages

| Route | Page | Description |
|---|---|---|
| `/community` | Community | 4-tab hub: Feed, Clips, Events, Discover |
| `/clubs` | Clubs | Browse/create/join clubs with leaderboard |
| `/leaderboards` | Leaderboards | GamerCred, PulsePoints, Club rankings |
| `/rivalry/:a/:b` | Rivalry | Auto-generated head-to-head rivalry page |
| `/admin/moderation` | AdminModeration | Report queue + mod action log |
| `/admin/clubs` | AdminClubs | Club management |

### New components

| Component | Purpose |
|---|---|
| `PostCard` | Full post with reactions (5 types), comments (threaded), quote repost, share, save, report |
| `ClipCard` | Video player with like/comment/share/report |
| `ShareModal` | Cross-platform share: WhatsApp, Twitter, TikTok, Instagram with PulsePlay watermark |
| `ReportModal` | Report content: 8 reason types |
| `NotificationBell` | Live notification dropdown with unread counter |

### Reactions system

5 reaction types: `like` ❤️ `fire` 🔥 `trophy` 🏆 `clap` 👏 `mind_blown` 🤯

### PulsePoints — earn rules

| Action | Points |
|---|---|
| Join tournament | +10 (auto via DB trigger) |
| Upload clip | +30 |
| Win match | +50 |
| Complete daily challenge | varies |

### GamerCred tiers

1000 (default) → 800+ = Verified badge → 1200+ = priority matchmaking → 1500+ = host privileges

### Daily challenges

7 auto-seeded challenges. Run daily via cron or manually refresh in admin.

### SQL migrations (run in order)

1. `supabase_migration.sql` — base schema
2. `supabase_trust_migration.sql` — tournament participants, matches, disputes, audit
3. `supabase_extended_migration.sql` — clubs, clips, pulsepoints, gamercred, guides
4. `supabase_community_migration.sql` — reactions, comments, saves, reposts, reports, mod logs, followers, rivalries, notifications, events, challenges

### Moderation roles

| Role | Can do |
|---|---|
| ADMIN | Everything: delete any content, ban/unban users, adjust GamerCred, dismiss or action any report |
| MODERATOR | Handle reports, remove content, mute users, write mod logs |
| USER | Post, react, comment, report, upload clips |
