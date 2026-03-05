import React, { useState } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Shield, LayoutDashboard, Users, Gamepad2,
  LogOut, ChevronRight, Menu, X, Loader2,
  BarChart2, Settings,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/admin',           label: 'Dashboard',  Icon: LayoutDashboard, exact: true },
  { href: '/admin/analytics', label: 'Analytics',  Icon: BarChart2,       exact: false },
  { href: '/admin/users',     label: 'Users',      Icon: Users,           exact: false },
  { href: '/admin/games',     label: 'Games',      Icon: Gamepad2,        exact: false },
];

export function AdminLayout(): React.ReactElement {
  const { isAdmin, isLoading, signOut, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
        <p className="text-white/40 text-sm font-mono">Verifying access…</p>
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const initial = profile?.username ? profile.username[0].toUpperCase() : 'A';
  const roleBadge = profile?.role === 'ADMIN'
    ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';

  return (
    <div className="min-h-screen flex bg-background">

      {/* Overlay */}
      {open ? (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden" onClick={() => setOpen(false)} />
      ) : null}

      {/* Sidebar */}
      <aside className={
        'fixed top-0 left-0 h-full w-64 z-40 flex flex-col transition-transform duration-300 ease-in-out ' +
        'border-r border-white/8 bg-card/98 backdrop-blur-2xl ' +
        (open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
      }>
        {/* Brand */}
        <div className="p-5 border-b border-white/8">
          <Link to="/" className="flex items-center gap-3 group" onClick={() => setOpen(false)}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-orbitron font-black text-sm text-white leading-tight">PulsePay</div>
              <div className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase">Admin Console</div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest px-3 pb-2 pt-1">Navigation</p>
          {NAV.map((item) => {
            // Special-case dashboard: only active on exact /admin
            const isActive = item.href === '/admin'
              ? location.pathname === '/admin'
              : location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setOpen(false)}
                className={
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ' +
                  (isActive
                    ? 'bg-gradient-to-r from-cyan-500/15 to-purple-500/10 border border-cyan-500/25 text-cyan-400'
                    : 'text-white/45 hover:bg-white/5 hover:text-white/80 border border-transparent')
                }
              >
                <item.Icon className={'w-4 h-4 flex-shrink-0 transition-transform duration-150 ' + (isActive ? '' : 'group-hover:scale-110')} />
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {isActive ? <ChevronRight className="w-3.5 h-3.5 opacity-60" /> : null}
              </Link>
            );
          })}

          <div className="pt-3 mt-3 border-t border-white/8">
            <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest px-3 pb-2">Settings</p>
            <Link
              to="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/45 hover:bg-white/5 hover:text-white/80 transition-all border border-transparent"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Back to App</span>
            </Link>
          </div>
        </nav>

        {/* Profile footer */}
        <div className="p-4 border-t border-white/8">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-black font-orbitron flex-shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{profile?.username}</div>
              <span className={'text-[10px] px-1.5 py-0.5 rounded border font-bold ' + roleBadge}>
                {profile?.role}
              </span>
            </div>
          </div>
          <Button
            variant="ghost" size="sm" onClick={handleSignOut}
            className="w-full justify-start text-white/40 hover:text-red-400 hover:bg-red-500/8 transition-all h-8 text-xs"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-card/90 backdrop-blur-xl sticky top-0 z-20">
          <button
            onClick={() => setOpen(true)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all"
            aria-label="Open menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Shield className="w-4 h-4 text-cyan-400" />
          <span className="font-orbitron font-bold text-sm text-white">Admin Console</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-white/30 hidden sm:block">{profile?.username}</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}