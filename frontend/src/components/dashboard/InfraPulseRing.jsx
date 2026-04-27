import { motion } from 'framer-motion';

export default function InfraPulseRing({ score, label, detail }) {
  const r = 72, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 90 ? '#10b981' : score >= 60 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="cc-pulse-ring-wrap">
      <div className="cc-pulse-ring">
        <svg width="180" height="180" viewBox="0 0 180 180">
          <defs>
            <filter id="pulseGlow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
          <motion.circle
            cx="90" cy="90" r={r}
            fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: '90px 90px', transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 12px ${color})` }}
          />
        </svg>
        <div className="cc-pulse-ring-text">
          <motion.span
            className="cc-pulse-score"
            style={{ color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="cc-pulse-label">{label}</span>
        </div>
      </div>
      <p className="cc-pulse-detail">{detail}</p>
    </div>
  );
}
