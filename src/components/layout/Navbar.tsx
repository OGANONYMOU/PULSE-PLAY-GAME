import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, Sun, Moon, User, LogOut, Shield, Bell, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { prefetchRoute } from '@/App';

const navLinks = [
  { href: '/',            label: 'Home' },
  { href: '/games',       label: 'Games' },
  { href: '/community',   label: 'Community' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/about',       label: 'About' },
];

// ── Brand logo component ────────────────────────────────────────────────────
function BrandLogo({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'w-10 h-10' : 'w-8 h-8';
  return (
    <div className={`${dim} rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-white/10`}>
      <img src="/pulseplay-logo.jpg" alt="PulsePlay" className="w-full h-full object-cover object-center" />
    </div>
  );
}

// ── Smart scroll-hide / reveal hook ────────────────────────────────────────
function useNavScroll() {
  const [visible, setVisible] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const handle = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;
        setAtTop(y < 20);
        if (y < 60) {
          setVisible(true);
        } else if (delta > 8) {
          setVisible(false);
        } else if (delta < -8) {
          setVisible(true);
        }
        lastY.current = y;
        ticking.current = false;
      });
    };
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  return { visible, atTop };
}

// ── Mobile slide-in drawer ──────────────────────────────────────────────────
interface DrawerProps {
  open: boolean; onClose: () => void;
  isAuthenticated: boolean; isAdmin: boolean;
  handleSignOut: () => void;
  avatarSrc: string;
  profile: { username?: string; email?: string } | null;
}
function MobileDrawer({ open, onClose, isAuthenticated, isAdmin, handleSignOut, avatarSrc, profile }: DrawerProps) {
  const location = useLocation();
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden"
            onClick={onClose} />

          <motion.aside key="drawer"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-72 bg-[#08080f]/98 border-l border-white/8 backdrop-blur-2xl flex flex-col lg:hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8">
              <div className="flex items-center gap-3">
                <BrandLogo />
                <span className="font-orbitron text-sm font-black gradient-text tracking-wide">PulsePlay</span>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/6 hover:bg-white/12 flex items-center justify-center text-white/40 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
              {navLinks.map((link, i) => {
                const active = location.pathname === link.href;
                return (
                  <motion.div key={link.href}
                    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.18 }}>
                    <Link to={link.href} onClick={onClose}
                      className={'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ' +
                        (active
                          ? 'bg-gradient-to-r from-cyan-500/15 to-purple-500/8 text-cyan-400 border border-cyan-500/20'
                          : 'text-white/45 hover:bg-white/5 hover:text-white border border-transparent')}>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />}
                      {link.label}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            {/* Auth footer */}
            <div className="flex-shrink-0 border-t border-white/8 px-3 py-4 space-y-1">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-2.5 mb-1">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={avatarSrc} />
                      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-[10px] font-bold">
                        {profile?.username?.[0]?.toUpperCase() ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{profile?.username}</p>
                      <p className="text-[10px] text-white/35 truncate">{profile?.email}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Link to="/admin" onClick={onClose}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-cyan-400 hover:bg-cyan-500/10 transition-all">
                      <Shield className="w-4 h-4" />Admin Panel
                    </Link>
                  )}
                  <Link to="/profile" onClick={onClose}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/50 hover:bg-white/5 hover:text-white transition-all">
                    <User className="w-4 h-4" />Profile
                  </Link>
                  <button onClick={handleSignOut}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all w-full text-left">
                    <LogOut className="w-4 h-4" />Sign Out
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button asChild variant="outline" size="sm"
                    className="border-white/15 text-white hover:bg-white/8 text-xs font-bold uppercase tracking-wider h-11 rounded-xl">
                    <Link to="/signin" onClick={onClose}>Sign In</Link>
                  </Button>
                  <Button asChild size="sm"
                    className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold uppercase tracking-wider h-11 rounded-xl">
                    <Link to="/register" onClick={onClose}>Join Free</Link>
                  </Button>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Navbar ──────────────────────────────────────────────────────────────────
export function Navbar(): React.ReactElement {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { visible, atTop } = useNavScroll();
  const { profile, isAuthenticated, isAdmin, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleSignOut = useCallback(async () => {
    setMobileOpen(false);
    await signOut();
  }, [signOut]);

  const avatarSrc = profile?.avatar_url
    ?? `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.username ?? 'U'}&backgroundColor=0f172a`;

  return (
    <>
      <motion.header
        animate={{ y: visible ? 0 : -100, opacity: visible ? 1 : 0 }}
        transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
        className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
        style={{ willChange: 'transform, opacity' }}
      >
        <motion.div
          animate={{ paddingLeft: atTop ? '12px' : '20px', paddingRight: atTop ? '12px' : '20px' }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="pt-3"
        >
          <motion.nav
            animate={{
              borderRadius: atTop ? '16px' : '24px',
              boxShadow: atTop
                ? '0 0 0 0 rgba(0,0,0,0)'
                : '0 8px 40px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={
              'pointer-events-auto flex items-center gap-2 px-3 py-2 transition-colors duration-300 ' +
              (atTop
                ? 'bg-[#0a0a14]/70 backdrop-blur-xl border border-white/8'
                : 'bg-[#0a0a14]/94 backdrop-blur-2xl border border-white/10')
            }
          >
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0"
              onMouseEnter={() => prefetchRoute('/')}>
              <div className="relative group-hover:scale-105 transition-transform duration-200">
                <BrandLogo />
                <div className="absolute inset-0 rounded-xl bg-cyan-500/20 blur-lg opacity-0 group-hover:opacity-60 transition-opacity" />
              </div>
              <span className="font-orbitron text-[13px] font-black gradient-text hidden sm:block select-none">
                PulsePlay
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
              {navLinks.map((link) => {
                const active = location.pathname === link.href;
                return (
                  <Link key={link.href} to={link.href}
                    onMouseEnter={() => prefetchRoute(link.href)}
                    className={
                      'relative px-3.5 py-1.5 rounded-xl text-[13px] font-semibold transition-all duration-150 select-none ' +
                      (active ? 'text-white bg-white/8' : 'text-white/40 hover:text-white/80 hover:bg-white/5')
                    }>
                    {link.label}
                    {active && (
                      <motion.span layoutId="nav-pip"
                        className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1 ml-auto flex-shrink-0">
              <button onClick={toggleTheme}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white/35 hover:text-white hover:bg-white/8 transition-all"
                aria-label="Toggle theme">
                {theme === 'dark'
                  ? <Sun className="w-3.5 h-3.5 text-yellow-400" />
                  : <Moon className="w-3.5 h-3.5 text-purple-400" />}
              </button>

              {isAuthenticated ? (
                <>
                  <button className="hidden sm:flex relative w-8 h-8 rounded-xl items-center justify-center text-white/35 hover:text-white hover:bg-white/8 transition-all" aria-label="Notifications">
                    <Bell className="w-3.5 h-3.5" />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 ring-2 ring-[#0a0a14]" />
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-xl hover:bg-white/8 transition-all focus:outline-none group">
                        <div className="h-7 w-7 rounded-lg overflow-hidden border border-cyan-500/35 group-hover:border-cyan-400/60 transition-all">
                          <Avatar className="h-full w-full">
                            <AvatarImage src={avatarSrc} alt={profile?.username} />
                            <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-[10px] font-bold">
                              {profile?.username?.[0]?.toUpperCase() ?? 'U'}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <ChevronDown className="w-3 h-3 text-white/25 group-hover:text-white/50 transition-colors hidden sm:block" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-[#0c0c18]/98 border-white/10 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/70 p-1.5" align="end" sideOffset={10} forceMount>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={avatarSrc} />
                          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-[10px]">
                            {profile?.username?.[0]?.toUpperCase() ?? 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <p className="text-xs font-bold text-white truncate">{profile?.username}</p>
                          <p className="text-[10px] text-white/35 truncate">{profile?.email}</p>
                        </div>
                      </div>
                      <DropdownMenuSeparator className="bg-white/8 mx-0.5 my-1" />
                      {isAdmin && (
                        <DropdownMenuItem asChild>
                          <Link to="/admin" className="cursor-pointer text-cyan-400 focus:text-cyan-300 focus:bg-cyan-500/10 rounded-xl text-xs font-semibold gap-2">
                            <Shield className="h-3.5 w-3.5" />Admin Panel
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link to="/profile" className="cursor-pointer focus:bg-white/8 rounded-xl text-xs font-semibold gap-2 text-white/65">
                          <User className="h-3.5 w-3.5" />Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/8 mx-0.5 my-1" />
                      <DropdownMenuItem onClick={handleSignOut}
                        className="cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10 rounded-xl text-xs font-semibold gap-2">
                        <LogOut className="h-3.5 w-3.5" />Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <div className="hidden sm:flex items-center gap-1.5">
                  <Button asChild variant="ghost" size="sm"
                    className="text-white/50 hover:text-white hover:bg-white/8 text-[11px] font-bold uppercase tracking-wider h-8 px-3 rounded-xl">
                    <Link to="/signin">Sign In</Link>
                  </Button>
                  <Button asChild size="sm"
                    className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold uppercase tracking-wider text-[11px] h-8 px-3.5 rounded-xl shadow-md shadow-cyan-500/25">
                    <Link to="/register">Join Free</Link>
                  </Button>
                </div>
              )}

              <button className="lg:hidden w-8 h-8 rounded-xl flex items-center justify-center border border-white/10 hover:bg-white/8 text-white/45 hover:text-white transition-all"
                onClick={() => setMobileOpen(v => !v)} aria-label="Open menu">
                <Menu className="w-4 h-4" />
              </button>
            </div>
          </motion.nav>
        </motion.div>
      </motion.header>

      <MobileDrawer
        open={mobileOpen} onClose={() => setMobileOpen(false)}
        isAuthenticated={isAuthenticated} isAdmin={isAdmin}
        handleSignOut={handleSignOut} avatarSrc={avatarSrc} profile={profile}
      />
    </>
  );
}
