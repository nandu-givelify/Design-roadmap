// Overview: headline counters, signups over time, and the busiest boards.
import { useState, useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import RefreshIcon from '@mui/icons-material/Refresh'
import { getStats } from './api'
import { SectionHeader, Loading, ErrorNote, EmptyState } from './ui'

// One series, so one hue — no categorical palette to balance and no legend
// (the chart title names the series). Validated against a light surface:
// inside the lightness band, above the chroma floor, >=3:1 against white.
const SERIES = '#3B82F6'
const GRID   = '#eef0f2'
const INK    = '#111827'
const MUTED  = '#6b7280'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true); setError(null)
    try { setStats(await getStats()) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading && !stats) return <Loading label="Gathering stats…" />

  return (
    <Box>
      <SectionHeader
        title="Overview"
        subtitle="Everything across every board and account."
        action={
          <Button size="small" startIcon={<RefreshIcon />} onClick={load} disabled={loading} sx={{ color: 'text.secondary' }}>
            Refresh
          </Button>
        }
      />

      <ErrorNote error={error} onRetry={load} />

      {stats && (
        <>
          <Box sx={{
            display: 'grid', gap: 2, mb: 3,
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          }}>
            <Tile label="Users"          value={stats.users.total}       note={`${stats.users.newLast7} new this week`} />
            <Tile label="Active 30 days" value={stats.users.activeLast30} note={`${stats.users.disabled} disabled`} />
            <Tile label="Boards"         value={stats.boards.total}      note={`${stats.boards.people} people`} />
            <Tile label="Tasks"          value={stats.boards.tasks}      note={`${stats.orgMembers} in directory`} />
          </Box>

          <SignupsChart byDay={stats.signupsByDay} />

          <Panel title="Busiest boards" sx={{ mt: 3 }}>
            {stats.busiestBoards.length === 0
              ? <EmptyState>No boards yet.</EmptyState>
              : (
                <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
                  {stats.busiestBoards.map(b => (
                    <Stack key={b.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1.25, gap: 2 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{b.ownerEmail || 'no owner'}</Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {b.tasks} tasks · {b.people} people
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
          </Panel>
        </>
      )}
    </Box>
  )
}

// ── Pieces ───────────────────────────────────────────────────────────────────
function Panel({ title, children, sx }) {
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2.5, ...sx }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>{title}</Typography>
      {children}
    </Box>
  )
}

function Tile({ label, value, note }) {
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography sx={{ fontSize: '2rem', fontWeight: 600, lineHeight: 1.15, mt: 0.5 }}>
        {value.toLocaleString()}
      </Typography>
      {note && <Typography variant="caption" color="text.secondary">{note}</Typography>}
    </Box>
  )
}

// Signups, bucketed by week. 90 daily bars would be 90 two-pixel slivers on a
// narrow screen; 13 weekly bars stay readable and the shape is the same.
function SignupsChart({ byDay }) {
  const weeks = useMemo(() => {
    const out = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Walk back 12 weeks from the start of the current week.
    const thisWeekStart = new Date(today)
    thisWeekStart.setDate(today.getDate() - today.getDay())

    for (let i = 12; i >= 0; i--) {
      const start = new Date(thisWeekStart)
      start.setDate(thisWeekStart.getDate() - i * 7)
      let count = 0
      for (let d = 0; d < 7; d++) {
        const day = new Date(start)
        day.setDate(start.getDate() + d)
        count += byDay[day.toISOString().slice(0, 10)] || 0
      }
      out.push({ start, count })
    }
    return out
  }, [byDay])

  const max = Math.max(1, ...weeks.map(w => w.count))
  const total = weeks.reduce((n, w) => n + w.count, 0)

  const W = 720, H = 180, PAD_L = 28, PAD_B = 22, PAD_T = 8
  const plotW = W - PAD_L, plotH = H - PAD_B - PAD_T
  const slot = plotW / weeks.length
  const barW = Math.max(4, slot - 8) // 8px of surface between bars

  const [hover, setHover] = useState(null)

  const label = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <Panel title="New accounts per week">
      {total === 0 ? (
        <EmptyState>No signups in the last 13 weeks.</EmptyState>
      ) : (
        <Box sx={{ position: 'relative' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
               aria-label={`New accounts per week: ${total} over the last 13 weeks, peaking at ${max}.`}
               style={{ display: 'block', overflow: 'visible' }}>
            {/* Recessive gridlines at 0 / half / max */}
            {[0, 0.5, 1].map(t => {
              const y = PAD_T + plotH - t * plotH
              return (
                <g key={t}>
                  <line x1={PAD_L} y1={y} x2={W} y2={y} stroke={GRID} strokeWidth="1" />
                  <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize="10" fill={MUTED}>
                    {Math.round(t * max)}
                  </text>
                </g>
              )
            })}

            {weeks.map((w, i) => {
              const h = (w.count / max) * plotH
              const x = PAD_L + i * slot + (slot - barW) / 2
              const y = PAD_T + plotH - h
              const isHot = hover === i
              return (
                <g key={i}
                   onMouseEnter={() => setHover(i)}
                   onMouseLeave={() => setHover(null)}>
                  {/* Full-height hit target, so thin bars are still easy to hover */}
                  <rect x={PAD_L + i * slot} y={PAD_T} width={slot} height={plotH} fill="transparent" />
                  {w.count > 0 && (
                    <rect
                      x={x} y={y} width={barW} height={h}
                      rx="4" ry="4"
                      fill={SERIES}
                      opacity={hover === null || isHot ? 1 : 0.45}
                    />
                  )}
                  {/* Label only the peak — a number on every bar is noise */}
                  {w.count === max && w.count > 0 && !isHot && (
                    <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="10" fill={INK} fontWeight="600">
                      {w.count}
                    </text>
                  )}
                </g>
              )
            })}

            {/* First and last week labelled; the rest would collide */}
            <text x={PAD_L} y={H - 6} fontSize="10" fill={MUTED}>{label(weeks[0].start)}</text>
            <text x={W} y={H - 6} fontSize="10" fill={MUTED} textAnchor="end">now</text>
          </svg>

          {hover !== null && (
            <Box sx={{
              position: 'absolute', top: 0,
              left: `${((PAD_L + hover * slot + slot / 2) / W) * 100}%`,
              transform: 'translate(-50%, -100%)',
              bgcolor: INK, color: '#fff', px: 1.25, py: 0.75,
              borderRadius: 1.5, whiteSpace: 'nowrap', pointerEvents: 'none',
              fontSize: '0.75rem', lineHeight: 1.4,
            }}>
              <strong>{weeks[hover].count}</strong> {weeks[hover].count === 1 ? 'signup' : 'signups'}
              <br />
              <span style={{ opacity: 0.7 }}>week of {label(weeks[hover].start)}</span>
            </Box>
          )}
        </Box>
      )}
    </Panel>
  )
}
