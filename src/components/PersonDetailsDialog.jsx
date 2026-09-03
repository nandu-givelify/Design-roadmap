import { useState, useEffect, useRef } from 'react'
import Slide from '@mui/material/Slide'
import Collapse from '@mui/material/Collapse'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import { getAvatarColor } from '../utils/dateUtils'
import { PhotoPicker } from './Modals'

function formatDateRange(start, end) {
  const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
}

// ── Inline date range widget (no MUI label overlap) ───────────────────────────
function DateRangeInput({ start, end, onStartChange, onEndChange }) {
  const startRef = useRef(null)
  const endRef   = useRef(null)

  const openPicker = (ref) => {
    try { ref.current?.showPicker() } catch {}
  }

  const handleStartChange = (value) => {
    onStartChange(value)
    // Auto-open end date after start is chosen
    if (value) setTimeout(() => openPicker(endRef), 80)
  }

  const fieldBox = { flex: 1, p: 1.25, cursor: 'pointer', userSelect: 'none' }

  return (
    <Box sx={{
      display: 'flex',
      border: '1px solid', borderColor: 'divider', borderRadius: 2,
      overflow: 'hidden', mb: 1.5,
    }}>
      <Box sx={{ ...fieldBox, borderRight: '1px solid', borderColor: 'divider' }}
        onClick={() => openPicker(startRef)}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25, lineHeight: 1.2, pointerEvents: 'none' }}>
          Start
        </Typography>
        <input
          ref={startRef}
          type="date"
          value={start}
          onChange={e => handleStartChange(e.target.value)}
          style={{ border: 'none', outline: 'none', width: '100%', fontSize: 13, fontFamily: 'inherit', background: 'transparent', cursor: 'pointer', pointerEvents: 'none' }}
        />
      </Box>
      <Box sx={fieldBox} onClick={() => openPicker(endRef)}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25, lineHeight: 1.2, pointerEvents: 'none' }}>
          End
        </Typography>
        <input
          ref={endRef}
          type="date"
          value={end}
          min={start || undefined}
          onChange={e => onEndChange(e.target.value)}
          style={{ border: 'none', outline: 'none', width: '100%', fontSize: 13, fontFamily: 'inherit', background: 'transparent', cursor: 'pointer', pointerEvents: 'none' }}
        />
      </Box>
    </Box>
  )
}

// ── Edit person stacked dialog ────────────────────────────────────────────────
function EditPersonDialog({ open, onClose, person, onUpdatePerson, onDelete, roles }) {
  const [editName,     setEditName]     = useState(person?.name  || '')
  const [editEmail,    setEditEmail]    = useState(person?.email || '')
  const [editRole,     setEditRole]     = useState(person?.role  || '')
  const [editPhoto,    setEditPhoto]    = useState(person?.photo || null)
  const [saving,       setSaving]       = useState(false)

  // Reset fields whenever the dialog opens or person changes
  useEffect(() => {
    if (open && person) {
      setEditName(person.name  || '')
      setEditEmail(person.email || '')
      setEditRole(person.role  || '')
      setEditPhoto(person.photo || null)
    }
  }, [open, person?.id]) // eslint-disable-line

  const allRoles = roles || ['Designer', 'PM', 'Dev']

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdatePerson?.({ name: editName.trim(), email: editEmail.trim() || null, role: editRole, photo: editPhoto })
      onClose()
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
      disableEnforceFocus={false}
      TransitionComponent={Slide}
      TransitionProps={{ direction: 'up', timeout: 240 }}
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pr: 5 }}>
        Edit details
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <PhotoPicker value={editPhoto} onChange={setEditPhoto} />
        </Box>
        <Stack spacing={1.5}>
          <TextField size="small" label="Name" fullWidth value={editName}
            onChange={e => setEditName(e.target.value)} />
          <TextField size="small" label="Email" fullWidth type="email" value={editEmail}
            onChange={e => setEditEmail(e.target.value)} />
          <FormControl size="small" fullWidth>
            <InputLabel>Role</InputLabel>
            <Select label="Role" value={editRole} onChange={e => setEditRole(e.target.value)}>
              {allRoles.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, justifyContent: 'space-between' }}>
        <Box>
          {onDelete && (
            <Button size="small" color="error" onClick={() => { onDelete?.(); onClose() }}>
              Delete
            </Button>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={onClose}>Cancel</Button>
          <Button size="small" variant="contained" onClick={handleSave}
            disabled={saving || !editName.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PersonDetailsDialog({
  person,           // live person object (keep passing updated version for real-time)
  open,
  onClose,
  canEdit,          // can manage time off and person details
  onAddTimeOff,     // async (entry) => void
  onRemoveTimeOff,  // async (entry) => void
  onUpdatePerson,   // async (data: {name, role, email, photo}) => void  — null = no person edit
  onDelete,         // () => void — null = no delete option
  roles,            // string[] board roles for the role select
}) {
  // Time off form
  const [addingTimeOff,  setAddingTimeOff]  = useState(false)
  const [editingTimeOff, setEditingTimeOff] = useState(null) // original entry being edited
  const [toStart,        setToStart]        = useState('')
  const [toEnd,          setToEnd]          = useState('')
  const [savingTo,       setSavingTo]       = useState(false)

  // Edit person dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // Reset time off forms when dialog closes
  useEffect(() => {
    if (!open) {
      setAddingTimeOff(false); setEditingTimeOff(null)
      setToStart(''); setToEnd(''); setSavingTo(false)
      setEditDialogOpen(false)
    }
  }, [open])

  if (!person) return null

  const timeOffList = person.timeOff || []
  const avatarColor = getAvatarColor(person.name)
  const letter      = person.name?.charAt(0).toUpperCase()

  // ── Time off handlers ─────────────────────────────────────────────────────
  const resetToForm = () => {
    setAddingTimeOff(false); setEditingTimeOff(null); setToStart(''); setToEnd('')
  }

  const handleSaveTimeOff = async () => {
    if (!toStart || !toEnd || toEnd < toStart) return
    // Capture values before resetting form (resetToForm clears these)
    const start   = toStart
    const end     = toEnd
    const editing = editingTimeOff
    const newEntry = {
      id:    editing?.id || `to_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      start, end,
    }
    // Close form immediately so the snapshot re-render doesn't briefly show it again
    resetToForm()
    setSavingTo(true)
    try {
      if (editing) {
        await onRemoveTimeOff?.(editing)
        await onAddTimeOff?.(newEntry)
      } else {
        await onAddTimeOff?.(newEntry)
      }
    } finally {
      setSavingTo(false)
    }
  }

  const startEdit = (to) => {
    setEditingTimeOff(to); setToStart(to.start); setToEnd(to.end); setAddingTimeOff(false)
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="xs"
        fullWidth
        TransitionComponent={Grow}
        TransitionProps={{ timeout: 220 }}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1, pr: 5 }}>
          {person.name}
          <IconButton onClick={onClose} size="small"
            sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pb: 2 }}>
          {/* ── Avatar + info ── */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{
              width: 52, height: 52, borderRadius: '50%',
              background: person.photo ? 'transparent' : avatarColor,
              flexShrink: 0, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, color: '#fff',
            }}>
              {person.photo
                ? <img src={person.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : letter}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap>{person.name}</Typography>
              {person.role  && <Typography variant="body2" color="text.secondary">{person.role}</Typography>}
              {person.email && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{person.email}</Typography>}
            </Box>
            {canEdit && onUpdatePerson && (
              <IconButton size="small" onClick={() => setEditDialogOpen(true)} sx={{ flexShrink: 0 }}>
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </Box>

          {/* ── Time off section ── */}
          {timeOffList.length > 0 && (
            <>
              <Divider sx={{ mb: 1.5 }} />
              <Typography variant="caption" color="text.secondary"
                sx={{ display: 'block', mb: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Time off
              </Typography>
            </>
          )}

          {timeOffList.map(to => (
            <Box key={to.id} sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              py: 0.75, px: 1.25, mb: 0.5,
              border: '1px solid', borderColor: editingTimeOff?.id === to.id ? 'primary.main' : 'divider',
              borderRadius: 2,
            }}>
              {editingTimeOff?.id === to.id ? (
                <Box sx={{ flex: 1 }}>
                  <DateRangeInput start={toStart} end={toEnd} onStartChange={setToStart} onEndChange={setToEnd} />
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: -0.5 }}>
                    <Button size="small" onClick={resetToForm}>Cancel</Button>
                    <Button size="small" variant="contained" onClick={handleSaveTimeOff}
                      disabled={savingTo || !toStart || !toEnd || toEnd < toStart}>
                      {savingTo ? '…' : 'Save'}
                    </Button>
                  </Box>
                </Box>
              ) : (
                <>
                  <Typography variant="body2" fontWeight={500}>
                    {formatDateRange(to.start, to.end)}
                  </Typography>
                  {canEdit && (
                    <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
                      <IconButton size="small" onClick={() => startEdit(to)} sx={{ color: 'text.secondary' }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => onRemoveTimeOff?.(to)} sx={{ color: 'text.secondary' }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </>
              )}
            </Box>
          ))}

          {/* Add time off form — collapses in/out */}
          {canEdit && !editingTimeOff && (
            <Collapse in={addingTimeOff} unmountOnExit>
              <Box sx={{ mt: 0.5, mb: 0.5 }}>
                <DateRangeInput start={toStart} end={toEnd} onStartChange={setToStart} onEndChange={setToEnd} />
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: -0.5 }}>
                  <Button size="small" onClick={resetToForm}>Cancel</Button>
                  <Button size="small" variant="contained" onClick={handleSaveTimeOff}
                    disabled={savingTo || !toStart || !toEnd || toEnd < toStart}>
                    {savingTo ? 'Adding…' : 'Add'}
                  </Button>
                </Box>
              </Box>
            </Collapse>
          )}

          {/* Add button — shown when not adding */}
          {canEdit && !addingTimeOff && !editingTimeOff && (
            <Button size="small" startIcon={<AddIcon />}
              onClick={() => { setAddingTimeOff(true); setEditingTimeOff(null) }}
              sx={{ mt: timeOffList.length > 0 ? 0.5 : 0 }}
            >
              Add time off
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit person stacked dialog ── */}
      {canEdit && onUpdatePerson && (
        <EditPersonDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          person={person}
          onUpdatePerson={onUpdatePerson}
          onDelete={onDelete ? () => { onDelete(); onClose() } : null}
          roles={roles}
        />
      )}
    </>
  )
}
