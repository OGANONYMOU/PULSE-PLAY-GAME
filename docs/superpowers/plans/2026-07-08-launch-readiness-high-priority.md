# PulsePlay Launch-Readiness (HIGH-Priority) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close every HIGH-priority gap from the Competitive Audit & Engineering Action Brief (2026-07-08) so PulsePlay is credible for creator outreach — real data instead of placeholders, a real tournament detail page, a working PulsePoints wallet surface, and honest trust/compliance copy.

**Architecture:** PulsePlay is a Vite + React 19 SPA (`react-router-dom` v7, all routes in `src/App.tsx`, lazy-loaded pages) backed directly by Supabase (Postgres + RLS + `rpc()` calls) — there is no separate Node/API server. "Backend" work in this plan means Supabase query/RPC hooks in `src/hooks/` and `src/lib/`, not a server deploy. "Frontend" work means the pages/components that consume those hooks.

**Tech Stack:** React 19, TypeScript, react-router-dom v7, Tailwind + shadcn/radix (`src/components/ui/`), framer-motion, Supabase JS client (`src/lib/supabase.ts`), lucide-react icons, sonner toasts.

## Global Constraints

- No fabricated statistics anywhere in the app — every number shown must come from a real Supabase query, or be replaced with honest qualitative copy. (`src/pages/Home.tsx` already states this as a house rule in its header comment — extend it to `Games.tsx` and `About.tsx`.)
- Payment processor branding = **Paystack** (confirmed by user). Do not name any other processor.
- Do NOT add social media links (Instagram/TikTok/WhatsApp/Telegram/Discord) — user will supply handles later. Leave `Footer.tsx`'s existing social row as-is except where explicitly instructed.
- Compliance/trust copy must use generic, non-committal language (e.g., "18+ to participate", "Not affiliated with game publishers") — do not claim a specific KYC/ID-verification process since none exists yet.
- Follow existing code patterns: Supabase queries go through `src/lib/supabase.ts`'s `supabase` client using the same `(supabase as any).from(...)`/`.rpc(...)` idioms already used in `src/hooks/useGamerCred.ts` and `src/pages/TournamentCreateNew.tsx`. Match the existing dark/purple/gold visual language (`font-orbitron` headings, `gaming-card` class, `bg-white/5 border-white/10` panel style) — do not restyle.
- Verification in this repo is `npm run lint`, `npm run build` (runs `tsc -b` first), and manual/Playwright smoke checks — there is no unit test suite, so tasks below verify via type-check + build + browser/Playwright rather than red/green unit tests.

---

## Track A — Data Layer (Supabase hooks/queries)

### Task A1: PulsePoints wallet balance hook

**Files:**
- Create: `src/hooks/useWallet.ts`

**Interfaces:**
- Produces: `useWallet(userId: string | undefined) => { balance: number; transactions: WalletTxn[]; loading: boolean }` — consumed by Task C1 (Wallet page), Task C2 (Quick Tournament preview), Task C3 (Profile stat row).
- `WalletTxn = { id: string; type: string; amount: number; currency: string; status: string; notes: string | null; created_at: string; tournament_id: string }`

The real ledger table is `pulsepoints_ledger` (columns: `user_id`, `delta`, `reason`, `ref_type`, `ref_id`, `balance_after`, `created_at`) — balance is `sum(delta)` per user (see `supabase_tournament_engine.sql` lines 672-673 and 524-529). The human-readable log table is `tournament_wallet_transactions` (columns: `tournament_id`, `user_id`, `type`, `amount`, `currency`, `status`, `notes`, `created_at`).

- [ ] **Step 1: Write the hook**

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type WalletTxn = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  notes: string | null;
  created_at: string;
  tournament_id: string;
};

export function useWallet(userId: string | undefined) {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTxn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setBalance(0);
      setTransactions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      const [{ data: ledger }, { data: txns }] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('pulsepoints_ledger')
          .select('delta')
          .eq('user_id', userId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('tournament_wallet_transactions')
          .select('id, type, amount, currency, status, notes, created_at, tournament_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(25),
      ]);

      if (cancelled) return;
      const sum = ((ledger as { delta: number }[]) ?? []).reduce((acc, row) => acc + row.delta, 0);
      setBalance(sum);
      setTransactions((txns as WalletTxn[]) ?? []);
      setLoading(false);
    };

    run();
    return () => { cancelled = true; };
  }, [userId]);

  return { balance, transactions, loading };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit` (or `npm run build` once other tasks land)
Expected: no errors referencing `useWallet.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWallet.ts
git commit -m "feat: add PulsePoints wallet balance/transactions hook"
```

---

### Task A2: Real platform stats helper

**Files:**
- Create: `src/lib/platformStats.ts`

**Interfaces:**
- Produces: `getPlatformStats(): Promise<{ activeGamers: number; tournamentsHosted: number; totalPrizePool: number; partnerGames: number }>` — consumed by Task D1 (About.tsx) and Task B3 (Games.tsx featured banner).

- [ ] **Step 1: Write the helper**

```typescript
import { supabase } from '@/lib/supabase';

export type PlatformStats = {
  activeGamers: number;
  tournamentsHosted: number;
  totalPrizePool: number;
  partnerGames: number;
};

export async function getPlatformStats(): Promise<PlatformStats> {
  const [{ count: activeGamers }, { count: tournamentsHosted }, { count: partnerGames }, { data: prizeRows }] =
    await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('profiles').select('id', { count: 'exact', head: true }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('tournaments').select('id', { count: 'exact', head: true }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('games').select('id', { count: 'exact', head: true }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('tournaments').select('prize_amount'),
    ]);

  const totalPrizePool = ((prizeRows as { prize_amount: number | null }[]) ?? [])
    .reduce((acc, row) => acc + (row.prize_amount ?? 0), 0);

  return {
    activeGamers: activeGamers ?? 0,
    tournamentsHosted: tournamentsHosted ?? 0,
    totalPrizePool,
    partnerGames: partnerGames ?? 0,
  };
}
```

- [ ] **Step 2: Type-check** — same as A1 Step 2.

- [ ] **Step 3: Commit**

```bash
git add src/lib/platformStats.ts
git commit -m "feat: add real platform stats aggregation helper"
```

---

## Track B — Structural / Routing Fixes

### Task B1: Wire `/tournaments/:id` as a real page (replace modal)

**Files:**
- Modify: `src/App.tsx` (add lazy import + route)
- Modify: `src/pages/Tournaments.tsx` (replace `DetailModal` open-on-click with navigation)

**Context:** `src/pages/TournamentDetail.tsx` (`export function TournamentDetail()`, line 763) already reads `id` via `useParams<{ id: string }>()` and is a fully built standalone page — it is simply never routed. `Tournaments.tsx` currently opens tournament details in a `<Dialog>` (`DetailModal` component, line 491; `setDetail`/`closeDetail` state, lines 712/784; `<Dialog open={!!detail}>` at lines 1274-1286) over the visible card grid.

- [ ] **Step 1: Add the route in `src/App.tsx`**

Add to the lazy-page imports block (near the other page imports, alphabetically grouped with the other Tournament* imports):
```typescript
const TournamentDetailPage = lazy(() => import('@/pages/TournamentDetail').then(m => ({ default: m.TournamentDetail })));
```
Add to `<Routes>`, directly after the existing `/tournaments/create` route:
```jsx
<Route path="/tournaments/:id" element={<TournamentDetailPage />} />
```
Also add `'/tournaments'` style entry to `PREFETCH_MAP` if not already present (it already covers `/tournaments`; leave as-is, dynamic `:id` routes aren't prefetchable by path).

- [ ] **Step 2: Replace modal trigger with navigation in `src/pages/Tournaments.tsx`**

Find every place that calls `setDetail(t)` to open the modal (the card's `onClick`/"View Details" button, around where tournament cards are rendered before line 712). Replace with `useNavigate()` + `navigate(`/tournaments/${t.id}`)`, e.g.:
```typescript
const navigate = useNavigate(); // add to imports: `useNavigate` from 'react-router-dom'
// ...
<div onClick={() => navigate(`/tournaments/${t.id}`)} className="cursor-pointer" ...>
```
Remove the `detail`/`setDetail` state, the `closeDetail` function, the `<Dialog open={!!detail} ...><DetailModal .../></Dialog>` block (lines ~1274-1286), and the now-unused `DetailModal` function (line 491) and its unused props/handlers (`onRegister`, `onWithdraw`, `onShare`, `registering`, `liveUpdates`, `participants`, `loading` state that only fed the modal) — but only remove state/handlers confirmed unused by anything else in the file after the modal is gone. Keep any registration logic that's still needed elsewhere (e.g., inline "Register" quick-action buttons on the cards themselves, if present) — do not delete registration functionality, only the modal presentation layer.

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: succeeds with no TS errors about unused `Dialog` import, unused `detail` state, or missing `useNavigate` import. Remove the now-unused `Dialog`/`DialogContent` import from `Tournaments.tsx` if nothing else in the file uses it.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open `/tournaments`, click a tournament card. Expected: browser navigates to `/tournaments/<id>` and renders the full `TournamentDetail` page (not a dialog over the grid).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/pages/Tournaments.tsx
git commit -m "feat: convert tournament detail from modal to dedicated /tournaments/:id page"
```

---

### Task B2: Fix the "Play" button on the Games grid

**Files:**
- Modify: `src/pages/Games.tsx` (`GameCard` component, lines ~112-153)

**Context:** The "Play" button (line 144-148) currently links to `/tournaments?game=${g.id}` — a generic, filtered-but-still-undifferentiated tournaments list, which is the exact bug the brief flags. The "Details" button (line 139-143) already correctly links to `/games/${g.id}` (the hub). Fix: Play should route into the specific game's hub Tournaments context (`/games/${g.id}`, which opens directly on tabs including Tournaments per `GameDetail.tsx`) so it's differentiated from a generic cross-game list — since `Game` rows here don't carry a specific open-tournament id, route to the hub rather than inventing a second query for "nearest open tournament."

- [ ] **Step 1: Change the Play button's target**

```tsx
<Button asChild className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm h-10 sm:h-9 min-h-[40px]">
  <Link to={`/games/${g.id}?tab=tournaments`}>
    <Trophy className="mr-2 w-4 h-4" />Play
  </Link>
</Button>
```

- [ ] **Step 2: Make `GameDetail.tsx` respect a `?tab=` query param on load**

In `src/pages/GameDetail.tsx`, find the tab-state initialization (the `useState` that defaults the active tab, near the tab list confirmed at lines 707-712: Overview/Tournaments/Clips/Leaderboard/Clans/Discuss). Initialize it from the URL query string instead of a hardcoded default:
```typescript
import { useSearchParams } from 'react-router-dom'; // add if not already imported
// ...
const [searchParams] = useSearchParams();
const initialTab = searchParams.get('tab') ?? 'overview';
const [activeTab, setActiveTab] = useState(initialTab);
```
(Match whatever the existing tab-state variable is actually named — read the surrounding code before editing so the variable name and valid tab id strings, e.g. `'tournaments'`, line up exactly with the existing tab list.)

- [ ] **Step 3: Build + smoke test**

Run: `npm run build`, then `npm run dev` → go to `/games`, click "Play" on any game card. Expected: lands on that game's hub page with the Tournaments tab active, not the generic `/tournaments` list.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Games.tsx src/pages/GameDetail.tsx
git commit -m "fix: route Games grid Play button into the specific game's tournaments tab"
```

---

### Task B3: Replace hardcoded ₦10M prize pool stat

**Files:**
- Modify: `src/pages/Games.tsx` (`FeaturedBanner` component, lines 65-99)

**Context:** Line 87 hardcodes `₦10M` next to two real, data-driven stats (`players` from `g.player_count`, `g.tournament_count`) — the exact mismatch pattern the brief calls out as a trust risk.

- [ ] **Step 1: Fetch real stats and pass down**

In the parent `Games` component (where `FeaturedBanner` is rendered), import and call `getPlatformStats` from Task A2:
```typescript
import { getPlatformStats, type PlatformStats } from '@/lib/platformStats';
// ...
const [stats, setStats] = useState<PlatformStats | null>(null);
useEffect(() => { getPlatformStats().then(setStats); }, []);
```
Pass `stats` as a prop to `<FeaturedBanner game={featuredGame} stats={stats} />`.

- [ ] **Step 2: Replace the hardcoded value in `FeaturedBanner`**

```tsx
function FeaturedBanner(p: { game: Game; stats: PlatformStats | null }): React.ReactElement {
  const g = p.game;
  const prizePool = p.stats
    ? (p.stats.totalPrizePool >= 1_000_000
        ? `₦${(p.stats.totalPrizePool / 1_000_000).toFixed(1)}M`
        : `₦${p.stats.totalPrizePool.toLocaleString()}`)
    : '—';
  // ...
  <div className="font-orbitron text-2xl font-bold gradient-text">{prizePool}</div>
  <div className="text-xs text-muted-foreground">Total Prize Pool</div>
```
Label change from "Prize Pool" to "Total Prize Pool" makes clear this is platform-wide, not per-game — satisfies the brief's second HIGH item ("if aggregate stats are meant to differ from per-tournament numbers, make that distinction explicit in the UI copy").

- [ ] **Step 3: Build check + commit**

```bash
npm run build
git add src/pages/Games.tsx
git commit -m "fix: replace hardcoded prize pool stat with real aggregate data"
```

---

## Track C — New Components (Wallet, Quick Tournament, Profile stats)

### Task C1: Wallet page

**Files:**
- Create: `src/pages/Wallet.tsx`
- Modify: `src/App.tsx` (route + prefetch entry)
- Modify: `src/components/layout/Navbar.tsx` (nav link, authenticated only)

**Interfaces:**
- Consumes: `useWallet` from Task A1.

- [ ] **Step 1: Build the page**

Follow the visual/structural pattern of `src/pages/Profile.tsx` (`min-h-screen pt-20 sm:pt-24`, `gaming-card`/`bg-white/5 border-white/10` panels, `font-orbitron` headings). Required content:
- Header: "Wallet" title + current PulsePoints balance in large text (from `useWallet`).
- A "Redeem" panel: shows the PP→Naira conversion rate as a named constant (add `export const PP_TO_NAIRA_RATE = 1;` at top of file with a comment `// 1 PulsePoint = ₦1 — update when a real conversion rate is set`), the Paystack payout rail labeled explicitly (`"Payouts powered by Paystack"` with a small Paystack-brand-colored badge), and a minimum-redeem note (`"Minimum redemption: 500 PP"`). The Redeem button is disabled with a tooltip/subtext `"Redemption opens once Paystack payout integration is live"` — do not wire a fake working redeem action since no live payout integration exists; the goal of this HIGH item is transparency at the point of redemption, not shipping real payouts.
- A "Transaction History" list rendering `transactions` from `useWallet` (type, amount with +/- sign colored green/red, status badge, relative date via `date-fns` `formatDistanceToNow` — already used elsewhere in the codebase, e.g. `TournamentDetail.tsx`). Empty state when `transactions.length === 0`: icon + "No transactions yet — your entry fees and prize payouts will show up here."

- [ ] **Step 2: Route + nav link**

In `src/App.tsx`: add `const Wallet = lazy(() => import('@/pages/Wallet').then(m => ({ default: m.Wallet })));`, add `<Route path="/wallet" element={<Wallet />} />` next to `/profile`, add `'/wallet': () => import('@/pages/Wallet'),` to `PREFETCH_MAP`.

In `src/components/layout/Navbar.tsx`: inside the authenticated-state branch (near where the avatar dropdown / notification bell render, confirmed around line 198-211), add a wallet balance chip/link to `/wallet` — follow the existing nav-item styling used for other authenticated links in the same file.

- [ ] **Step 3: Build + smoke test + commit**

```bash
npm run build
```
Manual: `npm run dev`, sign in, visit `/wallet`, confirm balance renders (0 if no ledger rows) and transaction list/empty-state renders without errors.
```bash
git add src/pages/Wallet.tsx src/App.tsx src/components/layout/Navbar.tsx
git commit -m "feat: add Wallet page with PulsePoints balance, Paystack redemption transparency, and transaction history"
```

---

### Task C2: Quick Tournament creation flow on Profile

**Files:**
- Create: `src/components/tournament/QuickTournamentModal.tsx`
- Modify: `src/pages/Profile.tsx` (trigger button, only on own profile)

**Interfaces:**
- Consumes: `useWallet` (Task A1), `useGames` (existing, `src/hooks/useGames.ts`).
- Uses the same insert pattern as `src/pages/TournamentCreateNew.tsx` line 712: `supabase.from('tournaments').insert({...})`.

- [ ] **Step 1: Build the modal**

Use the existing `Dialog`/`DialogContent` primitives from `src/components/ui/dialog.tsx` (same ones used elsewhere, e.g. `Tournaments.tsx` pre-Task-B1). Required fields/behavior, in order:
1. Game selector — `<Select>` from `src/components/ui/select.tsx`, options from `useGames()`.
2. Entry fee input with preset buttons (e.g. `[0, 50, 100, 250, 500]` PP) that set the numeric input value on click, plus free-text override.
3. Required in-game ID text field (`in_game_username`, matches the column name already used in `TournamentCreateNew.tsx`'s participant/type shapes) — Create button stays disabled while this is empty.
4. Live payout preview: a small panel showing "Your Balance: `{balance}` PP" vs "Winner Gets: `{entryFee * maxPlayers}` PP" (mirror whatever prize-pool-from-entry-fee formula `TournamentCreateNew.tsx` already uses if one exists — check its `review`/summary step; if it computes prize pool from entry fee elsewhere, reuse that exact formula instead of inventing a new one).
5. Create button: `disabled={balance < entryFee || !gameId || !inGameId}`. When disabled specifically because of insufficient balance, show inline text "Insufficient balance" with a `<Link to="/wallet">Top up</Link>` CTA next to the button.
6. On submit: insert into `tournaments` with the minimal required columns (`name`, `game_id`, `entry_fee`, `max_players`, `created_by`, plus whatever NOT NULL columns `TournamentCreateNew.tsx`'s insert call sets — read that call in full before writing this insert so required columns aren't missed) and `toast.success(...)` + close modal + `navigate` to the new tournament's `/tournaments/:id` page (Task B1).

- [ ] **Step 2: Wire the trigger on Profile**

In `src/pages/Profile.tsx`, near the existing profile header actions (around lines 480-483, where `EditPanel`/edit button live), add a "Quick Tournament" button visible only when `isOwnProfile` is true, opening `QuickTournamentModal`.

- [ ] **Step 3: Build + smoke test + commit**

```bash
npm run build
```
Manual: sign in, go to own `/profile`, open Quick Tournament modal, confirm preset buttons populate the fee field, confirm Create is disabled without an in-game ID, confirm the balance-vs-payout preview updates live as the fee changes.
```bash
git add src/components/tournament/QuickTournamentModal.tsx src/pages/Profile.tsx
git commit -m "feat: add Quick Tournament creation flow to Profile page"
```

---

### Task C3: Add Win Rate %, Matches Played, PP Balance to Profile stats

**Files:**
- Modify: `src/pages/Profile.tsx` (stat row, lines 515-528)

**Interfaces:**
- Consumes: `useWallet` (Task A1) for PP balance; derives Matches Played / Win Rate from the existing `tourneyEntries` array already fetched in this file (same array used at line 519-520 for the "Tournaments"/"Wins" tiles — do not add a new query, compute from data already in memory).

- [ ] **Step 1: Compute the two new derived values**

Near where `tourneyEntries` is defined/used (around line 519), add:
```typescript
const matchesPlayed = tourneyEntries.filter(e => e.status === 'winner' || e.status === 'runner_up' || e.status === 'eliminated' || e.status === 'completed').length; // adjust status list to match whatever completed-match statuses actually exist on tourneyEntries — check the type/query this array comes from before finalizing
const wins = tourneyEntries.filter(e => e.status === 'winner').length;
const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;
const { balance: ppBalance } = useWallet(profile?.id);
```
(Read the `tourneyEntries` fetch query above line 515 first — confirm the actual set of `status` values it can hold, since the placeholder list above is a guess that must be corrected against the real enum before merging.)

- [ ] **Step 2: Extend the stat grid**

Change the grid from 4 to 7 tiles (expand `grid-cols-2 sm:grid-cols-4` to also handle 7 items gracefully, e.g. `grid-cols-2 sm:grid-cols-4 lg:grid-cols-7`), adding three entries to the existing array literal at line 516-521:
```typescript
{ icon: Target,   label: 'Win Rate',       value: `${winRate}%`,      color: 'text-purple-400' },
{ icon: Swords,   label: 'Matches Played', value: matchesPlayed,      color: 'text-blue-400' },
{ icon: Gem,      label: 'PP Balance',     value: ppBalance.toLocaleString(), color: 'text-emerald-400' },
```
Add `Target`, `Swords`, `Gem` to the `lucide-react` import at the top of the file if not already imported (check the existing import line first — some may already be present, e.g. `Swords` is used in `GameDetail.tsx` so confirm whether it's already imported here too).

- [ ] **Step 3: Build + smoke test + commit**

```bash
npm run build
```
Manual: visit `/profile`, confirm 7 stat tiles render without layout overflow on mobile width (375px) and desktop.
```bash
git add src/pages/Profile.tsx
git commit -m "feat: add Win Rate, Matches Played, and PP Balance to Profile stats"
```

---

### Task C4: Check-in / result window "Key Info" block on tournament detail

**Files:**
- Modify: `src/pages/TournamentDetail.tsx`

**Context:** `TournamentFull` (type defined lines 25-36) already includes `check_in_open: string | null; check_in_close: string | null;` — the data is fetched but not necessarily surfaced as a distinct, labeled info block. There is no `result_window_hours` column confirmed in the schema; do not invent one — if no result-submission-window field exists in the `tournaments` table, surface only the check-in window plus a static, honest rule line ("Results must be submitted within 48 hours of match completion — disputes after this window may not be reviewable.") rather than fabricating a per-tournament DB-backed field that doesn't exist.

- [ ] **Step 1: Add a "Key Info" panel**

Find the tournament header/overview section of `TournamentDetail.tsx` (near where `prize_pool`, `entry_fee`, `max_players` etc. are already displayed). Add a distinct panel:
```tsx
<div className="rounded-2xl bg-white/5 border border-white/10 p-4 sm:p-5">
  <h3 className="font-orbitron font-bold text-sm text-white mb-3 flex items-center gap-2">
    <Info className="w-4 h-4 text-cyan-400" /> Key Info
  </h3>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
    <div>
      <div className="text-white/40 text-xs mb-0.5">Check-in Window</div>
      <div className="text-white font-medium">
        {tournament.check_in_open && tournament.check_in_close
          ? `${format(new Date(tournament.check_in_open), 'MMM d, h:mm a')} – ${format(new Date(tournament.check_in_close), 'h:mm a')}`
          : 'No check-in required for this tournament'}
      </div>
    </div>
    <div>
      <div className="text-white/40 text-xs mb-0.5">Result Submission</div>
      <div className="text-white font-medium">Within 48 hours of match completion</div>
    </div>
  </div>
</div>
```
(`Info` and `format` are already imported in this file — `Info` at line 7, `format`/`formatDistanceToNow` from `date-fns` at line 15. Use the actual local variable name the file uses for the fetched tournament object, e.g. `tournament` — confirm against the surrounding code rather than assuming.)

- [ ] **Step 2: Build + smoke test + commit**

```bash
npm run build
```
Manual: visit a tournament's `/tournaments/:id` page (post Task B1), confirm the Key Info panel renders with either real check-in times or the "not required" fallback.
```bash
git add src/pages/TournamentDetail.tsx
git commit -m "feat: surface check-in window and result-submission rule on tournament detail page"
```

---

## Track D — Content, Copy & Trust Signaling

### Task D1: Replace fabricated stats/timeline copy on About page

**Files:**
- Modify: `src/pages/About.tsx` (lines 7-12 `stats`, lines 38-43 `timeline`)

**Interfaces:**
- Consumes: `getPlatformStats` from Task A2.

- [ ] **Step 1: Wire real numbers into the `stats` tiles**

Replace the hardcoded array (lines 7-12) with a component that fetches `getPlatformStats()` on mount and renders live values, keeping the same 4-tile layout/labels but sourcing values from data:
```typescript
const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
useEffect(() => { getPlatformStats().then(setPlatformStats); }, []);

const stats = [
  { value: platformStats ? `${platformStats.activeGamers.toLocaleString()}+` : '—', label: 'Active Gamers',      icon: Users },
  { value: platformStats ? `${platformStats.tournamentsHosted.toLocaleString()}+` : '—', label: 'Tournaments Hosted', icon: Trophy },
  { value: platformStats ? `₦${platformStats.totalPrizePool.toLocaleString()}` : '—', label: 'Total Prize Pool',   icon: DollarSign },
  { value: platformStats ? `${platformStats.partnerGames}+` : '—', label: 'Partner Games',      icon: Gamepad2 },
];
```
(Move this from module scope into the `About()` function body since it now depends on state; keep `icon`/`label` identical to preserve existing layout code below that maps over `stats`.)

- [ ] **Step 2: Soften the timeline copy**

Replace the numeric claims in the `timeline` array (lines 38-43) that assert specific historical milestones not backed by any query ("First 1,000 Players", "₦1M in Prizes Distributed") with narrative framing that doesn't assert unverifiable exact figures, e.g.:
```typescript
const timeline = [
  { year: '2024',      title: 'PulsePlay Founded',      description: 'A small team of mobile gaming enthusiasts launched PulsePlay with a single goal: make competitive mobile gaming accessible to everyone.', current: false },
  { year: 'Early 2025', title: 'First Tournament Series', description: 'Our inaugural tournament series went live across CODM and eFootball, kicking off a growing player community.', current: false },
  { year: 'Mid 2025',  title: 'Real Cash Prizes',        description: 'Players started earning real cash through PulsePlay tournaments, proving mobile gaming can be a legitimate competitive pursuit.', current: false },
  { year: 'Now',       title: 'Growing Every Week',       description: 'With an active and growing community across multiple games, PulsePlay is just getting started.', current: true },
];
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/pages/About.tsx
git commit -m "fix: replace fabricated About page stats/timeline with real data and honest copy"
```

---

### Task D2: Fix footer legal links + add compliance copy

**Files:**
- Modify: `src/components/layout/Footer.tsx`

- [ ] **Step 1: Fix the Legal links (lines 28-35)**

```typescript
{
  title: 'Legal',
  links: [
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Privacy Policy',   href: '/privacy' },
    { label: 'Contact Us',       href: '/about' },
  ],
},
```
(Confirm `/terms` → `src/pages/Terms.tsx` and `/privacy` → `src/pages/Privacy.tsx` are both already routed in `App.tsx` — they are, per the exploration findings. "Contact Us" stays at `/about` only if that page has a contact section/CTA; if it doesn't, point it at a `mailto:` link using the support address instead — check `About.tsx` before finalizing.)

- [ ] **Step 2: Add compliance copy to the bottom bar**

In the bottom bar (lines 96-105), add a line beneath the copyright/status row:
```tsx
<p className="text-muted-foreground text-[11px] text-center sm:text-left mt-2 sm:mt-0 sm:ml-4">
  18+ to participate in cash tournaments. PulsePlay is not affiliated with or endorsed by the publishers of the games featured on this platform.
</p>
```
Place it so it reads cleanly on both mobile (stacked) and desktop (inline with the copyright row) — adjust the flex layout of the bottom bar container minimally if needed rather than breaking existing alignment.

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/components/layout/Footer.tsx
git commit -m "fix: correct footer legal links and add compliance disclaimer copy"
```

---

### Task D3: Paystack-branded copy on the homepage Fraud Protection card

**Files:**
- Modify: `src/pages/Home.tsx` (`hostingFeatures` array, lines 47-68)

**Context:** This is a light copy touch, not a redesign — do not touch icons/layout (icon differentiation across trust cards is a MED item, out of scope for this pass).

- [ ] **Step 1: Add one Paystack-naming line**

Add a 5th entry to `hostingFeatures` (or extend the existing "Fraud Protection" card's description) naming Paystack as the payout rail, e.g. extend the description at line 61:
```typescript
{
  icon: Lock,
  title: 'Fraud Protection',
  description: 'Advanced monitoring detects suspicious patterns before they impact your community. Payouts are processed securely through Paystack.',
},
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/pages/Home.tsx
git commit -m "content: name Paystack as the payout rail in homepage trust copy"
```

---

## Track E — QA & Verification Pass

### Task E1: Full-repo audit + build/lint verification

**Files:** No new files — this is a verification task across the repo.

- [ ] **Step 1: Grep for remaining hardcoded stat-shaped numbers**

Run: `grep -rnE "₦[0-9]|[0-9]+K\+|[0-9]+M\+" src/pages src/components` (or the `Grep` tool with the same pattern) and manually confirm every remaining hit is either (a) rendering a real variable, or (b) intentionally-scoped-out copy (nothing from Tracks A-D should still be a bare literal in JSX text).

- [ ] **Step 2: Confirm no icon-font/tofu-box risk was introduced**

Run: `grep -rn "font-face\|icomoon\|Font Awesome" src public index.html` — expected zero matches (codebase is lucide-react SVG-only per the exploration; this step just guards against regression).

- [ ] **Step 3: Confirm no remaining `/about` mislinks for Terms/Privacy**

Run: `grep -rn "Terms of Service\|Privacy Policy" src/components src/pages` and confirm every match's `href`/`to` points to `/terms` or `/privacy`, not `/about`.

- [ ] **Step 4: Lint + build**

```bash
npm run lint
npm run build
```
Expected: both exit 0. Fix any errors surfaced by the new code from Tracks A-D before proceeding.

- [ ] **Step 5: Playwright smoke check (manual or scripted)**

Using the existing `e2e/` Playwright setup, manually verify (or add a quick spec if time allows) these flows in a running `npm run dev` session:
1. `/games` → click "Play" on any card → lands on that game's hub with Tournaments tab active (Task B2).
2. `/tournaments` → click a card → lands on `/tournaments/<id>` full page, not a modal (Task B1).
3. Signed-in `/wallet` → balance and transaction list/empty-state render (Task C1).
4. Signed-in `/profile` (own) → 7 stat tiles render, Quick Tournament button opens the modal (Tasks C2/C3).
5. `/tournaments/<id>` → Key Info panel renders (Task C4).
6. Footer → Terms/Privacy links go to the correct dedicated pages, compliance line is visible (Task D2).

- [ ] **Step 6: Commit any QA-driven fixes**

```bash
git add -A
git commit -m "fix: QA pass fixes for launch-readiness changes"
```
(Only if QA actually found something to fix — otherwise this step is a no-op, do not create an empty commit.)

---

## Execution Order

Tracks A → B → C → D can mostly run in parallel once Track A lands (C1-C3 depend on A1; B3/D1 depend on A2). Suggested dispatch:
1. Track A (A1, A2) — one agent, must land first.
2. Track B (B1, B2, B3) + Track C (C1-C4) + Track D (D1-D3) — three agents in parallel once Track A is merged, since they touch mostly disjoint files (only overlap: B1 touches `App.tsx`/`Tournaments.tsx`, C1 also touches `App.tsx` — sequence C1's `App.tsx` edit after B1's, or hand both to the same agent to avoid a merge conflict on that one file).
3. Track E — last, after everything above lands.
