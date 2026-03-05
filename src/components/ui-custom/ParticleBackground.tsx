import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number; opacity: number;
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Fewer particles on mobile — preserves battery and frame rate
    const isMobile = window.innerWidth < 768;
    const COUNT = isMobile ? 16 : 28;
    const CONNECTION_DIST = isMobile ? 100 : 140;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const particles: Particle[] = Array.from({ length: COUNT }, () => ({
      x:       Math.random() * canvas.width,
      y:       Math.random() * canvas.height,
      vx:      (Math.random() - 0.5) * 0.35,
      vy:      (Math.random() - 0.5) * 0.35,
      size:    Math.random() * 2 + 0.8,
      opacity: Math.random() * 0.4 + 0.15,
    }));

    let raf = 0;

    const draw = () => {
      // Skip rendering when the tab is hidden — saves CPU/GPU completely
      if (document.hidden) { raf = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update + draw particles
      for (let i = 0; i < COUNT; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,217,255,${p.opacity})`;
        ctx.fill();
      }

      // Draw connections — only upper-triangle (i<j) avoids duplicate pairs
      ctx.lineWidth = 0.6;
      for (let i = 0; i < COUNT - 1; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          // Avoid Math.sqrt when possible: compare squared distance
          const distSq = dx * dx + dy * dy;
          const limitSq = CONNECTION_DIST * CONNECTION_DIST;
          if (distSq < limitSq) {
            const alpha = (1 - distSq / limitSq) * 0.12;
            ctx.strokeStyle = `rgba(0,217,255,${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      resize();
      // Clamp particles back inside the new bounds
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
      {/* Static CSS gradients — zero JS cost */}
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
        style={{ opacity: 0.55, willChange: 'contents' }}
      />
    </>
  );
}