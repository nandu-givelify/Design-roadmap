// Every state-changing admin action, newest first.
//
// Written server-side by audit() in api/_lib/admin.js, so it records what the
// server actually did rather than what the UI intended. The _adminAudit
// collection is denied to all clients by the Firestore rules — it's readable
// only through /api/admin/audit, which itself requires admin.
import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import RefreshIcon from '@mui/icons-material/Refresh'
import { getAudit } from './api'
import { SectionHeader, Loading, ErrorNote, EmptyState, relativeTime } from './ui'

// Readable sentence per action type, so the log doesn't read like an RPC trace.
const DESCRIBE = {
  disable:        d => `disabled ${d.email}`,
  enable:         d => `re-enabled ${d.email}`,
  delete:         d => `deleted the account ${d.email}${d.orphanedBoards ? ` (${d.orphanedBoards} board(s) left unowned)` : ''}`,
  setPassword:    d => `set a new password for ${d.email}`,
  resetLink:      d => `generated a password reset link for ${d.email}`,
  rename:         d => `renamed ${d.email} to “${d.displayName}”`,
  revokeSessions: d => `signed ${d.email} out of all devices`,
  verifyEmail:    d => `marked ${d.email} as verified`,
  'board.rename':          d => `renamed board “${d.from}” to “${d.to}”`,
  'board.transferOwner':   d => `transferred board ownership from ${d.from || 'nobody'} to ${d.to}`,
  'board.addMember':       d => `added ${d.email} to a board`,
  'board.removeMember':    d => `removed ${d.email} from a board`,
  'board.setPublicAccess': d => `set board public access to ${d.access || 'private'}`,
  'board.delete':          d => `deleted board “${d.name}” (${d.tasks} tasks, ${d.people} people)`,
  'directory.updateMember':  d => `edited the directory entry for ${d.id}`,
  'directory.deleteMember':  d => `removed ${d.id} from the directory`,
  'directory.merge':         d => `merged ${d.removed?.length || 0} duplicate entries into ${d.keepId}`,
  'directory.updateProfile': d => `edited a user profile`,
  'directory.backfill':      d => `ran the directory backfill (${d.scanned} people scanned, ${d.added} registered)`,
}

const DESTRUCTIVE = new Set(['delete', 'board.delete', 'directory.deleteMember', 'disable', 'setPassword'])

export default function AuditPanel() {
  const [entries, setEntries] = useState([])
  const [limit, setLimit] = useState(100)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (n) => {
    setLoading(true); setError(null)
    try { setEntries((await getAudit(n)).entries) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(limit) }, [limit, load])

  return (
    <Box>
      <SectionHeader
        title="Audit log"
        subtitle="Every change made from this panel, recorded server-side."
        action={
          <Button size="small" startIcon={<RefreshIcon />} onClick={() => load(limit)} disabled={loading} sx={{ color: 'text.secondary' }}>
            Refresh
          </Button>
        }
      />

      <ErrorNote error={error} onRetry={() => load(limit)} />

      {loading && entries.length === 0 ? <Loading /> : entries.length === 0 ? (
        <EmptyState>Nothing logged yet — admin actions will show up here as you make them.</EmptyState>
      ) : (
        <>
          <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
            {entries.map((e, i) => {
              const describe = DESCRIBE[e.action]
              return (
                <Stack key={e.id} direction="row" alignItems="flex-start" spacing={2}
                  sx={{ px: 2.5, py: 1.5, borderTop: i ? '1px solid' : 'none', borderColor: 'divider' }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2">
                      <strong>{e.actorEmail || 'unknown'}</strong>{' '}
                      {describe ? describe(e.details) : e.action}
                    </Typography>
                    {!describe && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'ui-monospace, monospace' }}>
                        {JSON.stringify(e.details)}
                      </Typography>
                    )}
                  </Box>
                  {DESTRUCTIVE.has(e.action) && (
                    <Chip label="destructive" size="small" color="error" variant="outlined" sx={{ height: 18, fontSize: '0.625rem' }} />
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, width: 88, textAlign: 'right' }}>
                    {relativeTime(e.at)}
                  </Typography>
                </Stack>
              )
            })}
          </Box>

          {entries.length >= limit && limit < 500 && (
            <Stack alignItems="center" sx={{ mt: 2 }}>
              <Button size="small" onClick={() => setLimit(l => Math.min(l + 200, 500))} sx={{ color: 'text.secondary' }}>
                Load more
              </Button>
            </Stack>
          )}
        </>
      )}
    </Box>
  )
}
