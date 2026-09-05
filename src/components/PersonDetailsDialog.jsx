import { useState, useEffect, useRef, forwardRef } from 'react'
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
import Stack from '@mui/material/Stack'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AddIcon from '@mui/icons-material/Add'
import { getAvatarColor } from '../utils/dateUtils'
import { PhotoPicker, DateRangeInput, RoleField, ConfirmDialog } from './Modals'

const SlideUp = forwardRef((props, ref) => <Slide direction="up" ref={ref} {...props} />)

function formatDateRange(start, end) {
  const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
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
  onAddRole,        // async (role: string) => void — registers a brand-new role typed in the field
}) {
  // Time off form
  const [addingTimeOff,  setAddingTimeOff]  = useState(false)
  const [editingTimeOff, setEditingTimeOff] = useState(null) // original entry being edited
  const [toStart,        setToStart]        = useState('')
  const [toEnd,          setToEnd]          = useState('')
  const [savingTo,       setSavingTo]       = useState(false)

  // Profile fields — edited directly in this dialog (no separate "Edit details" dialog)
  const [editName,  setEditName]  = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole,  setEditRole]  = useState('')
  const [editPhoto, setEditPhoto] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const lastPersonRef = useRef(null)

  // Reset profile fields whenever the dialog opens for a (possibly different) person.
  // Also re-sync on name/email/role/photo change, not just id — the own-profile view
  // uses a synthetic person object with a constant id ('__own_profile__'), so if the
  // dialog opens before the real profile data has finished loading, watching id alone
  // would never notice the fields filling in afterward and they'd stay stuck empty.
  useEffect(() => {
    if (open && person) {
      setEditName(person.name  || '')
      setEditEmail(person.email || '')
      setEditRole(person.role  || '')
      setEditPhoto(person.photo || null)
    }
  }, [open, person?.id, person?.name, person?.email, person?.role, person?.photo]) // eslint-disable-line

  // Reset time off forms when dialog closes
  useEffect(() => {
    if (!open) {
      setAddingTimeOff(false); setEditingTimeOff(null)
      setToStart(''); setToEnd(''); setSavingTo(false)
    }
  }, [open])

  // Keep rendering the last known person while the dialog is fading out —
  // callers often null out the selected person in the same tick as `open`
  // going false, which would otherwise unmount this dialog instantly and
  // skip its exit transition.
  if (person) lastPersonRef.current = person
  const displayPerson = person || lastPersonRef.current
  if (!displayPerson) return null

  const timeOffList = displayPerson.timeOff || []
  const avatarColor = getAvatarColor(displayPerson.name)
  const letter      = displayPerson.name?.charAt(0).toUpperCase()
  const allRoles    = roles || ['Designer', 'PM', 'Dev']
  const canEditProfile = canEdit && !!onUpdatePerson

  const handleSaveProfile = async () => {
    if (!editName.trim()) return
    setSavingProfile(true)
    try {
      const roleToUse = editRole.trim()
      if (roleToUse && !allRoles.includes(roleToUse)) await onAddRole?.(roleToUse)
      await onUpdatePerson?.({ name: editName.trim(), email: editEmail.trim() || null, role: roleToUse, photo: editPhoto })
    } finally {
      setSavingProfile(false)
    }
  }

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
      id: editing?.id || `to_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
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

  const handleDeleteTimeOff = async (to) => {
    resetToForm()
    await onRemoveTimeOff?.(to)
  }

  const startEdit = (to) => {
    setEditingTimeOff(to); setToStart(to.start); setToEnd(to.end); setAddingTimeOff(false)
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
      slots={{ transition: SlideUp }}
      transitionDuration={{ enter: 300, exit: 220 }}
    >
        <DialogTitle sx={{ pb: 1, pr: 5 }}>
          {displayPerson.name}
          <IconButton onClick={onClose} size="small"
            sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pb: 2 }}>
          {/* ── Profile — directly editable, no separate "Edit details" dialog ── */}
          {canEditProfile ? (
            <Stack spacing={2}>
              <Box sx={{ background: '#f9fafb', borderRadius: 2, p: 1.5 }}>
                <Typography variant="caption" color="text.secondary"
                  sx={{ display: 'block', mb: 0.75, fontWeight: 600 }}>
                  Profile photo
                </Typography>
                <PhotoPicker value={editPhoto} onChange={setEditPhoto} />
              </Box>
              <TextField size="small" label="Name" fullWidth value={editName}
                onChange={e => setEditName(e.target.value)} />
              <TextField size="small" label="Email" fullWidth type="email" value={editEmail}
                onChange={e => setEditEmail(e.target.value)} />
              <RoleField value={editRole} onChange={setEditRole} roles={allRoles} />
            </Stack>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{
                width: 52, height: 52, borderRadius: '50%',
                background: displayPerson.photo ? 'transparent' : avatarColor,
                flexShrink: 0, overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: '#fff',
              }}>
                {displayPerson.photo
                  ? <img src={displayPerson.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : letter}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ lineHeight: 1.2 }}>{displayPerson.name}</Typography>
                {displayPerson.role  && <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.2 }}>{displayPerson.role}</Typography>}
                {displayPerson.email && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>{displayPerson.email}</Typography>}
              </Box>
            </Box>
          )}

          {/* ── Time off section — grey box + label, matching Photo above ── */}
          {(timeOffList.length > 0 || addingTimeOff) && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ background: '#f9fafb', borderRadius: 2, p: 1.5 }}>
                <Typography variant="caption" color="text.secondary"
                  sx={{ display: 'block', mb: 0.75, fontWeight: 600 }}>
                  Time off
                </Typography>
                {timeOffList.map((to, i) => (
                  <Box key={to.id} sx={{ mb: i < timeOffList.length - 1 || addingTimeOff || (canEdit && !editingTimeOff) ? 1 : 0 }}>
                    {editingTimeOff?.id === to.id ? (
                      <Box sx={{ background: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                        <DateRangeInput start={toStart} end={toEnd} onStartChange={setToStart} onEndChange={setToEnd} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
                          <Button size="small" color="error" onClick={() => handleDeleteTimeOff(to)}>Delete</Button>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button size="small" onClick={resetToForm}>Cancel</Button>
                            <Button size="small" variant="contained" onClick={handleSaveTimeOff}
                              disabled={savingTo || !toStart || !toEnd || toEnd < toStart}>
                              {savingTo ? '…' : 'Save'}
                            </Button>
                          </Box>
                        </Box>
                      </Box>
                    ) : (
                      <Box
                        onClick={() => canEdit && startEdit(to)}
                        sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          py: 1, px: 1.5, background: '#fff', borderRadius: 2,
                          cursor: canEdit ? 'pointer' : 'default',
                          transition: 'background 0.12s',
                          '&:hover': canEdit ? { background: '#f3f4f6' } : {},
                        }}
                      >
                        <Typography variant="body2">{formatDateRange(to.start, to.end)}</Typography>
                        {canEdit && <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
                      </Box>
                    )}
                  </Box>
                ))}

                {/* Add time off form — collapses in/out */}
                {canEdit && !editingTimeOff && (
                  <Collapse in={addingTimeOff} unmountOnExit>
                    <Box sx={{ background: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                      <DateRangeInput start={toStart} end={toEnd} onStartChange={setToStart} onEndChange={setToEnd} />
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1.5 }}>
                        <Button size="small" onClick={resetToForm}>Cancel</Button>
                        <Button size="small" variant="contained" onClick={handleSaveTimeOff}
                          disabled={savingTo || !toStart || !toEnd || toEnd < toStart}>
                          {savingTo ? 'Adding…' : 'Add'}
                        </Button>
                      </Box>
                    </Box>
                  </Collapse>
                )}

                {canEdit && !addingTimeOff && !editingTimeOff && (
                  <Button size="small" startIcon={<AddIcon />}
                    onClick={() => { setAddingTimeOff(true); setEditingTimeOff(null) }}>
                    Add time off
                  </Button>
                )}
              </Box>
            </Box>
          )}

          {/* No time off yet — plain trigger, no section box until they start adding */}
          {canEdit && timeOffList.length === 0 && !addingTimeOff && (
            <Button size="small" startIcon={<AddIcon />} sx={{ mt: 2 }}
              onClick={() => setAddingTimeOff(true)}>
              Add time off
            </Button>
          )}
        </DialogContent>

        <DialogActions>
          {onDelete && (
            <Button color="error" onClick={() => setDeleteConfirmOpen(true)}>
              Delete
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onClose}>Cancel</Button>
          {canEditProfile && (
            <Button variant="contained" onClick={handleSaveProfile}
              disabled={savingProfile || !editName.trim()
                || (editName.trim() === (displayPerson.name || '') && (editEmail.trim() || null) === (displayPerson.email || null) && editRole === (displayPerson.role || '') && editPhoto === (displayPerson.photo || null))}>
              {savingProfile ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Remove person"
        message={`Remove ${displayPerson.name} from this board?`}
        onConfirm={() => { setDeleteConfirmOpen(false); onDelete(); onClose() }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </>
  )
}
