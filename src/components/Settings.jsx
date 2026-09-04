import { useState, forwardRef } from 'react'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import InputLabel from '@mui/material/InputLabel'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Slide from '@mui/material/Slide'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AddIcon from '@mui/icons-material/Add'
import { getAvatarColor } from '../utils/dateUtils'
import { PhotoPicker } from './Modals'

// ── Shared slide-up transition ────────────────────────────────────────────────
const SlideUp = forwardRef((props, ref) => <Slide direction="up" ref={ref} {...props} />)

// ── Phase colors palette ──────────────────────────────────────────────────────
const PHASE_COLORS = ['#60A5FA','#FBBF24','#FB923C','#34D399','#A78BFA','#F87171','#4ADE80','#38BDF8']

// ── Add person dialog (stacked) ───────────────────────────────────────────────
function AddPersonDialog({ open, onClose, roles, onSave, onAddRole, recentPeople = [] }) {
  const [query,      setQuery]      = useState('')
  const [dropOpen,   setDropOpen]   = useState(false)
  const [selected,   setSelected]   = useState(null)
  const [email,      setEmail]      = useState('')
  const [photo,      setPhoto]      = useState(null)
  const [role,       setRole]       = useState('Designer')
  const [customRole, setCustomRole] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)

  const reset = () => {
    setQuery(''); setDropOpen(false); setSelected(null)
    setEmail(''); setPhoto(null); setRole('Designer'); setCustomRole('')
    setFocusedIdx(-1)
  }

  const handleClose = () => { reset(); onClose() }

  const filtered = recentPeople.filter(p =>
    !query || p.name?.toLowerCase().includes(query.toLowerCase()) ||
    p.email?.toLowerCase().includes(query.toLowerCase())
  )
  const dropList = query.length === 0 ? recentPeople : filtered

  const handleSelect = (person) => {
    setSelected(person); setQuery(person.name)
    setEmail(person.email || ''); setPhoto(person.photo || null)
    setRole(person.role || 'Designer'); setDropOpen(false); setFocusedIdx(-1)
  }

  const isNew = !selected && query.trim().length > 0

  const handleSave = async () => {
    if (!query.trim()) return
    setSaving(true)
    const roleToUse = role === '__custom__' ? customRole.trim() : role
    if (roleToUse && !roles?.includes(roleToUse)) await onAddRole?.(roleToUse)
    await onSave({ name: query.trim(), email: email.trim() || null, photo: photo || null, role: roleToUse || 'Designer' })
    setSaving(false)
    handleClose()
  }

  return (
    <Dialog open={open} onClose={handleClose}
      TransitionComponent={SlideUp} TransitionProps={{ timeout: { enter: 300, exit: 220 } }}
      PaperProps={{ sx: { minHeight: 360, overflow: 'visible' } }}>
      <DialogTitle sx={{ pr: 5 }}>
        Add person
        <IconButton size="small" onClick={handleClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: '12px !important', overflow: 'visible' }}>
        <Stack spacing={2}>
          {isNew && <PhotoPicker value={photo} onChange={setPhoto} />}
          <Box sx={{ position: 'relative' }}>
            <TextField
              label="Name or email" size="small" fullWidth autoFocus
              value={query}
              onChange={e => {
                setQuery(e.target.value); setSelected(null); setDropOpen(true); setFocusedIdx(-1)
              }}
              onFocus={() => setDropOpen(true)}
              onBlur={() => setTimeout(() => setDropOpen(false), 150)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setFocusedIdx(i => Math.min(i + 1, dropList.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setFocusedIdx(i => Math.max(i - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  if (focusedIdx >= 0 && dropList[focusedIdx]) {
                    handleSelect(dropList[focusedIdx])
                  } else if (dropList.length > 0 && !selected) {
                    handleSelect(dropList[0])
                  } else {
                    setDropOpen(false)
                  }
                } else if (e.key === 'Escape') {
                  setDropOpen(false); setFocusedIdx(-1)
                }
              }}
              slotProps={selected ? {
                input: {
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 0 }}>
                      <Box sx={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: getAvatarColor(selected.name),
                        overflow: 'hidden', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                      }}>
                        {selected.photo
                          ? <img src={selected.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : selected.name?.charAt(0).toUpperCase()}
                      </Box>
                    </InputAdornment>
                  )
                }
              } : undefined}
            />
            {dropOpen && recentPeople.length > 0 && (
              <Box sx={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1500,
                background: '#fff', border: '1px solid', borderColor: 'divider',
                borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                maxHeight: 220, overflowY: 'auto', mt: 0.5,
              }}>
                {dropList.map((p, idx) => (
                  <Box key={p.email || p.name} onMouseDown={() => handleSelect(p)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, p: '8px 12px',
                      cursor: 'pointer',
                      background: focusedIdx === idx ? '#f3f4f6' : 'transparent',
                      '&:hover': { background: '#f3f4f6' },
                    }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', background: getAvatarColor(p.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                      {p.photo ? <img src={p.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : p.name?.charAt(0).toUpperCase()}
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body2" fontWeight={500} sx={{ lineHeight: 1.2 }}>{p.name}</Typography>
                      {p.role && <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>{p.role}</Typography>}
                    </Box>
                  </Box>
                ))}
                {query.length > 0 && filtered.length === 0 && (
                  <Typography variant="caption" sx={{ p: '8px 12px', display: 'block', color: 'text.secondary' }}>
                    Press Save to add "{query}" as a new person
                  </Typography>
                )}
              </Box>
            )}
          </Box>

          {isNew && (
            <>
              <TextField label="Email (optional)" size="small" fullWidth type="email"
                value={email} onChange={e => setEmail(e.target.value)} />
              <FormControl size="small" fullWidth>
                <InputLabel>Role</InputLabel>
                <Select label="Role" value={role} onChange={e => setRole(e.target.value)}>
                  {(roles || ['Designer', 'PM', 'Dev']).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  <MenuItem value="__custom__">+ New role…</MenuItem>
                </Select>
              </FormControl>
              {role === '__custom__' && (
                <TextField label="Role name" size="small" fullWidth
                  value={customRole} onChange={e => setCustomRole(e.target.value)} />
              )}
            </>
          )}

          {selected && (
            <FormControl size="small" fullWidth>
              <InputLabel>Role</InputLabel>
              <Select label="Role" value={role} onChange={e => setRole(e.target.value)}>
                {(roles || ['Designer', 'PM', 'Dev']).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !query.trim()}>
          {saving ? 'Saving…' : selected ? 'Add to board' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Add / Edit phase dialog (stacked) ─────────────────────────────────────────
function PhaseDialog({ open, onClose, existingPhases, phase, onSave, onDelete }) {
  const isEditing = Boolean(phase)
  const usedColors = (existingPhases || []).filter(p => p.id !== phase?.id).map(p => p.color)
  const defaultColor = PHASE_COLORS.find(c => !usedColors.includes(c)) || PHASE_COLORS[0]

  const [name,     setName]     = useState(phase?.name  || '')
  const [color,    setColor]    = useState(phase?.color  || defaultColor)
  const [optional, setOptional] = useState(phase?.optional || false)

  // reset when dialog opens for a different phase
  const [lastId, setLastId] = useState(phase?.id)
  if (phase?.id !== lastId) {
    setLastId(phase?.id)
    setName(phase?.name || '')
    setColor(phase?.color || defaultColor)
    setOptional(phase?.optional || false)
  }

  const handleClose = () => { onClose() }

  const handleSave = () => {
    if (!name.trim()) return
    const id = isEditing
      ? phase.id
      : name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    onSave({ id, name: name.trim(), color, optional })
    handleClose()
  }

  return (
    <Dialog open={open} onClose={handleClose}
      TransitionComponent={SlideUp} TransitionProps={{ timeout: { enter: 300, exit: 220 } }}>
      <DialogTitle sx={{ pr: 5 }}>
        {isEditing ? 'Edit phase' : 'Add phase'}
        <IconButton size="small" onClick={handleClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: '12px !important' }}>
        <Stack spacing={2}>
          <TextField
            label="Phase name" size="small" fullWidth autoFocus
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
          />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Color</Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {PHASE_COLORS.map(c => (
                <Box key={c} onClick={() => setColor(c)} sx={{
                  width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: color === c ? '3px solid #111827' : '2px solid transparent',
                  transition: 'border 0.12s, transform 0.1s',
                  '&:hover': { transform: 'scale(1.15)' },
                }} />
              ))}
            </Box>
          </Box>

          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={optional}
                onChange={e => setOptional(e.target.checked)}
                sx={{ color: 'text.secondary' }}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Optional phase</Typography>
                <Typography variant="caption" color="text.secondary">
                  Not added to tasks by default — can be toggled on per task
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', mt: 0.5 }}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        {isEditing && onDelete && (
          <Button color="error" onClick={() => { onDelete(phase.id); handleClose() }}>Delete</Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!name.trim()}>
          {isEditing ? 'Save' : 'Add phase'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Board rename dialog ───────────────────────────────────────────────────────
function RenameBoardDialog({ board, onSave, onClose }) {
  const [name, setName] = useState(board?.name || '')

  const handleSave = () => {
    if (name.trim() && name.trim() !== board?.name) onSave(board.id, name.trim())
    onClose()
  }

  return (
    <Dialog open onClose={onClose}
      TransitionComponent={SlideUp} TransitionProps={{ timeout: { enter: 300, exit: 220 } }}>
      <DialogTitle sx={{ pr: 5 }}>
        Rename board
        <IconButton size="small" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: '12px !important' }}>
        <TextField
          label="Board name" size="small" fullWidth autoFocus
          value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!name.trim()}>Save</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Main Settings dialog ──────────────────────────────────────────────────────
export default function Settings({
  onClose, boardId, people, roles,
  boardPhases, onUpdateBoardPhases,
  onUpdatePerson, onDeletePerson, onAddPerson, onAddRole,
  isOwner, recentPeople = [],
  board, onRenameBoard, onDeleteBoard,
  onPersonClick,
}) {
  const [personDialogOpen, setPersonDialogOpen] = useState(false)
  const [phaseDialogOpen,  setPhaseDialogOpen]  = useState(false)
  const [editingPhase,     setEditingPhase]     = useState(null)  // phase object | null
  const [showRename,       setShowRename]       = useState(false)

  const openAddPhase  = () => { setEditingPhase(null); setPhaseDialogOpen(true) }
  const openEditPhase = (phase) => { setEditingPhase(phase); setPhaseDialogOpen(true) }

  const handlePhaseSave = (newPhase) => {
    const current = boardPhases || []
    if (editingPhase) {
      // Replace the edited phase in place
      onUpdateBoardPhases(current.map(p => p.id === newPhase.id ? newPhase : p))
    } else {
      // Insert before Handoff if it exists, otherwise append
      const handoffIdx = current.findIndex(p => p.id === 'handoff')
      if (handoffIdx >= 0) {
        const next = [...current]
        next.splice(handoffIdx, 0, newPhase)
        onUpdateBoardPhases(next)
      } else {
        onUpdateBoardPhases([...current, newPhase])
      }
    }
    setPhaseDialogOpen(false)
    setEditingPhase(null)
  }

  const handleDeletePhase = (phaseId) => {
    if ((boardPhases || []).length <= 1) return
    onUpdateBoardPhases((boardPhases || []).filter(p => p.id !== phaseId))
  }

  return (
    <>
      {/* ── Main settings dialog ── */}
      <Dialog
        open
        onClose={onClose}
        scroll="paper"
        TransitionComponent={SlideUp}
        TransitionProps={{ timeout: { enter: 300, exit: 220 } }}
        PaperProps={{ sx: { maxHeight: '85vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          Board settings
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          <Box sx={{ p: '8px 0' }}>

            {/* ── People ── */}
            <Box sx={{ px: 2.5, py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">People</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => setPersonDialogOpen(true)}>
                  Add person
                </Button>
              </Box>

              {people.map(person => (
                <Box
                  key={person.id}
                  onClick={() => onPersonClick?.(person)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, p: '8px 12px',
                    borderRadius: 2, cursor: onPersonClick ? 'pointer' : 'default',
                    transition: 'background 0.12s',
                    '&:hover': onPersonClick ? { background: '#f3f4f6' } : {},
                  }}
                >
                  <Box sx={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: getAvatarColor(person.name), overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#fff',
                  }}>
                    {person.photo
                      ? <img src={person.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : person.name?.charAt(0).toUpperCase()}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={500} noWrap sx={{ lineHeight: 1.2 }}>{person.name}</Typography>
                    {person.role && (
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ lineHeight: 1.2 }}>
                        {person.role}
                      </Typography>
                    )}
                  </Box>
                  {onPersonClick && <ChevronRightIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />}
                </Box>
              ))}

              {people.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No people yet.</Typography>
              )}
            </Box>

            <Divider sx={{ mx: 2 }} />

            {/* ── Phases ── */}
            <Box sx={{ px: 2.5, py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Phases</Typography>
                {isOwner && (
                  <Button size="small" startIcon={<AddIcon />} onClick={openAddPhase}>Add phase</Button>
                )}
              </Box>

              {(boardPhases || []).map(phase => (
                <Box key={phase.id} onClick={isOwner ? () => openEditPhase(phase) : undefined} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 12px',
                  borderRadius: 2,
                  cursor: isOwner ? 'pointer' : 'default',
                  '&:hover': isOwner ? { background: '#f3f4f6' } : {},
                }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: phase.color, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ flex: 1 }}>{phase.name}</Typography>
                  {phase.optional && (
                    <Typography variant="caption" sx={{
                      px: 0.75, py: 0.25, borderRadius: 1,
                      background: `${phase.color}22`, color: phase.color,
                      fontWeight: 600, fontSize: 10, letterSpacing: 0.3, flexShrink: 0,
                    }}>
                      optional
                    </Typography>
                  )}
                  {isOwner && <ChevronRightIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />}
                </Box>
              ))}
            </Box>

            {/* ── Board actions ── */}
            {isOwner && (onRenameBoard || onDeleteBoard) && (
              <>
                <Divider sx={{ mx: 2 }} />
                <Box sx={{ px: 2.5, py: 1.5 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Board</Typography>
                  {onRenameBoard && (
                    <Box onClick={() => setShowRename(true)} sx={{
                      display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 10px',
                      borderRadius: 2, cursor: 'pointer', '&:hover': { background: '#f3f4f6' },
                    }}>
                      <EditIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                      <Typography variant="body2">Rename board</Typography>
                    </Box>
                  )}
                  {onDeleteBoard && (
                    <Box
                      onClick={() => { if (window.confirm(`Delete "${board?.name}"? This cannot be undone.`)) { onDeleteBoard(board.id); onClose() } }}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 10px',
                        borderRadius: 2, cursor: 'pointer', '&:hover': { background: '#fff0f0' }, color: 'error.main',
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 20 }} />
                      <Typography variant="body2" color="error">Delete board</Typography>
                    </Box>
                  )}
                </Box>
              </>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* ── Stacked: add / edit person ── */}
      <AddPersonDialog
        open={personDialogOpen}
        onClose={() => setPersonDialogOpen(false)}
        roles={roles}
        onSave={onAddPerson}
        onAddRole={onAddRole}
        recentPeople={recentPeople}
      />

      {/* ── Stacked: add / edit phase ── */}
      <PhaseDialog
        open={phaseDialogOpen}
        onClose={() => { setPhaseDialogOpen(false); setEditingPhase(null) }}
        existingPhases={boardPhases || []}
        phase={editingPhase}
        onSave={handlePhaseSave}
        onDelete={handleDeletePhase}
      />

      {/* ── Stacked: rename board ── */}
      {showRename && (
        <RenameBoardDialog board={board} onSave={onRenameBoard} onClose={() => setShowRename(false)} />
      )}
    </>
  )
}

// Re-export icons for backward compat
export { EditIcon, DeleteIcon }
