import React from 'react';
import { motion } from 'framer-motion';
import { getLevelInfo, levelToXp } from '@/hooks/useGamerCred';

interface LevelBadgeProps {
  level: number;
  xp: number;
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  showXp?: boolean;
}

export function LevelBadge({ level, xp, size = 'md', showProgress = false, showXp = false }: LevelBadgeProps) {
  const info = getLevelInfo(level);
  const xpStart = levelToXp(level);
  const xpEnd   = levelToXp(level + 1);
  const pct     = xpEnd > xpStart ? Math.min(100, Math.round(((xp - xpStart) / (xpEnd - xpStart)) * 100)) : 100;
  const remaining = Math.max(0, xpEnd - xp);

  const sizes = {
    sm: { badge: 'px-2 py-0.5 text-[10px]', icon: 'text-sm', num: 'text-xs' },
    md: { badge: 'px-2.5 py-1 text-xs',     icon: 'text-base', num: 'text-sm' },
    lg: { badge: 'px-3 py-1.5 text-sm',     icon: 'text-xl',  num: 'text-base' },
  }[size];

  return (
    <div className="inline-flex flex-col gap-1">
      <div className={`inline-flex items-center gap-1.5 rounded-full border font-bold ${info.bg} ${info.border} ${sizes.badge}`}>
        <span className={sizes.icon}>{info.icon}</span>
        <span className={`font-orbitron ${info.color}`}>Lv.{level}</span>
        <span className={`text-white/50 font-normal ${sizes.num}`}>{info.label}</span>
      </div>

      {showProgress && (
        <div className="space-y-0.5">
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden w-full">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${progressGradient(level)}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          {showXp && (
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{xp.toLocaleString()} XP</span>
              <span>{remaining > 0 ? `${remaining} to Lv.${level + 1}` : 'Max Level'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function progressGradient(level: number): string {
  if (level >= 50) return 'from-red-500 to-red-400';
  if (level >= 40) return 'from-pink-500 to-rose-400';
  if (level >= 30) return 'from-yellow-500 to-amber-400';
  if (level >= 20) return 'from-purple-500 to-violet-400';
  if (level >= 15) return 'from-cyan-500 to-sky-400';
  if (level >= 10) return 'from-blue-500 to-indigo-400';
  if (level >= 5)  return 'from-green-500 to-emerald-400';
  return 'from-teal-500 to-cyan-400';
}

// Compact inline version — just icon + level number
export function LevelPip({ level }: { level: number }) {
  const info = getLevelInfo(level);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold font-orbitron ${info.color}`}>
      {info.icon} {level}
    </span>
  );
}
