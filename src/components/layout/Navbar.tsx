import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, Sun, Moon, Gamepad2, User, LogOut, Shield, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
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

export function Navbar(): React.ReactElement {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const { profile, isAuthenticated, isAdmin, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleSignOut = async () => { setMobileOpen(false); await signOut(); };

  const avatarSrc = profile?.avatar_url
    ?? `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.username ?? 'U'}&backgroundColor=0f172a`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <nav className="mx-2 sm:mx-3 mt-2 sm:mt-3">
        <div className={`glass rounded-2xl px-3 sm:px-5 py-3 transition-all duration-300 ${scrolled ? 'shadow-lg shadow-black/30' : ''}`}>
          <div className="flex items-center justify-between gap-2 sm:gap-4">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
              <div className="relative">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                  <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 blur-lg opacity-40 group-hover:opacity-70 transition-opacity" />
              </div>
              <span className="font-orbitron text-base sm:text-lg font-bold gradient-text hidden sm:block select-none">
                PulsePlay
              </span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden lg:flex items-center gap-5 xl:gap-7">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onMouseEnter={() => prefetchRoute(link.href)}
                  className={`nav-link ${location.pathname === link.href ? 'active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">

              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="rounded-full w-8 h-8 sm:w-9 sm:h-9 border border-white/10 hover:bg-white/10"
                aria-label="Toggle theme"
              >
                {theme === 'dark'
                  ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400" />
                  : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
                }
              </Button>

              {isAuthenticated ? (
                <>
                  {/* Bell — desktop only */}
                  <Button
                    variant="ghost" size="icon"
                    className="hidden sm:flex rounded-full w-9 h-9 border border-white/10 hover:bg-white/10 relative"
                    aria-label="Notifications"
                  >
                    <Bell className="w-4 h-4 text-white/60" />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  </Button>

                  {/* Avatar dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-8 w-8 sm:h-9 sm:w-9 rounded-full border-2 border-cyan-500/50 overflow-hidden hover:border-cyan-400 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 flex-shrink-0">
                        <Avatar className="h-full w-full">
                          <AvatarImage src={avatarSrc} alt={profile?.username} />
                          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs font-bold">
                            {profile?.username?.[0]?.toUpperCase() ?? 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-52 sm:w-56 glass border-white/10" align="end" forceMount>
                      <div className="flex items-center gap-3 p-3">
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarImage src={avatarSrc} />
                          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs">
                            {profile?.username?.[0]?.toUpperCase() ?? 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <p className="text-sm font-bold text-white truncate">{profile?.username}</p>
                          <p className="text-xs text-white/40 truncate">{profile?.email}</p>
                        </div>
                      </div>
                      <DropdownMenuSeparator className="bg-white/10" />
                      {isAdmin && (
                        <DropdownMenuItem asChild>
                          <Link to="/admin" className="cursor-pointer text-cyan-400 focus:text-cyan-300 focus:bg-cyan-500/10">
                            <Shield className="mr-2 h-4 w-4" />Admin Panel
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link to="/profile" className="cursor-pointer focus:bg-white/10">
                          <User className="mr-2 h-4 w-4" />Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/10" />
                      <DropdownMenuItem
                        onClick={handleSignOut}
                        className="cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10"
                      >
                        <LogOut className="mr-2 h-4 w-4" />Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                /* Desktop auth buttons — visible from md upward */
                <div className="hidden md:flex items-center gap-2">
                  <Button asChild variant="ghost" size="sm"
                    className="text-white/70 hover:text-white hover:bg-white/10 text-xs font-bold uppercase tracking-wider h-8 px-3">
                    <Link to="/signin">Sign In</Link>
                  </Button>
                  <Button asChild size="sm"
                    className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold uppercase tracking-wider text-xs px-3 h-8">
                    <Link to="/register">Join Free</Link>
                  </Button>
                </div>
              )}

              {/* Hamburger — shown below lg */}
              <Button
                variant="ghost" size="icon"
                className="lg:hidden w-8 h-8 sm:w-9 sm:h-9 border border-white/10 hover:bg-white/10 rounded-xl flex-shrink-0"
                onClick={() => setMobileOpen(v => !v)}
                aria-label="Toggle menu"
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile menu — full-width overlay panel */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 top-[60px] bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                onClick={() => setMobileOpen(false)}
              />
              {/* Panel */}
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="lg:hidden mt-2 relative z-50"
              >
                <div className="glass rounded-2xl p-3 border border-white/10">
                  {/* Nav links */}
                  <nav className="space-y-1">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        to={link.href}
                        className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                          location.pathname === link.href
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>

                  {/* Auth section */}
                  <div className="mt-2 pt-2 border-t border-white/10">
                    {!isAuthenticated ? (
                      <div className="flex gap-2">
                        <Button asChild variant="outline" size="sm"
                          className="flex-1 border-white/20 text-white hover:bg-white/10 text-xs font-bold uppercase h-10">
                          <Link to="/signin">Sign In</Link>
                        </Button>
                        <Button asChild size="sm"
                          className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold uppercase h-10">
                          <Link to="/register">Join Free</Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {/* User info strip */}
                        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/4">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage src={avatarSrc} />
                            <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs font-bold">
                              {profile?.username?.[0]?.toUpperCase() ?? 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{profile?.username}</p>
                            <p className="text-[10px] text-white/40 truncate">{profile?.email}</p>
                          </div>
                        </div>
                        {isAdmin && (
                          <Link to="/admin" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-cyan-400 hover:bg-cyan-500/10 transition-all">
                            <Shield className="w-4 h-4 flex-shrink-0" />Admin Panel
                          </Link>
                        )}
                        <Link to="/profile" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/60 hover:bg-white/5 hover:text-white transition-all">
                          <User className="w-4 h-4 flex-shrink-0" />Profile
                        </Link>
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all w-full text-left"
                        >
                          <LogOut className="w-4 h-4 flex-shrink-0" />Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}