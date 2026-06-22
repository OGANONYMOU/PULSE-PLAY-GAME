import React, { useState } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Users, Gamepad2, LogOut,
  ChevronRight, ChevronLeft, Menu, X, BarChart2, Settings,
  Megaphone, Trophy, FileText, ClipboardList,
  Search, Zap, Tag, Building2, UserCheck,
  ShieldAlert, MessageSquare, AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AdminProvider } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/admin',           label: 'Dashboard',    Icon: LayoutDashboard, exact: true },
      { href: '/admin/analytics', label: 'Analytics',    Icon: BarChart2 },
      { href: '/admin/incidents', label: 'Incidents',    Icon: AlertTriangle, badge: 'Live' },
    ],
  },
  {
    label: 'Trust & Safety',
    items: [
      { href: '/admin/moderation',  label: 'Moderation',    Icon: ShieldAlert },
      { href: '/admin/users',      label: 'Users',         Icon: Users },
      { href: '/admin/audit',       label: 'Audit Log',     Icon: ClipboardList },
    ],
  },
  {
    label: 'Tournament Ops',
    items: [
      { href: '/admin/tournaments',  label: 'Tournaments',   Icon: Trophy },
      { href: '/admin/organizers',  label: 'Organizers',    Icon: Building2 },
      { href: '/admin/permissions', label: 'Permissions',   Icon: UserCheck },
    ],
  },
  {
    label: 'Community',
    items: [
      { href: '/admin/community',   label: 'Community',     Icon: MessageSquare },
      { href: '/admin/posts',        label: 'Posts',         Icon: FileText },
      { href: '/admin/announcements', label: 'Announcements', Icon: Megaphone },
      { href: '/admin/games',        label: 'Games',         Icon: Gamepad2 },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/loyalty',  label: 'Loyalty Codes', Icon: Tag },
      { href: '/admin/settings', label: 'Settings', Icon: Settings },
    ],
  },
];

const ALL_NAV = NAV_GROUPS.flatMap(g => g.items);

export function AdminLayout(): React.ReactElement {
  const { isAdmin, isLoading, signOut, profile } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed]   = useState(false);
  const [searchQ, setSearchQ]       = useState('');

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background gap-4 flex-col">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20 border border-cyan-500/30 flex items-center justify-center">
            <Shield className="w-7 h-7 text-cyan-400" />
          </div>
          <div className="absolute inset-0 rounded-2xl border-2 border-cyan-500/40 animate-ping" />
        </div>
        <p className="text-white/30 text-sm font-mono">Verifying access…</p>
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const initial = profile?.username?.[0]?.toUpperCase() ?? 'A';
  const isSuper = profile?.role === 'ADMIN';
  const roleCls = isSuper
    ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';

  const currentPage = ALL_NAV.find(n =>
    (n as { exact?: boolean }).exact
      ? location.pathname === n.href
      : location.pathname.startsWith(n.href)
  );

  const filtered = searchQ.length >= 2
    ? ALL_NAV.filter(n => n.label.toLowerCase().includes(searchQ.toLowerCase()))
    : [];

  // ── Sidebar inner content ─────────────────────────────────────────────────
  const SidebarInner = ({ mobile = false }) => (
    <>
      {/* Brand */}
      <div className={`flex items-center p-5 border-b border-white/8 ${collapsed && !mobile ? 'justify-center' : 'gap-3'}`}>
        <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {(!collapsed || mobile) && (
            <div>
              <div className="font-orbitron font-black text-sm text-white leading-tight">PulsePlay</div>
              <div className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase">Admin</div>
            </div>
          )}
        </Link>
        {!mobile && (
          <button onClick={() => setCollapsed(p => !p)}
            className="ml-auto p-1.5 rounded-lg hover:bg-white/8 text-white/25 hover:text-white/60 transition-all flex-shrink-0">
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        )}
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/70 transition-all">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search */}
      {(!collapsed || mobile) && (
        <div className="px-3 pt-3 pb-1 relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
            <Input placeholder="Quick search…" value={searchQ} onChange={e => setSearchQ(e.target.value)}
              className="pl-8 h-8 text-xs bg-white/5 border-white/8 text-white placeholder:text-white/20 focus:border-cyan-500/40" />
          </div>
          {searchQ.length >= 2 && filtered.length > 0 && (
            <div className="absolute left-3 right-3 top-full mt-0.5 z-50 rounded-xl bg-card border border-white/12 overflow-hidden shadow-2xl">
              {filtered.map(n => (
                <Link key={n.href} to={n.href} onClick={() => { setSearchQ(''); setMobileOpen(false); }}
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 text-sm text-white/55 hover:text-white transition-colors border-b border-white/5 last:border-0">
                  <n.Icon className="w-3.5 h-3.5 text-cyan-400" />{n.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto space-y-3">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            {(!collapsed || mobile) && (
              <p className="text-[10px] text-white/18 font-mono uppercase tracking-widest px-3 pb-1.5 pt-0.5">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const isActive = (item as { exact?: boolean }).exact
                  ? location.pathname === item.href
                  : location.pathname.startsWith(item.href);
                const itemBadge = (item as { badge?: string }).badge;
                return (
                  <Link key={item.href} to={item.href} onClick={() => setMobileOpen(false)}
                    title={collapsed && !mobile ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group relative ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500/15 to-purple-500/10 border border-cyan-500/22 text-cyan-400'
                        : 'text-white/38 hover:bg-white/5 hover:text-white/70 border border-transparent'
                    }`}>
                    <item.Icon className={`w-4 h-4 flex-shrink-0 ${!isActive ? 'group-hover:scale-110 transition-transform' : ''}`} />
                    {(!collapsed || mobile) && (
                      <>
                        <span className="text-sm font-medium flex-1 truncate">{item.label}</span>
                        {itemBadge && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                            {itemBadge}
                          </Badge>
                        )}
                        {isActive && !itemBadge && <ChevronRight className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Profile */}
      <div className="p-4 border-t border-white/8">
        {(!collapsed || mobile) ? (
          <>
            <div className="flex items-center gap-3 px-2 mb-3">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-black font-orbitron flex-shrink-0">{initial}</div>
              }
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{profile?.username}</div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${roleCls}`}>{profile?.role}</span>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Link to="/" className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-white/35 hover:text-white/60 hover:bg-white/5 transition-all">
                <Zap className="w-3 h-3" />App
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut}
                className="flex-1 text-white/35 hover:text-red-400 hover:bg-red-500/8 h-7 text-xs">
                <LogOut className="w-3 h-3 mr-1" />Sign Out
              </Button>
            </div>
          </>
        ) : (
          <button onClick={handleSignOut} title="Sign Out"
            className="w-full flex justify-center p-2 rounded-xl hover:bg-red-500/10 text-white/25 hover:text-red-400 transition-all">
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </>
  );

  return (
    <AdminProvider>
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setMobileOpen(false)} />
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex fixed top-0 left-0 h-full z-40 flex-col border-r border-white/8 bg-card/98 backdrop-blur-2xl transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
        {/* eslint-disable-next-line react-hooks/static-components */}
        <SidebarInner />
      </aside>

      {/* Mobile sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-72 z-40 flex flex-col lg:hidden border-r border-white/8 bg-card/98 backdrop-blur-2xl transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* eslint-disable-next-line react-hooks/static-components */}
        <SidebarInner mobile />
      </aside>

      {/* Main */}
      <div className={`flex-1 min-h-screen flex flex-col transition-all duration-300 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        {/* Topbar */}
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 lg:px-6 py-3 border-b border-white/8 bg-card/90 backdrop-blur-xl">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white/22 hidden sm:block font-mono text-xs">Admin</span>
            {currentPage && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-white/15 hidden sm:block" />
                <span className="font-medium text-white/65 text-sm">{currentPage.label}</span>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/18">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-mono">Live</span>
            </div>
            <Link to="/" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 text-white/38 hover:text-white/65 transition-all text-xs border border-white/8">
              <Zap className="w-3.5 h-3.5" /><span>View App</span>
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
    </AdminProvider>
  );
}