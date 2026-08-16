import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Command, LogOut, Settings, Menu, X } from 'lucide-react'
import { removeToken } from '../auth'
import { setShell } from '../shellMode'

const ROOMS = [
  { label: 'The Gate', to: '/' },
  { label: 'Ops desk', to: '/overview' },
  { label: 'Monitors', to: '/monitors' },
  { label: 'Jobs', to: '/scheduled-jobs' },
  { label: 'Vault', to: '/api-keys' },
  { label: 'Render', to: '/render' },
  { label: 'Vercel', to: '/vercel' },
  { label: 'Settings', to: '/settings' },
]

export default function GateChrome({ live }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return ROOMS.filter((room) => room.label.toLowerCase().includes(q))
  }, [query])

  useEffect(() => { setOpen(false); setQuery('') }, [location.pathname])

  const jump = (path) => {
    setQuery('')
    navigate(path)
  }

  return (
    <header className="gate-chrome">
      <button type="button" className="gate-brand" onClick={() => navigate('/')}>
        <span className="gate-lock-dot" />
        <b>Cloud Command</b>
        <em>The Gate</em>
      </button>

      <div className="gate-live">
        <span className={live?.online ? 'on' : ''}>{live?.online ? 'LIVE' : 'IDLE'}</span>
        <b>{live?.requestsToday ?? '—'}</b>
        <small>req today</small>
        <b>{live?.tokensToday ?? '—'}</b>
        <small>tokens</small>
        <b>{live?.success ?? '—'}</b>
        <small>success</small>
      </div>

      <label className="gate-search">
        <Command size={14} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Jump to a room"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && matches[0]) jump(matches[0].to)
          }}
        />
        {matches.length > 0 && (
          <div className="gate-search-list">
            {matches.map((room) => (
              <button type="button" key={room.to} onClick={() => jump(room.to)}>{room.label}</button>
            ))}
          </div>
        )}
      </label>

      <nav className="gate-rooms">
        {ROOMS.slice(0, 6).map((room) => (
          <NavLink key={room.to} to={room.to} end={room.to === '/'}>{room.label}</NavLink>
        ))}
      </nav>

      <div className="gate-actions">
        <button type="button" onClick={() => navigate('/settings')} aria-label="Settings"><Settings size={16} /></button>
        <button type="button" className="ghost" onClick={() => setShell('classic')}>Classic</button>
        <button type="button" onClick={() => { removeToken(); window.location.assign('/login') }} aria-label="Log out"><LogOut size={16} /></button>
        <button type="button" className="gate-menu" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div className="gate-sheet">
          {ROOMS.map((room) => (
            <NavLink key={room.to} to={room.to} end={room.to === '/'}>{room.label}</NavLink>
          ))}
        </div>
      )}
    </header>
  )
}
