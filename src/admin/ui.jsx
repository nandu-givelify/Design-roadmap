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
