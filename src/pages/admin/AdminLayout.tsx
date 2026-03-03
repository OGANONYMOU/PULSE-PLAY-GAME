import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { Loader2, Shield, LayoutDashboard, Users, LogOut, ChevronRight, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users, exact: false },
];

export function AdminLayout() {
  const { isAdmin, isLoading, signOut, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
        <p className="text-white/50 text-sm">Verifying access...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const avatarLetter = profile?.username ? profile.username[0].toUpperCase() : 'A';

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen ? (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      ) : null}

      {/* Sidebar */}
      <aside className={'fixed top-0 left-0 h-full w-64 z-40 bg-card/95 border-r border-white/10 flex flex-col backdrop-blur-xl transition-transform duration-300 ' + (sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}>
        <div className="p-5 border-b border-white/10">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-orbitron font-bold text-sm text-white">PulsePay</div>
              <div className="text-xs text-white/40">Admin Panel</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = item.exact ? location.pathname === item.href : location.pathname.startsWith(item.href);
            const cls = active
              ? 'flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/10 border border-cyan-500/30 text-cyan-400'
              : 'flex items-center gap-3 px-4 py-3 rounded-xl text-white/50 hover:bg-white/5 hover:text-white transition-all';
            return (
              <Link key={item.href} to={item.href} onClick={() => setSidebarOpen(false)} className={cls}>
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">{item.label}</span>
                {active ? <ChevronRight className="w-4 h-4 ml-auto" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold font-orbitron">
              {avatarLetter}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{profile?.username}</div>
              <div className="text-xs text-cyan-400">{profile?.role}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}
            className="w-full justify-start text-white/50 hover:text-red-400 hover:bg-red-500/10">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 min-h-screen">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 p-4 border-b border-white/10 bg-card/80 backdrop-blur-xl sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg bg-white/5 text-white">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-orbitron font-bold text-sm text-white">Admin Panel</span>
        </div>
        <Outlet />
      </div>
    </div>
  );
}