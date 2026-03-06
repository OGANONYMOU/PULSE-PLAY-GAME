import React, { useEffect, useState } from 'react';
import { Gamepad2 } from 'lucide-react';

/**
 * AppLoader — shown only while auth state is being determined (typically <500ms).
 * Pure CSS animations, no framer-motion dependency, renders on the very first frame.
 *
 * FIX: Added a "taking longer than expected" fallback message at 3s so users
 * know the app is still working (not frozen) if their connection is slow.
 */
export function AppLoader(): React.ReactElement {
  const [showSlowMsg, setShowSlowMsg] = useState(false);

  useEffect(() => {
    // If still loading after 3s, show a hint so users don't think it's frozen
    const t = setTimeout(() => setShowSlowMsg(true), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      role="status"
      aria-label="Loading PulsePay"
    >
      {/* Ambient glow — CSS only */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(0,217,255,0.1) 0%, rgba(157,78,221,0.06) 40%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      <div className="relative flex flex-col items-center gap-6">
        {/* Logo with spinning ring */}
        <div className="relative">
          {/* Outer spinning ring */}
          <div
            className="absolute rounded-[26px] border-2 border-transparent"
            style={{
              inset: '-8px',
              borderTopColor: '#06b6d4',
              borderRightColor: '#a855f7',
              animation: 'loader-spin 1.2s linear infinite',
            }}
          />
          {/* Inner counter-spinning ring */}
          <div
            className="absolute rounded-[20px] border border-transparent"
            style={{
              inset: '-2px',
              borderBottomColor: 'rgba(236,72,153,0.5)',
              borderLeftColor: 'rgba(0,217,255,0.3)',
              animation: 'loader-spin 2s linear infinite reverse',
            }}
          />
          {/* Icon container */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 via-purple-600 to-pink-600 flex items-center justify-center shadow-xl"
            style={{ boxShadow: '0 0 30px rgba(0,217,255,0.3), 0 0 60px rgba(157,78,221,0.2)' }}>
            <Gamepad2 className="w-8 h-8 text-white drop-shadow" />
          </div>
        </div>

        {/* Brand name */}
        <div
          className="font-orbitron text-2xl font-bold tracking-wider select-none"
          style={{
            background: 'linear-gradient(135deg, #22d3ee, #a855f7, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          PulsePay
        </div>

        {/* Progress bar */}
        <div className="w-40 h-0.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, #06b6d4, #a855f7, transparent)',
              backgroundSize: '200% 100%',
              animation: 'loader-shimmer 1.6s ease-in-out infinite',
            }}
          />
        </div>

        {/* Status text */}
        <p
          className="text-xs font-mono tracking-widest transition-all duration-500"
          style={{ color: showSlowMsg ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)' }}
        >
          {showSlowMsg ? 'Connecting to server...' : 'Loading'}
        </p>
      </div>

      <style>{`
        @keyframes loader-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes loader-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>
    </div>
  );
}
