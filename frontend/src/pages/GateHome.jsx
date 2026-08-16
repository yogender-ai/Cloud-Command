import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ensureBackendAwake,
  getApiKeySummary,
  getMonitors,
  getScheduledJobs,
  getRenderAccounts,
  getVercelAccounts,
} from '../api'

function pct(part, whole) {
  if (!whole) return null
  return Math.round((Number(part) / Number(whole)) * 100)
}

function fmtTime(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

export default function GateHome({ onLive }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [monitors, setMonitors] = useState([])
  const [jobs, setJobs] = useState([])
  const [renderAccounts, setRenderAccounts] = useState([])
  const [vercelAccounts, setVercelAccounts] = useState([])
  const [picked, setPicked] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await ensureBackendAwake()
      const results = await Promise.allSettled([
        getApiKeySummary('24h'),
        getMonitors(),
        getScheduledJobs(),
        getRenderAccounts(),
        getVercelAccounts(),
      ])
      if (cancelled) return
      const take = (i, fallback) => (results[i].status === 'fulfilled' ? results[i].value : fallback)
      setSummary(take(0, null))
      setMonitors(Array.isArray(take(1, [])) ? take(1, []) : [])
      setJobs(Array.isArray(take(2, [])) ? take(2, []) : [])
      setRenderAccounts(Array.isArray(take(3, [])) ? take(3, []) : [])
      setVercelAccounts(Array.isArray(take(4, [])) ? take(4, []) : [])
      const failed = results.filter((item) => item.status === 'rejected').length
      setError(failed === results.length ? 'Could not reach Cloud Command.' : '')
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const requestsToday = Number(summary?.requests_today || 0)
  const tokensToday = Number(summary?.tokens_today || 0)
  const errorsToday = Number(summary?.errors_today || 0)
  const success = requestsToday ? `${Math.round(((requestsToday - errorsToday) / requestsToday) * 100)}%` : '—'
  const recentCalls = Array.isArray(summary?.recent_calls) ? summary.recent_calls : []
  const recentErrors = Array.isArray(summary?.recent_errors) ? summary.recent_errors : []
  const keys = Array.isArray(summary?.per_key) ? summary.per_key : []

  useEffect(() => {
    onLive?.({
      online: !error && !loading,
      requestsToday: summary ? requestsToday : '—',
      tokensToday: summary ? tokensToday.toLocaleString() : '—',
      success,
    })
  }, [error, loading, requestsToday, tokensToday, success, summary, onLive])

  const world = useMemo(() => {
    const nodes = monitors.slice(0, 6).map((item) => ({
      id: `mon-${item.id}`,
      title: item.name || item.url || 'Monitor',
      meta: item.status || 'UNKNOWN',
      ok: item.status === 'UP',
      to: '/monitors',
    }))
    if (jobs.length) {
      nodes.unshift({
        id: 'jobs',
        title: 'Scheduled Jobs',
        meta: `${jobs.length} job${jobs.length === 1 ? '' : 's'}`,
        ok: true,
        to: '/scheduled-jobs',
      })
    }
    return nodes
  }, [monitors, jobs])

  const providers = useMemo(() => {
    const seen = new Map()
    keys.forEach((key) => {
      const name = key.provider || 'unknown'
      if (!seen.has(name)) {
        seen.set(name, {
          id: `prov-${name}`,
          title: name,
          meta: `${key.today_requests || 0} today`,
          requests: Number(key.today_requests || 0),
          to: '/api-keys',
        })
      } else {
        const cur = seen.get(name)
        cur.requests += Number(key.today_requests || 0)
        cur.meta = `${cur.requests} today`
      }
    })
    const list = [...seen.values()]
    if (renderAccounts.length) {
      list.push({ id: 'render', title: 'Render', meta: `${renderAccounts.length} account${renderAccounts.length === 1 ? '' : 's'}`, to: '/render', requests: 0 })
    }
    if (vercelAccounts.length) {
      list.push({ id: 'vercel', title: 'Vercel', meta: `${vercelAccounts.length} account${vercelAccounts.length === 1 ? '' : 's'}`, to: '/vercel', requests: 0 })
    }
    return list
  }, [keys, renderAccounts, vercelAccounts])

  const limited = keys.filter((key) => key.daily_token_limit)
  const used = limited.reduce((sum, key) => sum + Number(key.today_tokens || 0), 0)
  const cap = limited.reduce((sum, key) => sum + Number(key.daily_token_limit || 0), 0)
  const budgetPct = pct(used, cap)
  const authLabel = summary?.active_keys ? `${summary.active_keys} active` : (summary?.total_keys ? 'No active keys' : 'No keys')
  const policyLabel = keys.some((key) => key.daily_request_limit || key.daily_token_limit) ? 'Limits on' : 'No limits set'
  const budgetLabel = budgetPct != null ? `${budgetPct}%` : (tokensToday ? `${tokensToday.toLocaleString()} today` : 'No budget')

  const packetCount = Math.min(requestsToday, 8)
  const blocked = recentErrors[0] || null

  const openInspect = (payload) => setPicked(payload)

  return (
    <div className={`gate-hall ${loading ? 'is-loading' : ''}`}>
      {error && <div className="gate-banner bad">{error}</div>}
      {!error && !loading && !summary && <div className="gate-banner">No summary yet. Open the vault after the backend wakes.</div>}

      <section className="gate-board">
        <aside className="gate-col">
          <h2>Your world</h2>
          {world.length === 0 && <p className="gate-empty">No monitors or jobs yet. Add one to give the gate something to watch.</p>}
          {world.map((node) => (
            <button
              type="button"
              key={node.id}
              className={`gate-node ${node.ok ? 'ok' : 'warn'}`}
              onClick={() => navigate(node.to, { state: { dive: node.id } })}
            >
              <b>{node.title}</b>
              <small>{node.meta}</small>
            </button>
          ))}
          <button type="button" className="gate-node add" onClick={() => navigate('/overview')}>Ops desk</button>
        </aside>

        <div className="gate-core">
          <svg className="gate-pipes" viewBox="0 0 640 420" preserveAspectRatio="none">
            <path d="M40 80 C 180 80 180 210 320 210" />
            <path d="M40 210 H 320" />
            <path d="M40 340 C 180 340 180 210 320 210" />
            <path d="M320 210 C 460 210 460 80 600 80" />
            <path d="M320 210 H 600" />
            <path d="M320 210 C 460 210 460 340 600 340" />
            {packetCount > 0 && Array.from({ length: packetCount }, (_, i) => (
              <circle key={i} r="4" className="gate-packet">
                <animateMotion dur={`${2.4 + (i % 3) * 0.4}s`} begin={`${i * 0.35}s`} repeatCount="indefinite" path={i % 2 === 0 ? 'M40 210 H 320' : 'M320 210 H 600'} />
              </circle>
            ))}
          </svg>

          <button type="button" className="gate-lock" onClick={() => navigate('/api-keys', { state: { dive: 'lock' } })}>
            <span className="gate-lock-ring" style={{ '--used': `${budgetPct || 0}%` }} />
            <span className="gate-lock-body">
              <strong>THE GATE</strong>
              <em>{requestsToday ? `${requestsToday} calls today` : 'No calls today'}</em>
            </span>
          </button>

          <div className="gate-badges">
            <button type="button" onClick={() => navigate('/api-keys')}>
              Auth <b>{authLabel}</b>
            </button>
            <button type="button" onClick={() => navigate('/api-keys')}>
              Policy <b>{policyLabel}</b>
            </button>
            <button type="button" onClick={() => navigate('/api-keys')}>
              Budget <b>{budgetLabel}</b>
            </button>
          </div>
        </div>

        <aside className="gate-col">
          <h2>Providers</h2>
          {providers.length === 0 && <p className="gate-empty">No provider keys or platform accounts yet.</p>}
          {providers.map((node) => (
            <button
              type="button"
              key={node.id}
              className="gate-node"
              onClick={() => {
                if (node.id === 'render' || node.id === 'vercel') navigate(node.to)
                else openInspect({ kind: 'provider', ...node })
              }}
            >
              <b>{node.title}</b>
              <small>{node.meta}</small>
            </button>
          ))}
          {blocked && (
            <button type="button" className="gate-node blocked" onClick={() => openInspect({ kind: 'error', ...blocked })}>
              <b>Blocked</b>
              <small>{blocked.key_name || blocked.provider || 'policy / error'}</small>
            </button>
          )}
        </aside>
      </section>

      <section className="gate-dock">
        <div className="gate-inspect">
          <h3>Live call inspector</h3>
          {!picked && recentCalls[0] && (
            <p>Last real call: {recentCalls[0].key_name || recentCalls[0].provider || 'key'} · {recentCalls[0].tokens_used} tokens · {fmtTime(recentCalls[0].timestamp)}</p>
          )}
          {!picked && !recentCalls[0] && <p>No gateway calls logged yet. The inspector stays empty until a real request hits a key.</p>}
          {picked?.kind === 'provider' && (
            <dl>
              <div><dt>Provider</dt><dd>{picked.title}</dd></div>
              <div><dt>Calls today</dt><dd>{picked.requests}</dd></div>
              <div><dt>Open</dt><dd><button type="button" onClick={() => navigate('/api-keys')}>Vault</button></dd></div>
            </dl>
          )}
          {picked?.kind === 'error' && (
            <dl>
              <div><dt>When</dt><dd>{fmtTime(picked.timestamp)}</dd></div>
              <div><dt>Key</dt><dd>{picked.key_name || '—'}</dd></div>
              <div><dt>Status</dt><dd>{picked.status_code || 'error'}</dd></div>
              <div><dt>Detail</dt><dd>{picked.error_message || 'No error body stored'}</dd></div>
            </dl>
          )}
          {picked?.kind === 'call' && (
            <dl>
              <div><dt>When</dt><dd>{fmtTime(picked.timestamp)}</dd></div>
              <div><dt>Key</dt><dd>{picked.key_name || picked.provider || '—'}</dd></div>
              <div><dt>Tokens</dt><dd>{picked.tokens_used}</dd></div>
              <div><dt>Status</dt><dd>{picked.is_error ? 'error' : picked.status_code || 'ok'}</dd></div>
            </dl>
          )}
        </div>
        <div className="gate-log">
          <h3>Recent calls</h3>
          {recentCalls.length === 0 && <p>Nothing in the usage log.</p>}
          <ul>
            {recentCalls.map((call) => (
              <li key={call.id}>
                <button type="button" onClick={() => openInspect({ kind: 'call', ...call })}>
                  <b>{call.key_name || call.provider || 'call'}</b>
                  <span>{call.tokens_used} tok</span>
                  <em className={call.is_error ? 'bad' : ''}>{call.is_error ? 'ERR' : call.status_code || 'OK'}</em>
                  <small>{fmtTime(call.timestamp)}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
