import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trophy, Film, Users, ArrowLeft } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface ActionButton {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  to?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  show?: boolean;
}

interface MobileStickyActionsProps {
  actions: ActionButton[];
  showBack?: boolean;
  backLabel?: string;
}

export function MobileStickyActions({ 
  actions, 
  showBack = false,
  backLabel = 'Back'
}: MobileStickyActionsProps): React.ReactElement | null {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Filter visible actions
  const visibleActions = actions.filter(a => a.show !== false);
  
  if (visibleActions.length === 0 && !showBack) return null;

  return (
    <>
      {/* Spacer for fixed bottom actions */}
      <div className="h-20 sm:hidden" />
      
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 sm:hidden"
      >
        <div className="px-4 py-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
          <div className="flex items-center gap-3">
            {showBack && (
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium backdrop-blur-sm border border-white/10 active:scale-95 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{backLabel}</span>
              </button>
            )}
            
            <div className="flex-1 flex items-center justify-end gap-2">
              {visibleActions.map((action, index) => {
                const Icon = action.icon;
                const isPrimary = action.variant === 'primary';
                
                const buttonContent = (
                  <motion.button
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={action.onClick}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium backdrop-blur-sm transition-all active:scale-95 min-h-[44px]',
                      isPrimary 
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-cyan-500/25' 
                        : 'bg-white/10 text-white border border-white/10'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{action.label}</span>
                  </motion.button>
                );

                if (action.to) {
                  return (
                    <Link key={action.label} to={action.to}>
                      {buttonContent}
                    </Link>
                  );
                }

                return <React.Fragment key={action.label}>{buttonContent}</React.Fragment>;
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// Pre-configured action sets for common pages
export function TournamentActions({ 
  onRegister, 
  onWithdraw, 
  onViewLive,
  isRegistered = false,
  isLive = false,
  isAuthenticated = false 
}: {
  onRegister?: () => void;
  onWithdraw?: () => void;
  onViewLive?: () => void;
  isRegistered?: boolean;
  isLive?: boolean;
  isAuthenticated?: boolean;
}): React.ReactElement {
  const actions: ActionButton[] = [
    {
      icon: Trophy,
      label: isRegistered ? 'Withdraw' : 'Register',
      onClick: isRegistered ? onWithdraw : onRegister,
      variant: isRegistered ? 'secondary' : 'primary',
      show: isAuthenticated,
    },
    {
      icon: Trophy,
      label: 'View Live',
      onClick: onViewLive,
      variant: 'secondary',
      show: isLive,
    },
  ];

  return <MobileStickyActions actions={actions} showBack />;
}

export function ClipActions({
  onVote,
  onSubmit,
  isAuthenticated = false,
}: {
  onVote?: () => void;
  onSubmit?: () => void;
  isAuthenticated?: boolean;
}): React.ReactElement {
  const actions: ActionButton[] = [
    {
      icon: Plus,
      label: 'Submit Clip',
      onClick: onSubmit,
      variant: 'primary',
      show: isAuthenticated,
    },
  ];

  return <MobileStickyActions actions={actions} showBack />;
}

export function ClubActions({
  onJoin,
  onLeave,
  onCreate,
  isMember = false,
  isAuthenticated = false,
}: {
  onJoin?: () => void;
  onLeave?: () => void;
  onCreate?: () => void;
  isMember?: boolean;
  isAuthenticated?: boolean;
}): React.ReactElement {
  const actions: ActionButton[] = [
    {
      icon: isMember ? Users : Plus,
      label: isMember ? 'Leave Club' : 'Join Club',
      onClick: isMember ? onLeave : onJoin,
      variant: isMember ? 'danger' : 'primary',
      show: isAuthenticated && !isMember,
    },
    {
      icon: Plus,
      label: 'Create Club',
      onClick: onCreate,
      variant: 'primary',
      show: isAuthenticated && !isMember,
    },
  ];

  return <MobileStickyActions actions={actions} showBack />;
}
