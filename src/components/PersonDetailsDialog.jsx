import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import AddIcon from '@mui/icons-material/Add'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import { getAvatarColor } from '../utils/dateUtils'

function formatDateRange(start, end) {
  const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
}

export default function PersonDetailsDialog({
  person,
  open,
  onClose,
  canEdit,
  onAddTimeOff,
  onRemoveTimeOff,
}) {
  const [addingTimeOff, setAddingTimeOff] = useState(false)
  const [newStart,      setNewStart]      = useState('')
  const [newEnd,        setNewEnd]        = useState('')
  const [newReason,     setNewReason]     = useState('')
  const [saving,        setSaving]        = useState(false)

  if (!person) return null

  const timeOffList  = person.timeOff || []
  const avatarColor  = getAvatarColor(person.name)
  const letter       = person.name?.charAt(0).toUpperCase()

  const resetForm = () => { setNewStart(''); setNewEnd(''); setNewReason(''); setAddingTimeOff(false) }

  const handleAddTimeOff = async () => {
    if (!newStart || !newEnd || newEnd < newStart) return
    setSaving(true)
    try {
      await onAddTimeOff?.({
        id: `to_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        start: newStart,
        end:   newEnd,
        reason: newReason.trim() || undefined,
      })
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 1, pr: 5 }}>
        {person.name}
        <IconButton onClick={onClose} size="small"
          sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* Avatar + info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box sx={{
            width: 56, height: 56, borderRadius: '50%',
            background: person.photo ? 'transparent' : avatarColor,
            flexShrink: 0, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: '#fff',
          }}>
            {person.photo
              ? <img src={person.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : letter}
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>{person.name}</Typography>
            {person.role  && <Typography variant="body2" color="text.secondary">{person.role}</Typography>}
            {person.email && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{person.email}</Typography>}
          </Box>
        </Box>

        {/* Time off section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
          <EventBusyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={600}>Time off</Typography>
        </Box>

        {timeOffList.length === 0 && !addingTimeOff && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            No time off added.
          </Typography>
        )}

        {timeOffList.map(to => (
          <Box key={to.id} sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            py: 0.75, px: 1.5, mb: 0.5,
            border: '1px solid', borderColor: 'divider', borderRadius: 2,
          }}>
            <Box>
              <Typography variant="body2" fontWeight={500}>
                {formatDateRange(to.start, to.end)}
              </Typography>
              {to.reason && (
                <Typography variant="caption" color="text.secondary">{to.reason}</Typography>
              )}
            </Box>
            {canEdit && (
              <IconButton size="small" onClick={() => onRemoveTimeOff?.(to)}
                sx={{ color: 'text.secondary' }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        ))}

        {/* Add form */}
        {canEdit && addingTimeOff && (
          <Box sx={{ mt: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                size="small" label="Start" type="date"
                value={newStart} onChange={e => setNewStart(e.target.value)}
                InputLabelProps={{ shrink: true }} sx={{ flex: 1 }}
              />
              <TextField
                size="small" label="End" type="date"
                value={newEnd} onChange={e => setNewEnd(e.target.value)}
                inputProps={{ min: newStart }}
                InputLabelProps={{ shrink: true }} sx={{ flex: 1 }}
              />
            </Box>
            <TextField
              size="small" label="Reason (optional)" fullWidth
              value={newReason} onChange={e => setNewReason(e.target.value)}
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={resetForm}>Cancel</Button>
              <Button
                size="small" variant="contained" onClick={handleAddTimeOff}
                disabled={saving || !newStart || !newEnd || newEnd < newStart}
              >
                {saving ? 'Adding…' : 'Add'}
              </Button>
            </Box>
          </Box>
        )}

        {canEdit && !addingTimeOff && (
          <Button
            size="small" startIcon={<AddIcon />}
            onClick={() => setAddingTimeOff(true)}
            sx={{ mt: 1 }}
          >
            Add time off
          </Button>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} size="small">Close</Button>
      </DialogActions>
    </Dialog>
  )
}
