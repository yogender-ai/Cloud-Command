import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const rowVar = {
  hidden: { opacity: 0, x: 12 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { delay: 0.5 + i * 0.08, duration: 0.4 } }),
};

export default function QuickGlance({ items }) {
  return (
    <motion.div
      className="cc-quick-glance"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
    >
      <div className="cc-qg-head">Quick Glance</div>
      <div className="cc-qg-list">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div key={item.id} custom={i} initial="hidden" animate="visible" variants={rowVar}>
              <Link to={item.link} className="cc-qg-row">
                <Icon size={16} color={item.color} />
                <span className="cc-qg-label">{item.label}</span>
                <span className="cc-qg-value" style={{ color: item.color }}>{item.value}</span>
                {item.delta && (
                  <span className="cc-qg-delta" style={{ color: item.deltaColor || '#10b981' }}>
                    {item.delta}
                  </span>
                )}
                <ChevronRight size={14} className="cc-qg-arrow" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
