import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, Sun, Moon, Gamepad2, User, LogOut, Shield, Bell } from 'lucide-react';
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
  { href: '/', label: 'Home' },
  { href: '/games', label: 'Games' },
  { href: '/community', label: 'Community' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/about', label: 'About' },
];

export function Navbar(): React.ReactElement {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { profile, isAuthenticated, isAdmin, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Add shadow + blur intensification on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSignOut = async () => {
    setIsMobileMenuOpen(false);
    await signOut();
  };

  const avatarSrc = profile?.avatar_url
    ?? `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.username ?? 'U'}&backgroundColor=0f172a`;

  return (
    <header className={'fixed top-0 left-0 right-0 z-50 transition-all duration-300 ' + (scrolled ? 'py-0' : 'py-0')}>
      <nav className="mx-3 mt-3">
        <div className={'glass rounded-2xl px-5 py-3.5 transition-all duration-300 ' + (scrolled ? 'shadow-lg shadow-black/30' : '')}>
          <div className="flex items-center justify-between gap-4">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                  <Gamepad2 className="w-5 h-5 text-white" />
                </div>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 blur-lg opacity-40 group-hover:opacity-70 transition-opacity" />
              </div>
              <span className="font-orbitron text-lg font-bold gradient-text hidden sm:block select-none">PulsePay</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden lg:flex items-center gap-7">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onMouseEnter={() => prefetchRoute(link.href)}
                  className={'nav-link ' + (location.pathname === link.href ? 'active' : '')}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">

              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="rounded-full w-9 h-9 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                aria-label="Toggle theme"
              >
                {theme === 'dark'
                  ? <Sun className="w-4 h-4 text-yellow-400" />
                  : <Moon className="w-4 h-4 text-purple-400" />
                }
              </Button>

              {/* Auth */}
              {isAuthenticated ? (
                <>
                  {/* Notification bell — placeholder */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden sm:flex rounded-full w-9 h-9 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all relative"
                    aria-label="Notifications"
                  >
                    <Bell className="w-4 h-4 text-white/60" />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="relative h-9 w-9 rounded-full border-2 border-cyan-500/50 overflow-hidden hover:border-cyan-400 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                        <Avatar className="h-full w-full">
                          <AvatarImage src={avatarSrc} alt={profile?.username} />
                          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-xs font-bold">
                            {profile?.username?.[0]?.toUpperCase() ?? 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 glass border-white/10" align="end" forceMount>
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
                      {isAdmin ? (
                        <DropdownMenuItem asChild>
                          <Link to="/admin" className="cursor-pointer text-cyan-400 focus:text-cyan-300 focus:bg-cyan-500/10">
                            <Shield className="mr-2 h-4 w-4" />Admin Panel
                          </Link>
                        </DropdownMenuItem>
                      ) : null}
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
                <div className="hidden sm:flex items-center gap-2">
                  <Button asChild variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10 text-xs font-bold uppercase tracking-wider">
                    <Link to="/signin">Sign In</Link>
                  </Button>
                  <Button asChild size="sm" className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold uppercase tracking-wider text-xs px-4">
                    <Link to="/register">Join Free</Link>
                  </Button>
                </div>
              )}

              {/* Mobile hamburger */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden w-9 h-9 border border-white/10 hover:bg-white/10 rounded-xl"
                onClick={() => setIsMobileMenuOpen(v => !v)}
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isMobileMenuOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="lg:hidden mt-2"
            >
              <div className="glass rounded-2xl p-4 space-y-1 border border-white/10">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={'flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all ' +
                      (location.pathname === link.href
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        : 'text-white/60 hover:bg-white/5 hover:text-white')}
                  >
                    {link.label}
                  </Link>
                ))}
                {!isAuthenticated ? (
                  <div className="flex gap-2 pt-2 border-t border-white/10 mt-2">
                    <Button asChild variant="outline" size="sm" className="flex-1 border-white/20 text-white hover:bg-white/10 text-xs font-bold uppercase">
                      <Link to="/signin">Sign In</Link>
                    </Button>
                    <Button asChild size="sm" className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold uppercase">
                      <Link to="/register">Join Free</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-white/10 mt-2 space-y-1">
                    {isAdmin ? (
                      <Link to="/admin" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-cyan-400 hover:bg-cyan-500/10 transition-all">
                        <Shield className="w-4 h-4" />Admin Panel
                      </Link>
                    ) : null}
                    <Link to="/profile" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/60 hover:bg-white/5 hover:text-white transition-all">
                      <User className="w-4 h-4" />Profile
                    </Link>
                    <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all w-full text-left">
                      <LogOut className="w-4 h-4" />Sign Out
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </nav>
    </header>
  );
}