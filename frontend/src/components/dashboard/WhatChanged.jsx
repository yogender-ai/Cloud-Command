import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';

const trendIcon = (t) => {
  if (t === 'up') return <TrendingUp size={14} />;
  if (t === 'down') return <TrendingDown size={14} />;
  return <Minus size={14} />;
};

const severityColor = { high: '#f43f5e', medium: '#f59e0b', stable: '#10b981', low: '#6366f1' };
const severityLabel = { high: 'High', medium: 'Medium', stable: 'Stable', low: 'Low' };

const cardVar = {
  hidden: { opacity: 0, y: 12 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: 0.3 + i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] } }),
};

export default function WhatChanged({ items, onSelect }) {
  return (
    <div className="cc-what-changed">
      <div className="cc-section-head">
        <span className="cc-section-title">What Changed Today</span>
        <span className="cc-section-sub">Key infrastructure shifts in the last 24 hours</span>
      </div>
      <div className="cc-change-list">
        {items.map((item, i) => {
          const Icon = item.icon;
          const sColor = severityColor[item.severity] || severityColor.stable;
          return (
            <motion.button
              key={item.id}
              className="cc-change-card"
              custom={i}
              initial="hidden"
              animate="visible"
              variants={cardVar}
              onClick={() => onSelect(item)}
              whileHover={{ scale: 1.02 }}
            >
              <div className="cc-change-icon" style={{ background: item.iconBg }}>
                <Icon size={20} color={item.iconColor} />
              </div>
              <div className="cc-change-info">
                <span className="cc-change-name">{item.name}</span>
                <span className="cc-change-detail">{item.detail}</span>
              </div>
              <span className="cc-change-trend" style={{ color: sColor }}>
                {trendIcon(item.trend)}
                {severityLabel[item.severity]}
              </span>
              <div className="cc-change-spark">{item.spark}</div>
              <ChevronRight size={16} className="cc-change-arrow" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
