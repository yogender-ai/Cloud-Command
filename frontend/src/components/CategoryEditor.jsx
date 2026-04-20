/**
 * CategoryEditor — reusable inline component.
 * Click the tag icon on any card to set/edit a free-text project name.
 * Suggestions come from all categories already in use by the user.
 */
import { useState, useRef, useEffect } from 'react';
import { Tag, X, Check, Pencil } from 'lucide-react';

// Palette: cycles through up to 8 colours deterministically by category name
const PALETTE = [
  { bg: 'rgba(99,102,241,0.12)',  color: '#6366f1', border: 'rgba(99,102,241,0.3)' },
  { bg: 'rgba(16,185,129,0.12)',  color: '#10b981', border: 'rgba(16,185,129,0.3)' },
  { bg: 'rgba(168,85,247,0.12)',  color: '#a855f7', border: 'rgba(168,85,247,0.3)' },
  { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  { bg: 'rgba(6,182,212,0.12)',   color: '#06b6d4', border: 'rgba(6,182,212,0.3)'  },
  { bg: 'rgba(244,63,94,0.12)',   color: '#f43f5e', border: 'rgba(244,63,94,0.3)'  },
  { bg: 'rgba(234,179,8,0.12)',   color: '#eab308', border: 'rgba(234,179,8,0.3)'  },
  { bg: 'rgba(20,184,166,0.12)',  color: '#14b8a6', border: 'rgba(20,184,166,0.3)' },
];

export function getCategoryColor(category) {
  if (!category) return null;
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) & 0xffff;
  return PALETTE[hash % PALETTE.length];
}

export function CategoryBadge({ category, onClick, small }) {
  if (!category) return null;
  const c = getCategoryColor(category);
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: small ? '1px 7px' : '3px 10px', borderRadius: 99,
        fontSize: small ? 9 : 11, fontWeight: 700, letterSpacing: '0.04em',
        textTransform: 'uppercase', background: c.bg, color: c.color,
        border: `1px solid ${c.border}`, cursor: onClick ? 'pointer' : 'default',
        transition: 'opacity 0.15s',
      }}
    >
      <Tag size={small ? 8 : 10} /> {category}
    </span>
  );
}

/**
 * CategoryEditor
 * @param {string}   category     — current value (or null)
 * @param {string[]} suggestions  — existing categories from other cards
 * @param {(cat:string|null) => Promise} onSave
 * @param {object}   style        — optional outer style
 */
export function CategoryEditor({ category, suggestions = [], onSave, style }) {
  const [open, setOpen]     = useState(false);
  const [value, setValue]   = useState(category || '');
  const [saving, setSaving] = useState(false);
  const inputRef            = useRef(null);

  useEffect(() => { setValue(category || ''); }, [category]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value.trim() || null);
      setOpen(false);
    } finally { setSaving(false); }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setOpen(false); setValue(category || ''); }
  };

  const uniqueSuggestions = [...new Set(suggestions.filter(s => s && s !== category))];

  if (!open) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
      {category
        ? <CategoryBadge category={category} onClick={() => setOpen(true)} />
        : (
          <button onClick={() => setOpen(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600,
            background: 'transparent', border: '1px dashed var(--border)',
            color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <Tag size={9} /> Add project tag
          </button>
        )
      }
      {category && (
        <button onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1 }}>
          <Pencil size={10} />
        </button>
      )}
    </span>
  );

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, ...style }}>
      <span style={{ display: 'flex', gap: 4 }}>
        <input
          ref={inputRef} value={value} onChange={e => setValue(e.target.value)} onKeyDown={handleKey}
          placeholder="e.g. News-Intel"
          style={{
            width: 130, padding: '3px 8px', fontSize: 12, fontFamily: 'var(--font-body)',
            background: 'var(--bg-input)', border: '1px solid var(--accent-indigo)',
            borderRadius: 8, color: 'var(--text-primary)', outline: 'none',
          }}
        />
        <button onClick={handleSave} disabled={saving} style={{ background: 'var(--accent-indigo)', border: 'none', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}>
          {saving ? <div style={{ width: 12, height: 12, border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : <Check size={12} />}
        </button>
        <button onClick={() => { setOpen(false); setValue(category || ''); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          <X size={12} />
        </button>
      </span>
      {uniqueSuggestions.length > 0 && (
        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {uniqueSuggestions.map(s => (
            <button key={s} onClick={() => { setValue(s); setTimeout(handleSave, 0); }}
              style={{ padding: '1px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' }}>
              {s}
            </button>
          ))}
          {category && (
            <button onClick={() => { setValue(''); setTimeout(() => onSave(null).then(() => setOpen(false)), 0); }}
              style={{ padding: '1px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px dashed rgba(244,63,94,0.4)', background: 'transparent', color: 'var(--accent-rose)' }}>
              clear
            </button>
          )}
        </span>
      )}
    </span>
  );
}
