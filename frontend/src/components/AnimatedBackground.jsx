import { useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext';

export default function AnimatedBackground() {
  const canvasRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let particles = [];
    let mouse = { x: -1000, y: -1000 };
    let dpr = window.devicePixelRatio || 1;

    function resize() {
      dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);
    }

    function createParticles() {
      particles = [];
      const count = Math.min(Math.floor((window.innerWidth * window.innerHeight) / 15000), 120);
      for (let i = 0; i < count; i++) {
        const isLarge = Math.random() > 0.85;
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * (isLarge ? 0.1 : 0.3),
          vy: (Math.random() - 0.5) * (isLarge ? 0.1 : 0.3),
          radius: isLarge ? (Math.random() * 40 + 20) : (Math.random() * 1.5 + 0.5),
          opacity: isLarge ? (Math.random() * 0.03 + 0.01) : (Math.random() * 0.5 + 0.1),
          pulseSpeed: Math.random() * 0.02 + 0.005,
          pulsePhase: Math.random() * Math.PI * 2,
          isLarge: isLarge
        });
      }
    }

    function hexToRgba(hex, alpha) {
      // Parse from theme's particleColor which is already rgba
      return theme.particleColor;
    }

    function drawConnections() {
      for (let i = 0; i < particles.length; i++) {
        if (particles[i].isLarge) continue; // Don't connect large background orbs
        for (let j = i + 1; j < particles.length; j++) {
          if (particles[j].isLarge) continue;
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const alpha = (1 - dist / 150) * 0.08;
            ctx.strokeStyle = theme.particleColor.replace(/[\d.]+\)$/, alpha + ')');
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    }

    function drawMouseGlow() {
      const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 200);
      grad.addColorStop(0, theme.accentGlow);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(mouse.x - 200, mouse.y - 200, 400, 400);
    }

    function animate(time) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      
      // Draw mouse glow
      if (mouse.x > 0 && mouse.y > 0) {
        drawMouseGlow();
      }

      // Draw connections
      drawConnections();

      // Update and draw particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Mouse repulsion
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && dist > 0) {
          const force = (120 - dist) / 120 * 0.5;
          p.vx += (dx / dist) * force * 0.02;
          p.vy += (dy / dist) * force * 0.02;
        }

        // Speed damping
        p.vx *= 0.999;
        p.vy *= 0.999;

        // Wrap around
        if (p.x < -10) p.x = window.innerWidth + 10;
        if (p.x > window.innerWidth + 10) p.x = -10;
        if (p.y < -10) p.y = window.innerHeight + 10;
        if (p.y > window.innerHeight + 10) p.y = -10;

        // Pulse
        const pulse = Math.sin(time * p.pulseSpeed + p.pulsePhase) * 0.3 + 0.7;
        const alpha = p.opacity * pulse;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = theme.particleColor.replace(/[\d.]+\)$/, alpha + ')');
        ctx.fill();

        // Add glow effect to larger particles
        if (p.radius > 1) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
          ctx.fillStyle = theme.particleColor.replace(/[\d.]+\)$/, (alpha * 0.1) + ')');
          ctx.fill();
        }
      });

      animId = requestAnimationFrame(animate);
    }

    function handleMouseMove(e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }

    function handleMouseLeave() {
      mouse.x = -1000;
      mouse.y = -1000;
    }

    resize();
    createParticles();
    animId = requestAnimationFrame(animate);

    window.addEventListener('resize', () => { resize(); createParticles(); });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
