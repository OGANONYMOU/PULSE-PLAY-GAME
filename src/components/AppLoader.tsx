import React, { useEffect, useState } from 'react';
import { Gamepad2 } from 'lucide-react';

// Pure CSS loader — no framer-motion dependency, renders instantly
export function AppLoader(): React.ReactElement {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      role="status"
      aria-label="Loading PulsePay"
    >
      {/* Ambient glow — CSS only */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,217,255,0.12) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />

      <div className="relative flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="relative">
          {/* Rotating ring — CSS animation, no JS */}
          <div className="absolute inset-[-6px] rounded-[22px] border-2 border-transparent"
            style={{ borderTopColor: '#06b6d4', borderRightColor: '#a855f7', animation: 'spin 1.4s linear infinite' }} />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="font-orbitron text-2xl font-bold gradient-text tracking-wider select-none">
          PulsePay
        </div>

        {/* Shimmer bar */}
        <div className="w-36 h-0.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-full skeleton rounded-full" />
        </div>

        <p className="text-white/30 text-xs font-mono tracking-widest">
          Loading{dots}
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}