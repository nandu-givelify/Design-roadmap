import { useState, useRef, useEffect } from 'react'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
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

// ── Enter-key navigation helper ───────────────────────────────────────────────
function useEnterNav(refs, onSubmit) {
  return (idx) => (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const next = refs[idx + 1]?.current
    if (next) next.focus()
    else onSubmit?.()
  }
}

// ── Inline edit form for a person ─────────────────────────────────────────────
function PersonEditForm({ person, roles, onSave, onDone, onAddRole, onDelete }) {
  const [name,       setName]       = useState(person.name  || '')
  const [email,      setEmail]      = useState(person.email || '')
  const [role,       setRole]       = useState(person.role  || 'Designer')
  const [photo,      setPhoto]      = useState(person.photo || null)
  const [customRole, setCustomRole] = useState('')
  const [saving,     setSaving]     = useState(false)

  const allRoles = [...(roles || ['Designer', 'PM', 'Dev'])]

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const roleToUse = role === '__custom__' ? customRole.trim() : role
    if (roleToUse && !allRoles.includes(roleToUse)) await onAddRole?.(roleToUse)
    await onSave(person.id, {
      name:  name.trim(),
      email: email.trim() || null,
      photo: photo || null,
      role:  roleToUse || 'Designer',
    })
    setSaving(false)
    onDone()
  }

  return (
    <Box sx={{ p: 2, background: '#f9fafb', borderRadius: 2, mt: 0.5, mb: 1 }}>
      <Stack spacing={1.5}>
        <TextField
          label="Full name" size="small" fullWidth
          value={name} onChange={e => setName(e.target.value)}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
        />
        <TextField
          label="Email (optional)" size="small" fullWidth type="email"
          value={email} onChange={e => setEmail(e.target.value)}
        />
        <FormControl size="small" fullWidth>
          <InputLabel>Role</InputLabel>
          <Select label="Role" value={role} onChange={e => setRole(e.target.value)}>
            {allRoles.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            <MenuItem value="__custom__">+ New role…</MenuItem>
          </Select>
        </FormControl>
        {role === '__custom__' && (
          <TextField
            label="Role name" size="small" fullWidth
            value={customRole} onChange={e => setCustomRole(e.target.value)}
          />
        )}
        <Box sx={{ background: '#eeeff1', borderRadius: 2, p: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Profile photo</Typography>
          <PhotoPicker value={photo} onChange={setPhoto} />
        </Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%' }}>
          <Button size="small" color="error" onClick={() => { onDone(); onDelete?.() }}>Delete</Button>
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={onDone}>Cancel</Button>
            <Button size="small" variant="contained" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  )
}

// ── Add person form ───────────────────────────────────────────────────────────
function AddPersonForm({ roles, onSave, onDone, onAddRole, recentPeople = [] }) {
  const [query,      setQuery]      = useState('')
  const [open,       setOpen]       = useState(false)
  const [selected,   setSelected]   = useState(null)
  const [email,      setEmail]      = useState('')
  const [photo,      setPhoto]      = useState(null)
  const [role,       setRole]       = useState('Designer')
  const [customRole, setCustomRole] = useState('')
  const [saving,     setSaving]     = useState(false)

  const filtered = recentPeople.filter(p =>
    !query || p.name?.toLowerCase().includes(query.toLowerCase()) ||
    p.email?.toLowerCase().includes(query.toLowerCase())
  )

  const handleSelect = (person) => {
    setSelected(person); setQuery(person.name)
    setEmail(person.email || ''); setPhoto(person.photo || null)
    setRole(person.role || 'Designer'); setOpen(false)
  }

  const isNew = !selected && query.trim().length > 0

  const handleSave = async () => {
    if (!query.trim()) return
    setSaving(true)
    const roleToUse = role === '__custom__' ? customRole.trim() : role
    if (roleToUse && !roles?.includes(roleToUse)) await onAddRole?.(roleToUse)
    await onSave({ name: query.trim(), email: email.trim() || null, photo: photo || null, role: roleToUse || 'Designer' })
    setSaving(false); onDone()
  }

  return (
    <Box sx={{ p: 2, background: '#f9fafb', borderRadius: 2, mt: 0.5, mb: 1, position: 'relative' }}>
      <Stack spacing={1.5}>
        <Box sx={{ position: 'relative' }}>
          <TextField
            label="Name or email" size="small" fullWidth
            value={query} autoFocus
            onChange={e => { setQuery(e.target.value); setSelected(null); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && (recentPeople.length > 0 || query.length > 0) && (
            <Box sx={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1400,
              background: '#fff', border: '1px solid', borderColor: 'divider',
              borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              maxHeight: 200, overflowY: 'auto', mt: 0.5,
            }}>
              {(query.length === 0 ? recentPeople : filtered).map(p => (
                <Box key={p.email || p.name} onMouseDown={() => handleSelect(p)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 12px', cursor: 'pointer', '&:hover': { background: '#f3f4f6' } }}>
                  {p.photo
                    ? <img src={p.photo} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                    : <Box sx={{ width: 28, height: 28, borderRadius: '50%', background: getAvatarColor(p.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {p.name?.charAt(0).toUpperCase()}
                      </Box>
                  }
                  <Box>
                    <Typography variant="body2" fontWeight={500}>{p.name}</Typography>
                    {p.email && <Typography variant="caption" color="text.secondary">{p.email}</Typography>}
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
            <TextField
              label="Email (optional)" size="small" fullWidth type="email"
              value={email} onChange={e => setEmail(e.target.value)}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Role</InputLabel>
              <Select label="Role" value={role} onChange={e => setRole(e.target.value)}>
                {(roles || ['Designer', 'PM', 'Dev']).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                <MenuItem value="__custom__">+ New role…</MenuItem>
              </Select>
            </FormControl>
            {role === '__custom__' && (
              <TextField
                label="Role name" size="small" fullWidth
                value={customRole} onChange={e => setCustomRole(e.target.value)}
              />
            )}
            <Box sx={{ background: '#f3f4f6', borderRadius: 2, p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Profile photo</Typography>
              <PhotoPicker value={photo} onChange={setPhoto} />
            </Box>
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

        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ width: '100%' }}>
          <Button size="small" onClick={onDone}>Cancel</Button>
          <Button size="small" variant="contained" onClick={handleSave} disabled={saving || !query.trim()}>
            {saving ? 'Saving…' : selected ? 'Add to board' : 'Save'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}

// ── Phase colors palette ──────────────────────────────────────────────────────
const PHASE_COLORS = ['#60A5FA','#FBBF24','#FB923C','#34D399','#A78BFA','#F87171','#4ADE80','#38BDF8']

function AddPhaseForm({ existingPhases, onSave, onDone }) {
  const [name,  setName]  = useState('')
  const usedColors = (existingPhases || []).map(p => p.color)
  const defaultColor = PHASE_COLORS.find(c => !usedColors.includes(c)) || PHASE_COLORS[0]
  const [color, setColor] = useState(defaultColor)

  const handleSave = () => {
    if (!name.trim()) return
    const id = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    onSave({ id, name: name.trim(), color })
  }

  return (
    <Box sx={{ p: 2, background: '#f9fafb', borderRadius: 2, mt: 0.5 }}>
      <Stack spacing={1.5}>
        <TextField
          label="Phase name" size="small" fullWidth value={name}
          onChange={e => setName(e.target.value)} autoFocus
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
        />
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {PHASE_COLORS.map(c => (
            <Box key={c} onClick={() => setColor(c)} sx={{
              width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer',
              border: color === c ? '3px solid #111827' : '2px solid transparent',
              transition: 'border 0.12s',
            }} />
          ))}
        </Box>
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ width: '100%' }}>
          <Button size="small" onClick={onDone}>Cancel</Button>
          <Button size="small" variant="contained" onClick={handleSave} disabled={!name.trim()}>Add</Button>
        </Stack>
      </Stack>
    </Box>
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
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Rename board
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          label="Board name" size="small" fullWidth autoFocus sx={{ mt: 0.5 }}
          value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!name.trim()}>Save</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Main Settings panel ───────────────────────────────────────────────────────
export default function Settings({
  onClose, boardId, people, roles,
  boardPhases, onUpdateBoardPhases,
  onUpdatePerson, onDeletePerson, onAddPerson, onAddRole,
  isOwner, recentPeople = [],
  board, onRenameBoard, onDeleteBoard,
}) {
  const [editingId,     setEditingId]     = useState(null)
  const [adding,        setAdding]        = useState(false)
  const [addingPhase,   setAddingPhase]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [showRename,    setShowRename]    = useState(false)

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return
    await onDeletePerson(confirmDelete.id)
    setConfirmDelete(null)
  }

  return (
    <>
      <Box className="settings-overlay" onClick={onClose} />
      <Box className="settings-panel">
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: '16px 20px', borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <Typography variant="subtitle1">Settings</Typography>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <Box sx={{ overflowY: 'auto', flex: 1, p: '8px 0' }}>

          {/* ── People ── */}
          <Box sx={{ px: 2.5, py: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">People</Typography>
              {!adding && (
                <Button size="small" startIcon={<AddIcon />} onClick={() => { setAdding(true); setEditingId(null) }}>
                  Add person
                </Button>
              )}
            </Box>

            {people.map(person => (
              <Box key={person.id}>
                <Box
                  onClick={() => setEditingId(editingId === person.id ? null : person.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 10px',
                    borderRadius: 2, cursor: 'pointer', transition: 'background 0.12s',
                    '&:hover': { background: '#f3f4f6' },
                  }}
                >
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: getAvatarColor(person.name), overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: '#fff',
                  }}>
                    {person.photo ? <img src={person.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : person.name?.charAt(0).toUpperCase()}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={500} noWrap>{person.name}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {person.role || 'No role'}{person.email ? ` · ${person.email}` : ''}
                    </Typography>
                  </Box>
                  <ChevronRightIcon sx={{
                    fontSize: 18, color: 'text.secondary', flexShrink: 0,
                    transform: editingId === person.id ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s',
                  }} />
                </Box>
                {editingId === person.id && (
                  <PersonEditForm
                    person={person} roles={roles}
                    onSave={onUpdatePerson} onDone={() => setEditingId(null)}
                    onAddRole={onAddRole}
                    onDelete={() => setConfirmDelete({ id: person.id, name: person.name })}
                  />
                )}
              </Box>
            ))}

            {people.length === 0 && !adding && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No people yet.</Typography>
            )}
            {adding && (
              <AddPersonForm roles={roles} onSave={onAddPerson} onDone={() => setAdding(false)} onAddRole={onAddRole} recentPeople={recentPeople} />
            )}
          </Box>

          <Divider sx={{ mx: 2 }} />

          {/* ── Phases ── */}
          <Box sx={{ px: 2.5, py: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">Phases</Typography>
              {!addingPhase && isOwner && (
                <Button size="small" startIcon={<AddIcon />} onClick={() => setAddingPhase(true)}>Add phase</Button>
              )}
            </Box>

            {(boardPhases || []).map(phase => (
              <Box key={phase.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: '6px 10px', borderRadius: 2 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: phase.color, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ flex: 1 }}>{phase.name}</Typography>
                {isOwner && (
                  <IconButton size="small" sx={{ width: 28, height: 28 }} title="Delete phase"
                    onClick={() => {
                      if ((boardPhases || []).length <= 1) return
                      onUpdateBoardPhases((boardPhases || []).filter(p => p.id !== phase.id))
                    }}>
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
              </Box>
            ))}

            {addingPhase && isOwner && (
              <AddPhaseForm
                existingPhases={boardPhases || []}
                onSave={phase => { onUpdateBoardPhases([...(boardPhases || []), phase]); setAddingPhase(false) }}
                onDone={() => setAddingPhase(false)}
              />
            )}
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
                  <Box onClick={() => { if (window.confirm(`Delete "${board?.name}"? This cannot be undone.`)) { onDeleteBoard(board.id); onClose() } }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 10px',
                      borderRadius: 2, cursor: 'pointer', '&:hover': { background: '#fff0f0' }, color: 'error.main',
                    }}>
                    <DeleteIcon sx={{ fontSize: 20 }} />
                    <Typography variant="body2" color="error">Delete board</Typography>
                  </Box>
                )}
              </Box>
            </>
          )}
        </Box>

        {/* Confirm delete */}
        {confirmDelete && (
          <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', background: '#fff8f8' }}>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Delete <strong>{confirmDelete.name}</strong>? This cannot be undone.
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button size="small" variant="contained" color="error" onClick={handleDeleteConfirmed}>Delete</Button>
            </Stack>
          </Box>
        )}
      </Box>

      {showRename && (
        <RenameBoardDialog board={board} onSave={onRenameBoard} onClose={() => setShowRename(false)} />
      )}
    </>
  )
}

// Re-export icons for backward compat (used in other files)
export { EditIcon, DeleteIcon }
