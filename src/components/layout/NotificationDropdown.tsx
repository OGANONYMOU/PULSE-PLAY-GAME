import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCheck, Trophy, Heart, Repeat2, Users, Zap, Award, Info } from 'lucide-react';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

const TYPE_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  like            : { icon: Heart,   color: 'text-red-400',    bg: 'bg-red-500/12'    },
  comment         : { icon: Zap,     color: 'text-cyan-400',   bg: 'bg-cyan-500/12'   },
  repost          : { icon: Repeat2, color: 'text-green-400',  bg: 'bg-green-500/12'  },
  follow          : { icon: Users,   color: 'text-purple-400', bg: 'bg-purple-500/12' },
  tournament_join : { icon: Trophy,  color: 'text-yellow-400', bg: 'bg-yellow-500/12' },
  match_start     : { icon: Trophy,  color: 'text-orange-400', bg: 'bg-orange-500/12' },
  achievement     : { icon: Award,   color: 'text-yellow-400', bg: 'bg-yellow-500/12' },
  system          : { icon: Info,    color: 'text-white/50',   bg: 'bg-white/8'       },
};

function NotifRow({ notif, onRead }: { notif: Notification; onRead: (id: string) => void }) {
  const meta = TYPE_META[notif.type] ?? TYPE_META.system;
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      onClick={() => !notif.is_read && onRead(notif.id)}
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-white/4 border-b border-white/5 last:border-0 ${!notif.is_read ? 'bg-white/3' : ''}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${meta.bg}`}>
        <Icon className={`w-4 h-4 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold leading-tight ${notif.is_read ? 'text-white/50' : 'text-white'}`}>{notif.title}</p>
        {notif.body && <p className="text-[11px] text-white/35 mt-0.5 line-clamp-2">{notif.body}</p>}
        <p className="text-[10px] text-white/25 mt-1">{formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}</p>
      </div>
      {!notif.is_read && <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0 mt-2" />}
    </motion.div>
  );
}

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const { notifications, unreadCount, markRead } = useNotifications();
  const [open, setOpen] = useState(false);

  if (!isAuthenticated) return (
    <button className="hidden sm:flex relative w-8 h-8 rounded-xl items-center justify-center text-white/35 hover:text-white hover:bg-white/8 transition-all" aria-label="Notifications">
      <Bell className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <div className="relative hidden sm:block">
      <button onClick={() => { setOpen(v => !v); if (!open && unreadCount > 0) markRead(); }}
        className="relative w-8 h-8 rounded-xl flex items-center justify-center text-white/35 hover:text-white hover:bg-white/8 transition-all"
        aria-label="Notifications">
        <Bell className="w-3.5 h-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center px-0.5 ring-2 ring-[#0a0a14]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }} transition={{ duration: 0.15 }}
              className="absolute right-0 top-11 z-50 w-80 bg-[#0c0c1a]/98 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden backdrop-blur-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <span className="font-orbitron font-bold text-xs text-white">Notifications</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button onClick={() => markRead()} className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1">
                      <CheckCheck className="w-3 h-3" />Mark all read
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <Bell className="w-8 h-8 text-white/15 mb-3" />
                    <p className="text-white/35 text-xs">No notifications yet</p>
                    <p className="text-white/20 text-[10px] mt-1">Activity will appear here</p>
                  </div>
                ) : (
                  notifications.map(n => <NotifRow key={n.id} notif={n} onRead={markRead} />)
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
