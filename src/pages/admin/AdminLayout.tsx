import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Users, Gamepad2, LogOut,
  ChevronRight, Menu, X, Loader2, BarChart2, Settings,
  Trophy, Megaphone, FileText, Zap, TrendingUp, ChevronLeft,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

const NAV_MAIN = [
  { href: '/admin',           label: 'Dashboard',  Icon: LayoutDashboard, exact: true },
  { href: '/admin/analytics', label: 'Analytics',  Icon: BarChart2 },
];
const NAV_CONTENT = [
  { href: '/admin/users',         label: 'Users',         Icon: Users },
  { href: '/admin/tournaments',   label: 'Tournaments',   Icon: Trophy },
  { href: '/admin/games',         label: 'Games',         Icon: Gamepad2 },
  { href: '/admin/updates',       label: 'Updates & News', Icon: Activity },
  { href: '/admin/posts',         label: 'Posts',         Icon: FileText },
  { href: '/admin/announcements', label: 'Announcements', Icon: Megaphone },
];
const NAV_SYSTEM = [
  { href: '/admin/settings', label: 'Settings', Icon: Settings },
];

interface AdminLevel {
  name: string; emoji: string; min: number; max: number;
  color: string; barFrom: string; barTo: string;
}
const LEVELS: AdminLevel[] = [
  { name: 'Recruit',     emoji: '🥉', min: 0,    max: 499,      color: 'text-orange-400', barFrom: '#f97316', barTo: '#fbbf24' },
  { name: 'Sergeant',    emoji: '🥈', min: 500,  max: 1499,     color: 'text-slate-300',  barFrom: '#94a3b8', barTo: '#e2e8f0' },
  { name: 'Lieutenant',  emoji: '🥇', min: 1500, max: 3499,     color: 'text-yellow-400', barFrom: '#eab308', barTo: '#fde047' },
  { name: 'Commander',   emoji: '💎', min: 3500, max: 6999,     color: 'text-cyan-400',   barFrom: '#06b6d4', barTo: '#818cf8' },
  { name: 'GrandMaster', emoji: '👑', min: 7000, max: Infinity, color: 'text-pink-400',   barFrom: '#ec4899', barTo: '#a855f7' },
];
function getLevel(xp: number) { return LEVELS.find(l => xp >= l.min && xp <= l.max) ?? LEVELS[0]; }
function getLevelPct(xp: number, lvl: AdminLevel) {
  if (lvl.max === Infinity) return 100;
  return Math.min(100, Math.round(((xp - lvl.min) / (lvl.max - lvl.min)) * 100));
}

interface Badge { id: string; label: string; emoji: string; desc: string; threshold: number; metric: 'users' | 'posts' | 'tournaments' | 'announcements' | 'games' }
const BADGES: Badge[] = [
  { id: 'first-cmd',   label: 'Commander',   emoji: '🎖️', desc: 'Managed 1+ user',           threshold: 1,  metric: 'users' },
  { id: 'post-patrol', label: 'Post Patrol', emoji: '📋', desc: 'Moderated 10+ posts',        threshold: 10, metric: 'posts' },
  { id: 'host',        label: 'Host',        emoji: '🏆', desc: 'Created 5+ tournaments',     threshold: 5,  metric: 'tournaments' },
  { id: 'broadcaster', label: 'Broadcaster', emoji: '📣', desc: '10+ announcements published', threshold: 10, metric: 'announcements' },
  { id: 'game-warden', label: 'Game Warden', emoji: '🎮', desc: 'Added 5+ games',             threshold: 5,  metric: 'games' },
];

interface AdminMetrics { users: number; posts: number; tournaments: number; announcements: number; games: number; xp: number }
async function loadMetrics(): Promise<AdminMetrics> {
  const [u, p, t, a, g] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'USER'),
    supabase.from('posts').select('*', { count: 'exact', head: true }),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }),
    supabase.from('announcements').select('*', { count: 'exact', head: true }),
    supabase.from('games').select('*', { count: 'exact', head: true }),
  ]);
  const users = u.count ?? 0, posts = p.count ?? 0, tournaments = t.count ?? 0;
  const announcements = a.count ?? 0, games = g.count ?? 0;
  const xp = users * 10 + posts * 5 + tournaments * 25 + announcements * 20 + games * 15;
  return { users, posts, tournaments, announcements, games, xp };
}

// ── Loyalty bar ────────────────────────────────────────────────────────────
function SidebarLoyaltyBar({ metrics, collapsed }: { metrics: AdminMetrics | null; collapsed: boolean }): React.ReactElement {
  const xp = metrics?.xp ?? 0;
  const lvl = getLevel(xp);
  const pct = getLevelPct(xp, lvl);
  const nextLvl = LEVELS[LEVELS.indexOf(lvl) + 1];
  const earnedBadges = metrics ? BADGES.filter(b => (metrics[b.metric] as number) >= b.threshold) : [];

  if (collapsed) return (
    <div className="px-2 pb-3 border-t border-white/8 pt-3 flex flex-col items-center gap-2">
      <span className="text-base" title={`${lvl.name} · ${xp} XP`}>{lvl.emoji}</span>
      <div className="w-1 h-10 rounded-full bg-white/8 overflow-hidden">
        <div className="w-full rounded-full transition-all duration-1000"
          style={{ height: pct + '%', background: `linear-gradient(180deg, ${lvl.barFrom}, ${lvl.barTo})` }} />
      </div>
    </div>
  );

  return (
    <div className="p-4 border-t border-white/8 space-y-3">
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
      <div className="group relative">
        <div className="h-2 rounded-full bg-white/8 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
            style={{ width: pct + '%', background: `linear-gradient(90deg, ${lvl.barFrom}, ${lvl.barTo})` }}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full animate-[shimmerBar_2s_ease-in-out_infinite]" />
          </div>
        </div>
        {nextLvl && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-card border border-white/10 text-[10px] text-white/60 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
            <span className="text-white font-bold">{nextLvl.max - xp > 0 ? (nextLvl.max - xp + 1).toLocaleString() : '0'} XP</span> to {nextLvl.emoji} {nextLvl.name}
          </div>
        )}
      </div>
      {earnedBadges.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {earnedBadges.map(b => <span key={b.id} title={b.desc} className="text-sm cursor-help">{b.emoji}</span>)}
        </div>
      )}
    </div>
  );
}

// ── Nav link ───────────────────────────────────────────────────────────────
function NavLink({ item, pathname, onClick, collapsed }: {
  item: { href: string; label: string; Icon: React.ComponentType<{ className?: string }>; exact?: boolean };
  pathname: string; onClick: () => void; collapsed: boolean;
}): React.ReactElement {
  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  return (
    <Link
      to={item.href} onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={
        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group border relative ' +
        (collapsed ? 'justify-center !px-0' : '') + ' ' +
        (isActive
          ? 'bg-gradient-to-r from-cyan-500/15 to-purple-500/8 border-cyan-500/25 text-cyan-400'
          : 'text-white/40 hover:bg-white/5 hover:text-white/80 border-transparent')
      }
    >
      <item.Icon className={'w-[18px] h-[18px] flex-shrink-0 transition-transform ' + (!isActive ? 'group-hover:scale-110' : '')} />
      {!collapsed && <span className="text-[13px] font-medium flex-1 leading-none whitespace-nowrap">{item.label}</span>}
      {!collapsed && isActive && <ChevronRight className="w-3 h-3 opacity-50" />}
      {collapsed && (
        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#0d0d1a] border border-white/15 rounded-lg text-xs text-white whitespace-nowrap
          opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-xl transition-all duration-150 translate-x-1 group-hover:translate-x-0">
          {item.label}
        </div>
      )}
    </Link>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="h-px bg-white/8 mx-2 my-1" />;
  return <p className="text-[9px] text-white/20 font-mono uppercase tracking-[0.18em] px-3 pb-1.5">{label}</p>;
}

// ── Main layout ────────────────────────────────────────────────────────────
export function AdminLayout(): React.ReactElement {
  const { isAdmin, isLoading, signOut, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [topbarScrolled, setTopbarScrolled] = useState(false);
  const [topbarVisible, setTopbarVisible] = useState(true);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollY = useRef(0);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  useEffect(() => { closeMobile(); }, [location.pathname, closeMobile]);
  useEffect(() => { loadMetrics().then(setMetrics).catch(() => {}); }, []);

  const handleMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(true), 80);
  };
  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(false), 200);
  };

  // Hide mobile topbar on scroll down, reveal on scroll up
  useEffect(() => {
    const el = document.getElementById('admin-scroll-area');
    if (!el) return;
    const onScroll = () => {
      const y = el.scrollTop;
      setTopbarScrolled(y > 10);
      if (y < 40) { setTopbarVisible(true); }
      else if (y > lastScrollY.current + 8) { setTopbarVisible(false); }
      else if (y < lastScrollY.current - 8) { setTopbarVisible(true); }
      lastScrollY.current = y;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
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
  const desktopExpanded = !collapsed || hovered;
  const sidebarW = desktopExpanded ? 'w-60' : 'w-[60px]';
  const contentMl = desktopExpanded ? 'lg:ml-60' : 'lg:ml-[60px]';

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const isExpanded = isMobile || desktopExpanded;
    return (
      <div className="flex flex-col h-full">
        {/* Brand */}
        <div className={'flex-shrink-0 border-b border-white/8 transition-all duration-300 ' + (isExpanded ? 'p-4' : 'p-2 pt-4')}>
          {isExpanded ? (
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-3 group" onClick={closeMobile}>
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 blur-lg opacity-25 group-hover:opacity-50 transition-opacity" />
                </div>
                <div>
                  <div className="font-orbitron font-black text-[13px] text-white leading-tight">PulsePlay</div>
                  <div className="text-[9px] text-cyan-400 font-mono tracking-[0.2em] uppercase">Admin Console</div>
                </div>
              </Link>
              {!isMobile && (
                <button onClick={() => setCollapsed(c => !c)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/25 hover:text-white/60 transition-all flex-shrink-0"
                  title={collapsed ? 'Pin sidebar open' : 'Auto-collapse'}>
                  <ChevronLeft className={'w-3.5 h-3.5 transition-transform duration-200 ' + (collapsed ? 'rotate-180' : '')} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Link to="/" className="group" title="PulsePlay Admin">
                <div className="w-9 h-9 rounded-xl overflow-hidden ring-1 ring-white/10 group-hover:ring-cyan-500/40 group-hover:scale-105 transition-all">
                  <img src="/pulseplay-logo.jpg" alt="PulsePlay" className="w-full h-full object-cover object-center" />
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={'flex-1 overflow-y-auto overflow-x-hidden space-y-3 py-3 ' + (isExpanded ? 'px-3' : 'px-2')}>
          <div className="space-y-0.5">
            <SectionLabel label="Overview" collapsed={!isExpanded} />
            {NAV_MAIN.map(item => <NavLink key={item.href} item={item} pathname={location.pathname} onClick={closeMobile} collapsed={!isExpanded} />)}
          </div>
          <div className="space-y-0.5">
            <SectionLabel label="Management" collapsed={!isExpanded} />
            {NAV_CONTENT.map(item => <NavLink key={item.href} item={item} pathname={location.pathname} onClick={closeMobile} collapsed={!isExpanded} />)}
          </div>
          <div className="space-y-0.5">
            <SectionLabel label="System" collapsed={!isExpanded} />
            {NAV_SYSTEM.map(item => <NavLink key={item.href} item={item} pathname={location.pathname} onClick={closeMobile} collapsed={!isExpanded} />)}
            <Link to="/" title={!isExpanded ? 'Back to App' : undefined}
              className={'flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/35 hover:bg-white/5 hover:text-white/70 transition-all border border-transparent group relative ' + (!isExpanded ? 'justify-center !px-0' : '')}>
              <TrendingUp className="w-[18px] h-[18px] flex-shrink-0 group-hover:scale-110 transition-transform" />
              {isExpanded && <span className="text-[13px] font-medium whitespace-nowrap">Back to App</span>}
              {!isExpanded && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#0d0d1a] border border-white/15 rounded-lg text-xs text-white whitespace-nowrap
                  opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-xl transition-all duration-150 translate-x-1 group-hover:translate-x-0">
                  Back to App
                </div>
              )}
            </Link>
          </div>
        </nav>

        {/* Profile */}
        <div className={'flex-shrink-0 border-t border-white/8 ' + (isExpanded ? 'p-4' : 'p-2')}>
          {isExpanded ? (
            <>
              <div className="flex items-center gap-3 px-2 mb-3">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-black font-orbitron">{initial}</div>
                  <div className="absolute -bottom-0.5 -right-0.5 text-xs leading-none">{lvl.emoji}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate leading-tight">{profile?.username}</div>
                  <span className={'text-[9px] font-bold ' + lvl.color}>{lvl.name} · {xp.toLocaleString()} XP</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut}
                className="w-full justify-start text-white/35 hover:text-red-400 hover:bg-red-500/8 h-8 text-xs gap-2">
                <LogOut className="w-3.5 h-3.5" />Sign Out
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="relative group cursor-pointer" title={`${profile?.username} · ${lvl.name}`}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-black font-orbitron">{initial}</div>
                <div className="absolute -bottom-0.5 -right-0.5 text-xs leading-none">{lvl.emoji}</div>
              </div>
              <button onClick={handleSignOut} title="Sign Out"
                className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/25 hover:text-red-400 transition-all">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <SidebarLoyaltyBar metrics={metrics} collapsed={!isExpanded} />
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-background">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden" onClick={closeMobile} />
      )}

      {/* Mobile drawer sidebar */}
      <aside className={
        'fixed top-0 left-0 h-full w-64 z-40 flex flex-col ' +
        'border-r border-white/8 bg-[#0a0a14]/98 backdrop-blur-2xl ' +
        'transition-transform duration-300 ease-in-out lg:hidden ' +
        (mobileOpen ? 'translate-x-0' : '-translate-x-full')
      }>
        <SidebarContent isMobile />
      </aside>

      {/* Desktop icon-rail sidebar — expands on hover */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={
          'hidden lg:flex flex-col fixed top-0 left-0 h-full z-40 ' +
          'border-r border-white/8 bg-[#0a0a14]/98 backdrop-blur-2xl ' +
          'transition-all duration-300 ease-in-out overflow-hidden ' +
          sidebarW
        }
      >
        <SidebarContent />
      </aside>

      {/* Main content area */}
      <div className={'flex-1 min-h-screen flex flex-col transition-all duration-300 ' + contentMl}>

        {/* ── Mobile floating topbar pill ─────────────────────────────── */}
        {/* Sits in a NON-FIXED wrapper at the top — takes up real space */}
        <div className="lg:hidden relative z-20 flex-shrink-0">
          {/* This div takes up space so content is never hidden under the topbar */}
          <div className="h-14" />
          {/* The pill itself floats above but is positioned relative to this wrapper */}
          <div className={
            'absolute top-2 left-0 right-0 flex justify-center transition-all duration-300 ' +
            (topbarVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-12 pointer-events-none')
          }>
            <div className={
              'flex items-center gap-2 px-3 py-2 rounded-2xl border backdrop-blur-2xl shadow-2xl transition-all duration-300 ' +
              (topbarScrolled
                ? 'bg-[#0a0a14]/95 border-white/15 shadow-black/60'
                : 'bg-[#0a0a14]/80 border-white/10 shadow-black/40')
            }>
              <button
                onClick={() => setMobileOpen(o => !o)}
                className={'w-8 h-8 rounded-xl flex items-center justify-center transition-all ' +
                  (mobileOpen ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/6 hover:bg-white/12 text-white/60 hover:text-white')}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
              <div className="w-px h-5 bg-white/10" />
              <div className="w-5 h-5 rounded-md overflow-hidden flex-shrink-0 ring-1 ring-white/15"><img src="/pulseplay-logo.jpg" alt="PulsePlay" className="w-full h-full object-cover" /></div>
              <span className="font-orbitron font-bold text-[11px] text-white tracking-wide">Admin</span>
              <div className="w-px h-5 bg-white/10" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs leading-none">{lvl.emoji}</span>
                <div className="w-14 h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: getLevelPct(xp, lvl) + '%', background: `linear-gradient(90deg, ${lvl.barFrom}, ${lvl.barTo})` }} />
                </div>
                <span className={'text-[9px] font-bold font-mono ' + lvl.color}>{getLevelPct(xp, lvl)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content — starts AFTER the topbar spacer on mobile, immediately on desktop */}
        <div id="admin-scroll-area" className="flex-1 overflow-auto overflow-x-hidden">
          <Outlet />
        </div>
      </div>

      <style>{`
        @keyframes shimmerBar {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
