import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Sun, Moon, Gamepad2, User, LogOut, Shield } from 'lucide-react';
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

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/games', label: 'Games' },
  { href: '/community', label: 'Community' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/about', label: 'About' },
];

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { profile, isAuthenticated, isAdmin, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <nav className="mx-4 mt-4">
        <div className="glass rounded-2xl px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <motion.div
                whileHover={{ scale: 1.05, rotate: -5 }}
                className="relative"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                  <Gamepad2 className="w-6 h-6 text-white" />
                </div>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
              </motion.div>
              <span className="font-orbitron text-xl font-bold gradient-text hidden sm:block">
                PulsePay
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`nav-link ${location.pathname === link.href ? 'active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="rounded-full border border-border/50 hover:bg-primary/10 hover:border-primary/50 transition-all"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-cyan-400" />
                ) : (
                  <Moon className="w-5 h-5 text-purple-500" />
                )}
              </Button>

              {/* Auth Section */}
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 w-10 rounded-full border-2 border-cyan-500/50 p-0 overflow-hidden"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage
                          src={profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.username}`}
                          alt={profile?.username}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white">
                          {profile?.username?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 glass" align="end" forceMount>
                    <div className="flex items-center gap-2 p-2">
                      <div className="flex flex-col space-y-0.5">
                        <p className="text-sm font-medium">{profile?.username}</p>
                        <p className="text-xs text-muted-foreground">{profile?.email}</p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    {isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="cursor-pointer">
                          <Shield className="mr-2 h-4 w-4" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="cursor-pointer text-red-400 focus:text-red-400"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  asChild
                  className="hidden sm:flex bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-bold uppercase tracking-wider"
                >
                  <Link to="/signin">Sign In</Link>
                </Button>
              )}

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden mt-2"
            >
              <div className="glass rounded-2xl p-4 space-y-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block px-4 py-3 rounded-xl transition-all ${
                      location.pathname === link.href
                        ? 'bg-primary/20 text-cyan-400'
                        : 'hover:bg-muted'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                {!isAuthenticated && (
                  <Button
                    asChild
                    className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-500"
                  >
                    <Link to="/signin" onClick={() => setIsMobileMenuOpen(false)}>
                      Sign In
                    </Link>
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </motion.header>
  );
}
