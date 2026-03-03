import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { Loader2, Shield, LayoutDashboard, Users, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users, exact: false },
];

function NavItem(p: { href: string; label: string; icon: React.ComponentType<{className?: string}>; exact: boolean; current: string }) {
  const active = p.exact ? p.current === p.href : p.current.startsWith(p.href);
  const cls = active
    ? 'flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400'
    : 'flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors';
  return (
    <Link to={p.href} className={cls}>
      <p.icon className="w-5 h-5 flex-shrink-0" />
      <span className="font-medium text-sm">{p.label}</span>
      {active ? <ChevronRight className="w-4 h-4 ml-auto" /> : null}
    </Link>
  );
}

export function AdminLayout() {
  const { isAdmin, isLoading, signOut, profile } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
        <p className="text-muted-foreground text-sm">Verifying access...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const avatarLetter = profile?.username ? profile.username[0].toUpperCase() : 'A';

  return (
    <div className="min-h-screen flex">
      <aside className="fixed top-0 left-0 h-full w-64 z-40 glass border-r border-border/50 flex flex-col">
        <div className="p-6 border-b border-border/50">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-orbitron font-bold text-sm gradient-text">PulsePay</div>
              <div className="text-xs text-muted-foreground">Admin Panel</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              exact={item.exact}
              current={location.pathname}
            />
          ))}
        </nav>
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
              {avatarLetter}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{profile?.username}</div>
              <div className="text-xs text-cyan-400">{profile?.role}</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>
      <div className="flex-1 ml-64 min-h-screen bg-background">
        <Outlet />
      </div>
    </div>
  );
}