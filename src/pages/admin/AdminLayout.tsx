import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Users, Gamepad2, LogOut,
  ChevronRight, Menu, X, Loader2, BarChart2, Settings,
  Trophy, Megaphone, FileText, Zap,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

// ── Navigation items ──────────────────────────────────────────────────────────
const NAV_MAIN = [
  { href: '/admin',                label: 'Dashboard',     Icon: LayoutDashboard, exact: true },
  { href: '/admin/analytics',      label: 'Analytics',     Icon: BarChart2 },
];
const NAV_CONTENT = [
  { href: '/admin/users',          label: 'Users',         Icon: Users },
  { href: '/admin/tournaments',    label: 'Tournaments',   Icon: Trophy },
  { href: '/admin/games',          label: 'Games',         Icon: Gamepad2 },
  { href: '/admin/posts',          label: 'Posts',         Icon: FileText },
  { href: '/admin/announcements',  label: 'Announcements', Icon: Megaphone },
];
const NAV_SYSTEM = [
  { href: '/admin/settings',       label: 'Settings',      Icon: Settings },
];

// ── Admin level thresholds ─────────────────────────────────────────────────
interface AdminLevel {
  name: string; emoji: string; min: number; max: number;
  color: string; barFrom: string; barTo: string;
}
const LEVELS: AdminLevel[] = [
  { name: 'Recruit',    emoji: '🥉', min: 0,    max: 499,   color: 'text-orange-400',  barFrom: '#f97316', barTo: '#fbbf24' },
  { name: 'Sergeant',   emoji: '🥈', min: 500,  max: 1499,  color: 'text-slate-300',   barFrom: '#94a3b8', barTo: '#e2e8f0' },
  { name: 'Lieutenant', emoji: '🥇', min: 1500, max: 3499,  color: 'text-yellow-400',  barFrom: '#eab308', barTo: '#fde047' },
  { name: 'Commander',  emoji: '💎', min: 3500, max: 6999,  color: 'text-cyan-400',    barFrom: '#06b6d4', barTo: '#818cf8' },
  { name: 'GrandMaster',emoji: '👑', min: 7000, max: Infinity, color: 'text-pink-400', barFrom: '#ec4899', barTo: '#a855f7' },
];

function getLevel(xp: number): AdminLevel { return LEVELS.find(l => xp >= l.min && xp <= l.max) ?? LEVELS[0]; }
function getLevelPct(xp: number, lvl: AdminLevel): number {
  if (lvl.max === Infinity) return 100;
  return Math.min(100, Math.round(((xp - lvl.min) / (lvl.max - lvl.min)) * 100));
}

// ── Badge definitions ────────────────────────────────────────────────────────
interface Badge { id: string; label: string; emoji: string; desc: string; threshold: number; metric: 'users' | 'posts' | 'tournaments' | 'announcements' | 'games' }
const BADGES: Badge[] = [
  { id: 'first-cmd',    label: 'Commander',   emoji: '🎖️', desc: 'Managed 1+ user',          threshold: 1,  metric: 'users' },
  { id: 'post-patrol',  label: 'Post Patrol', emoji: '📋', desc: 'Moderated 10+ posts',       threshold: 10, metric: 'posts' },
  { id: 'host',         label: 'Host',        emoji: '🏆', desc: 'Created 5+ tournaments',    threshold: 5,  metric: 'tournaments' },
  { id: 'broadcaster',  label: 'Broadcaster', emoji: '📣', desc: 'Published 10+ announcements', threshold: 10, metric: 'announcements' },
  { id: 'game-warden',  label: 'Game Warden', emoji: '🎮', desc: 'Added 5+ games',            threshold: 5,  metric: 'games' },
];

// ── Metrics loader ────────────────────────────────────────────────────────────
interface AdminMetrics { users: number; posts: number; tournaments: number; announcements: number; games: number; xp: number }

async function loadMetrics(): Promise<AdminMetrics> {
  const [u, p, t, a, g] = await Promise.all([
    // Count only USER-role accounts — admins excluded from loyalty XP
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'USER'),
    supabase.from('posts').select('*', { count: 'exact', head: true }),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }),
    supabase.from('announcements').select('*', { count: 'exact', head: true }),
    supabase.from('games').select('*', { count: 'exact', head: true }),
  ]);
  const users = u.count ?? 0;
  const posts = p.count ?? 0;
  const tournaments = t.count ?? 0;
  const announcements = a.count ?? 0;
  const games = g.count ?? 0;
  const xp = users * 10 + posts * 5 + tournaments * 25 + announcements * 20 + games * 15;
  return { users, posts, tournaments, announcements, games, xp };
}

// ── Loyalty bar (sidebar compact) ─────────────────────────────────────────────
function SidebarLoyaltyBar({ metrics }: { metrics: AdminMetrics | null }): React.ReactElement {
  const xp = metrics?.xp ?? 0;
  const lvl = getLevel(xp);
  const pct = getLevelPct(xp, lvl);
  const nextLvl = LEVELS[LEVELS.indexOf(lvl) + 1];

  const earnedBadges = metrics ? BADGES.filter(b => (metrics[b.metric] as number) >= b.threshold) : [];

  return (
    <div className="p-4 border-t border-white/8 space-y-3">
      {/* Level header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{lvl.emoji}</span>
          <div>
            <p className={'text-xs font-black font-orbitron ' + lvl.color}>{lvl.name}</p>
            <p className="text-[10px] text-white/30">{xp.toLocaleString()} XP</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3 text-yellow-400" />
          <span className="text-[10px] text-yellow-400 font-bold">{pct}%</span>
        </div>
      </div>

      {/* Animated loyalty bar */}
      <div className="group relative">
        <div className="h-2 rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
            style={{ width: pct + '%', background: `linear-gradient(90deg, ${lvl.barFrom}, ${lvl.barTo})` }}
          >
            {/* Shimmer sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full animate-[shimmerBar_2s_ease-in-out_infinite]" />
          </div>
        </div>
        {/* Tooltip on hover */}
        {nextLvl && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-card border border-white/10 text-[10px] text-white/60 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
            <span className="text-white font-bold">{nextLvl.max - xp > 0 ? (nextLvl.max - xp + 1).toLocaleString() : '0'} XP</span> to {nextLvl.emoji} {nextLvl.name}
            <div className="mt-1 text-white/40 space-y-0.5">
              <div>Users managed: <span className="text-cyan-400">{(metrics?.users ?? 0) * 10} XP</span></div>
              <div>Tournaments: <span className="text-purple-400">{(metrics?.tournaments ?? 0) * 25} XP</span></div>
              <div>Posts: <span className="text-pink-400">{(metrics?.posts ?? 0) * 5} XP</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Earned badges */}
      {earnedBadges.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {earnedBadges.map(b => (
            <span key={b.id} title={b.desc} className="text-sm cursor-help" role="img" aria-label={b.label}>
              {b.emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Nav link ─────────────────────────────────────────────────────────────────
function NavLink({ item, pathname, onClick }: {
  item: { href: string; label: string; Icon: React.ComponentType<{ className?: string }>; exact?: boolean };
  pathname: string; onClick: () => void;
}): React.ReactElement {
  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  return (
    <Link
      to={item.href} onClick={onClick}
      className={
        'flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 group border ' +
        (isActive
          ? 'bg-gradient-to-r from-cyan-500/15 to-purple-500/8 border-cyan-500/25 text-cyan-400'
          : 'text-white/40 hover:bg-white/5 hover:text-white/75 border-transparent')
      }
    >
      <item.Icon className={'w-4 h-4 flex-shrink-0 ' + (isActive ? '' : 'group-hover:scale-110 transition-transform')} />
      <span className="text-[13px] font-medium flex-1 leading-none">{item.label}</span>
      {isActive ? <ChevronRight className="w-3 h-3 opacity-50" /> : null}
    </Link>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────
export function AdminLayout(): React.ReactElement {
  const { isAdmin, isLoading, signOut, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => { close(); }, [location.pathname, close]);

  useEffect(() => {
    loadMetrics().then(setMetrics).catch(() => {});
  }, []);

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  if (isLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
      <p className="text-white/40 text-sm font-mono tracking-widest">Verifying access…</p>
    </div>
  );

  if (!isAdmin) return <Navigate to="/" replace />;

  const initial = profile?.username?.[0]?.toUpperCase() ?? 'A';
  const xp = metrics?.xp ?? 0;
  const lvl = getLevel(xp);

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="p-5 border-b border-white/8 flex-shrink-0">
        <Link to="/" className="flex items-center gap-3 group" onClick={close}>
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 blur-lg opacity-30 group-hover:opacity-60 transition-opacity" />
          </div>
          <div>
            <div className="font-orbitron font-black text-[13px] text-white leading-tight">PulsePay</div>
            <div className="text-[9px] text-cyan-400 font-mono tracking-[0.2em] uppercase">Admin Console</div>
          </div>
        </Link>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 p-3 overflow-y-auto space-y-4">
        <div className="space-y-0.5">
          <p className="text-[9px] text-white/20 font-mono uppercase tracking-[0.15em] px-3 pb-1.5">Overview</p>
          {NAV_MAIN.map(item => <NavLink key={item.href} item={item} pathname={location.pathname} onClick={close} />)}
        </div>
        <div className="space-y-0.5">
          <p className="text-[9px] text-white/20 font-mono uppercase tracking-[0.15em] px-3 pb-1.5">Management</p>
          {NAV_CONTENT.map(item => <NavLink key={item.href} item={item} pathname={location.pathname} onClick={close} />)}
        </div>
        <div className="space-y-0.5">
          <p className="text-[9px] text-white/20 font-mono uppercase tracking-[0.15em] px-3 pb-1.5">System</p>
          {NAV_SYSTEM.map(item => <NavLink key={item.href} item={item} pathname={location.pathname} onClick={close} />)}
          <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-xl text-white/40 hover:bg-white/5 hover:text-white/75 transition-all border border-transparent">
            <TrendingUp className="w-4 h-4" />
            <span className="text-[13px] font-medium">Back to App</span>
          </Link>
        </div>
      </nav>

      {/* Admin profile */}
      <div className="flex-shrink-0 p-4 border-t border-white/8">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-black font-orbitron">
              {initial}
            </div>
            <div className={'absolute -bottom-0.5 -right-0.5 text-xs leading-none'}>{lvl.emoji}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate leading-tight">{profile?.username}</div>
            <span className={'text-[9px] font-bold ' + lvl.color}>{lvl.name} · {xp.toLocaleString()} XP</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}
          className="w-full justify-start text-white/35 hover:text-red-400 hover:bg-red-500/8 h-8 text-xs gap-2 transition-all">
          <LogOut className="w-3.5 h-3.5" />Sign Out
        </Button>
      </div>

      {/* Loyalty bar */}
      <SidebarLoyaltyBar metrics={metrics} />
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {open ? <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden" onClick={close} /> : null}

      {/* Sidebar */}
      <aside className={
        'fixed top-0 left-0 h-full w-64 z-40 flex flex-col transition-transform duration-300 ease-in-out ' +
        'border-r border-white/8 bg-[#0a0a14]/98 backdrop-blur-2xl ' +
        (open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
      }>
        <SidebarContent />
      </aside>

      {/* Page content */}
      <div className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-card/90 backdrop-blur-xl sticky top-0 z-20">
          <button onClick={() => setOpen(o => !o)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all" aria-label="Toggle menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Shield className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span className="font-orbitron font-bold text-sm text-white">Admin Console</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-white/30 font-mono">{lvl.emoji} {lvl.name}</span>
            <div className="w-14 h-1.5 rounded-full bg-white/8 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: getLevelPct(xp, lvl) + '%', background: `linear-gradient(90deg, ${lvl.barFrom}, ${lvl.barTo})` }} />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto overflow-x-hidden">
          <Outlet />
        </div>
      </div>

      {/* CSS for shimmer keyframe */}
      <style>{`
        @keyframes shimmerBar {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
