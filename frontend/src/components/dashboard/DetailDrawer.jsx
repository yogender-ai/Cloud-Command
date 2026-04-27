import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DetailDrawer({ item, onClose }) {
  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div
            className="cc-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="cc-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <button className="cc-drawer-close" onClick={onClose}><X size={18} /></button>
            <div className="cc-drawer-header">
              {item.icon && <item.icon size={22} color={item.iconColor || 'var(--accent-indigo)'} />}
              <h2>{item.drawerTitle || item.name || item.title}</h2>
            </div>
            {item.drawerTag && <span className="cc-drawer-tag">{item.drawerTag}</span>}
            {item.drawerStats && (
              <div className="cc-drawer-stats">
                {item.drawerStats.map((s, i) => (
                  <div key={i} className="cc-drawer-stat">
                    <small>{s.label}</small>
                    <b style={{ color: s.color }}>{s.value}</b>
                  </div>
                ))}
              </div>
            )}
            {item.drawerBody && (
              <section className="cc-drawer-section">
                <h3>Summary</h3>
                <p>{item.drawerBody}</p>
              </section>
            )}
            {item.drawerItems && item.drawerItems.length > 0 && (
              <section className="cc-drawer-section">
                <h3>Details</h3>
                <div className="cc-drawer-list">
                  {item.drawerItems.map((d, i) => (
                    <div key={i} className="cc-drawer-list-item">
                      <span className="cc-drawer-dot" style={{ background: d.color || '#6366f1' }} />
                      <span>{d.label}</span>
                      <b>{d.value}</b>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {item.link && (
              <Link to={item.link} className="cc-drawer-link" onClick={onClose}>
                <ExternalLink size={14} /> View Full Details
              </Link>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
