import React, { useEffect, useState } from 'react';

export function AppLoader(): React.ReactElement {
  const [showSlowMsg, setShowSlowMsg] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowSlowMsg(true), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      role="status"
      aria-label="Loading PulsePlay"
    >
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,217,255,0.1) 0%, rgba(157,78,221,0.06) 40%, transparent 70%)', filter: 'blur(60px)' }} />

      <div className="relative flex flex-col items-center gap-6">
        {/* Logo with spinning rings */}
        <div className="relative">
          {/* Outer spinning ring */}
          <div className="absolute rounded-[26px] border-2 border-transparent"
            style={{ inset: '-10px', borderTopColor: '#06b6d4', borderRightColor: '#a855f7', animation: 'loader-spin 1.2s linear infinite' }} />
          {/* Inner counter-spinning ring */}
          <div className="absolute rounded-[22px] border border-transparent"
            style={{ inset: '-3px', borderBottomColor: 'rgba(236,72,153,0.5)', borderLeftColor: 'rgba(0,217,255,0.3)', animation: 'loader-spin 2s linear infinite reverse' }} />
          {/* Logo image */}
          <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10"
            style={{ boxShadow: '0 0 30px rgba(0,217,255,0.25), 0 0 60px rgba(157,78,221,0.15)' }}>
            <img src="/pulseplay-logo.jpg" alt="PulsePlay" className="w-full h-full object-cover object-center" />
          </div>
        </div>

        {/* Brand name */}
        <div className="font-orbitron text-2xl font-bold tracking-wider select-none"
          style={{ background: 'linear-gradient(135deg, #22d3ee, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          PulsePlay
        </div>

        {/* Progress bar */}
        <div className="w-40 h-0.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, #06b6d4, #a855f7, transparent)', backgroundSize: '200% 100%', animation: 'loader-shimmer 1.6s ease-in-out infinite' }} />
        </div>

        <p className="text-xs font-mono tracking-widest transition-all duration-500"
          style={{ color: showSlowMsg ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)' }}>
          {showSlowMsg ? 'Connecting to server...' : 'Loading'}
        </p>
      </div>

      <style>{`
        @keyframes loader-spin    { to { transform: rotate(360deg); } }
        @keyframes loader-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </div>
  );
}
