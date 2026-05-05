import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Gamepad2, Trophy, Film, MessageSquare, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/games', label: 'Games', icon: Gamepad2 },
  { href: '/tournaments', label: 'Tournaments', icon: Trophy },
  { href: '/clips', label: 'Clips', icon: Film },
  { href: '/community', label: 'Community', icon: MessageSquare },
  { href: '/profile', label: 'Profile', icon: User },
];

export function MobileBottomNav(): React.ReactElement | null {
  const location = useLocation();

  // Don't show on admin routes
  if (location.pathname.startsWith('/admin')) return null;
  
  // Don't show on auth pages
  if (['/signin', '/register', '/auth/callback'].includes(location.pathname)) return null;

  // Check if current path matches nav item (including partial matches for detail pages)
  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <>
      {/* Spacer for fixed bottom nav - safe area aware */}
      <div className="h-[calc(4rem+env(safe-area-inset-bottom))] sm:hidden" />
      
      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed bottom-0 left-0 right-0 z-50 sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="glass border-t border-white/10 bg-black/80 backdrop-blur-xl">
          <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 min-w-[3rem] h-14 rounded-xl transition-all duration-200',
                    active 
                      ? 'text-cyan-400 bg-cyan-500/10' 
                      : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                  )}
                >
                  <div className="relative">
                    <Icon className={cn(
                      'w-5 h-5 transition-transform duration-200',
                      active && 'scale-110'
                    )} />
                    {active && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400"
                      />
                    )}
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium transition-all duration-200',
                    active ? 'opacity-100' : 'opacity-70'
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </motion.nav>
    </>
  );
}
