// Small pieces shared across the admin panels.
import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'

// The app theme pins every dialog to 480px (see src/theme.js). Admin dialogs
// that show tables or long lists opt out through this prop.
export const wideDialog = (px = 640) => ({ paper: { sx: { maxWidth: px } } })

export function SectionHeader({ title, subtitle, action }) {
  return (
    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2.5, gap: 2 }}>
      <Box>
        <Typography variant="h6">{title}</Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>
        )}
      </Box>
      {action}
    </Stack>
  )
}

export function Loading({ label = 'Loading…' }) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 8 }}>
      <CircularProgress size={22} sx={{ color: 'text.secondary' }} />
      <Typography variant="body2" color="text.secondary">{label}</Typography>
    </Stack>
  )
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null
  return (
    <Alert
      severity="error"
      sx={{ mb: 2, borderRadius: 2 }}
      action={onRetry && <Button size="small" color="inherit" onClick={onRetry}>Retry</Button>}
    >
      {error}
    </Alert>
  )
}

export function EmptyState({ children }) {
  return (
    <Box sx={{ py: 6, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary">{children}</Typography>
    </Box>
  )
}

// Confirm dialog that can require typing an exact phrase before the destructive
// button unlocks — used for board deletion, where a stray click would take a
// team's tasks with it.
export function ConfirmDialog({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', danger = false, requirePhrase = null,
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const armed = !requirePhrase || typed.trim() === requirePhrase

  const handleConfirm = async () => {
    setBusy(true); setErr(null)
    try {
      await onConfirm()
      setTyped('')
      onClose()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleClose = () => { if (!busy) { setTyped(''); setErr(null); onClose() } }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">{message}</Typography>
        {err && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{err}</Alert>}
        {requirePhrase && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Type <strong>{requirePhrase}</strong> to confirm
            </Typography>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid #e5e7eb', font: 'inherit', fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          disabled={busy || !armed}
          variant="contained"
          sx={danger ? { bgcolor: 'error.main', '&:hover': { bgcolor: '#b91c1c' } } : undefined}
        >
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// Sticky action bar that appears above a list once one or more rows are
// checked. `actions` is [{ label, onClick, danger }]. Stays out of the way
// (renders nothing) when nothing is selected.
export function BulkBar({ count, onClear, actions }) {
  if (!count) return null
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{
      mb: 2, px: 2, py: 1, borderRadius: 2.5,
      bgcolor: '#111827', color: '#fff',
    }}>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {count} selected
      </Typography>
      <Box sx={{ flex: 1 }} />
      {actions.map((a) => (
        <Button
          key={a.label}
          size="small"
          onClick={a.onClick}
          sx={{ color: a.danger ? '#fca5a5' : '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
        >
          {a.label}
        </Button>
      ))}
      <Button size="small" onClick={onClear} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
        Clear
      </Button>
    </Stack>
  )
}

// Confirm dialog for a bulk action across many rows at once — lists what it
// will affect instead of requiring an exact-phrase type-in per item (that
// doesn't scale past one), and reports which rows failed rather than letting
// one failure hide the rest silently.
export function BulkConfirmDialog({
  open, onClose, onConfirmEach, items, itemLabel,
  title, message, confirmLabel = 'Confirm', danger = false,
}) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // { ok, failed: [{label, error}] }

  const handleClose = () => { if (!busy) { setResult(null); onClose() } }

  const handleConfirm = async () => {
    setBusy(true)
    const failed = []
    let ok = 0
    for (const item of items) {
      try { await onConfirmEach(item); ok++ }
      catch (e) { failed.push({ label: itemLabel(item), error: e.message }) }
    }
    setBusy(false)
    setResult({ ok, failed })
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>{result ? 'Done' : title}</DialogTitle>
      <DialogContent>
        {result ? (
          <Stack spacing={1.5}>
            <Typography variant="body2">
              {result.ok} of {items.length} succeeded.
            </Typography>
            {result.failed.length > 0 && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                <Stack spacing={0.5}>
                  {result.failed.map((f, i) => (
                    <Typography key={i} variant="body2">{f.label}: {f.error}</Typography>
                  ))}
                </Stack>
              </Alert>
            )}
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">{message}</Typography>
            <Box sx={{
              maxHeight: 160, overflowY: 'auto', p: 1, borderRadius: 2,
              bgcolor: '#fafafa', border: '1px solid', borderColor: 'divider',
            }}>
              {items.map((item, i) => (
                <Typography key={i} variant="body2" sx={{ py: 0.25 }}>{itemLabel(item)}</Typography>
              ))}
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {result ? (
          <Button variant="contained" onClick={handleClose}>Close</Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={busy} sx={{ color: 'text.secondary' }}>Cancel</Button>
            <Button
              onClick={handleConfirm}
              disabled={busy}
              variant="contained"
              sx={danger ? { bgcolor: 'error.main', '&:hover': { bgcolor: '#b91c1c' } } : undefined}
            >
              {busy ? 'Working…' : confirmLabel}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

// ── Formatting ───────────────────────────────────────────────────────────────
export function relativeTime(iso) {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const secs = Math.round((Date.now() - then) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
