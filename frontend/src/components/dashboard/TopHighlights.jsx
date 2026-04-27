import { motion } from 'framer-motion';

const cardVar = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: 0.6 + i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] } }),
};

const impactColor = { high: '#f43f5e', medium: '#f59e0b', low: '#10b981' };

export default function TopHighlights({ items, onSelect }) {
  if (!items.length) return null;
  return (
    <div className="cc-highlights">
      <div className="cc-section-head">
        <span className="cc-section-title">Top 3 Highlights You Must Know</span>
      </div>
      <div className="cc-highlights-list">
        {items.slice(0, 3).map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              className="cc-highlight-card"
              custom={i}
              initial="hidden"
              animate="visible"
              variants={cardVar}
              onClick={() => onSelect(item)}
              whileHover={{ y: -4 }}
            >
              <span className="cc-highlight-num">{i + 1}</span>
              <span className="cc-highlight-tag" style={{ background: item.tagBg, color: item.tagColor }}>
                {item.icon && <Icon size={12} />} {item.tag}
              </span>
              <h4 className="cc-highlight-title">{item.title}</h4>
              <p className="cc-highlight-body">{item.body}</p>
              <div className="cc-highlight-footer">
                <span className="cc-highlight-impact" style={{ color: impactColor[item.impact] || '#6366f1' }}>
                  <span className="cc-impact-dot" style={{ background: impactColor[item.impact] }} />
                  {item.impact ? item.impact.charAt(0).toUpperCase() + item.impact.slice(1) : 'Info'} Impact
                </span>
                <span className="cc-highlight-time">{item.time}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
