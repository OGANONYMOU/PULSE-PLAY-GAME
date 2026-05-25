import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number; opacity: number;
}

// Throttle to 24fps — particles move slowly, 60fps buys nothing but CPU
const FRAME_INTERVAL = 1000 / 24;

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const isMobile = window.innerWidth < 768;
    const COUNT        = isMobile ? 12 : 20;
    const CONN_DIST    = isMobile ? 90 : 120;
    const CONN_DIST_SQ = CONN_DIST * CONN_DIST;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const particles: Particle[] = Array.from({ length: COUNT }, () => ({
      x:       Math.random() * canvas.width,
      y:       Math.random() * canvas.height,
      vx:      (Math.random() - 0.5) * 0.3,
      vy:      (Math.random() - 0.5) * 0.3,
      size:    Math.random() * 1.8 + 0.6,
      opacity: Math.random() * 0.35 + 0.1,
    }));

    let raf = 0;
    let lastTime = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);

      // Skip if tab is hidden or frame came too soon
      if (document.hidden) return;
      if (now - lastTime < FRAME_INTERVAL) return;
      lastTime = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update + draw particles
      for (let i = 0; i < COUNT; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        else if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        else if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,217,255,${p.opacity})`;
        ctx.fill();
      }

      // Draw connections — batch all lines with a single path per alpha bucket
      ctx.lineWidth = 0.5;
      for (let i = 0; i < COUNT - 1; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;
          if (distSq < CONN_DIST_SQ) {
            // Round alpha to nearest 0.02 to reuse strokeStyle across nearby pairs
            const rawAlpha = (1 - distSq / CONN_DIST_SQ) * 0.1;
            const alpha = Math.round(rawAlpha * 50) / 50;
            ctx.strokeStyle = `rgba(0,217,255,${alpha})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    };

    raf = requestAnimationFrame(draw);

    const handleResize = () => {
      resize();
      particles.forEach(p => {
        p.x = Math.min(p.x, canvas.width);
        p.y = Math.min(p.y, canvas.height);
      });
    };
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5" />
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(157,78,221,0.15) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(0,217,255,0.15) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <canvas
        ref={canvasRef}
        aria-hidden
        className="fixed inset-0 pointer-events-none z-0"
        style={{ opacity: 0.55 }}
      />
    </>
  );
}