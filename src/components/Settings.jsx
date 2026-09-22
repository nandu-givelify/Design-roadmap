import { useState, useEffect, forwardRef } from 'react'
import TextField from '@mui/material/TextField'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Switch from '@mui/material/Switch'
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
import ShareIcon from '@mui/icons-material/IosShare'
import { getAvatarColor } from '../utils/dateUtils'
import { PROJECT_COLORS } from '../utils/colors'
import { AddPersonDialog, ConfirmDialog, ColorSwatchPicker } from './Modals'
import { useMountWhileOpen } from '../hooks/useMountWhileOpen'

// ── Shared slide-up transition ────────────────────────────────────────────────
const SlideUp = forwardRef((props, ref) => <Slide direction="up" ref={ref} {...props} />)

// Transparent 1×1 GIF — used as invisible drag image for phase reordering
const TRANSPARENT_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

// ── Add / Edit phase dialog (stacked) ─────────────────────────────────────────
function PhaseDialog({ open, onClose, existingPhases, phase, onSave, onDelete }) {
  const isEditing = Boolean(phase)

  const [name,     setName]     = useState(phase?.name  || '')
  const [optional, setOptional] = useState(phase?.optional || false)

  // Reset whenever the dialog (re)opens — it's kept mounted across opens
  // (there's no unmount-while-closed gating here), and for "Add phase" both
  // openings have `phase === null`, so resetting only on an id change would
  // never fire between two separate add-phase sessions, silently carrying
  // over whatever was typed into the previous one.
  useEffect(() => {
    if (!open) return
    setName(phase?.name || '')
    setOptional(phase?.optional || false)
  }, [open, phase?.id]) // eslint-disable-line

  const handleClose = () => { onClose() }

  const handleSave = () => {
    if (!name.trim()) return
    const id = isEditing
      ? phase.id
      : name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    onSave({ id, name: name.trim(), optional })
    handleClose()
  }

  return (
    <Dialog open={open} onClose={handleClose}
      slots={{ transition: SlideUp }}
      transitionDuration={{ enter: 300, exit: 220 }}
    >
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

// ── Add / Edit project dialog (stacked) ───────────────────────────────────────
function ProjectDialog({ open, onClose, existingProjects, project, onSave, onDelete }) {
  const isEditing = Boolean(project)
  const usedColors = (existingProjects || []).filter(p => p.id !== project?.id).map(p => p.color)
  const defaultColor = PROJECT_COLORS.find(c => !usedColors.includes(c)) || PROJECT_COLORS[0]

  const [name,  setName]  = useState(project?.name  || '')
  const [color, setColor] = useState(project?.color || defaultColor)

  // See PhaseDialog above for why this resets on every open rather than only
  // on an id change — "Add project" always has `project === null`.
  useEffect(() => {
    if (!open) return
    setName(project?.name || '')
    setColor(project?.color || defaultColor)
  }, [open, project?.id]) // eslint-disable-line

  const handleClose = () => { onClose() }

  const handleSave = () => {
    if (!name.trim()) return
    const id = isEditing
      ? project.id
      : name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `p${Date.now()}`
    onSave({ id, name: name.trim(), color })
    handleClose()
  }

  return (
    <Dialog open={open} onClose={handleClose}
      slots={{ transition: SlideUp }}
      transitionDuration={{ enter: 300, exit: 220 }}
    >
      <DialogTitle sx={{ pr: 5 }}>
        {isEditing ? 'Edit project' : 'Add project'}
        <IconButton size="small" onClick={handleClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: '12px !important' }}>
        <Stack spacing={2}>
          <TextField
            label="Project name" size="small" fullWidth autoFocus
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
          />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Color</Typography>
            <ColorSwatchPicker colors={PROJECT_COLORS} value={color} onChange={setColor} />
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        {isEditing && onDelete && (
          <Button color="error" onClick={() => { onDelete(project.id); handleClose() }}>Delete</Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!name.trim()}>
          {isEditing ? 'Save' : 'Add project'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Board rename dialog ───────────────────────────────────────────────────────
function RenameBoardDialog({ open, board, onSave, onClose }) {
  const [name, setName] = useState(board?.name || '')

  const handleSave = () => {
    if (board && name.trim() && name.trim() !== board.name) onSave(board.id, name.trim())
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose}
      slots={{ transition: SlideUp }}
      transitionDuration={{ enter: 300, exit: 220 }}
    >
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
  open = true, onClose, boardId, people, roles,
  boardPhases, onUpdateBoardPhases,
  boardProjects, onUpdateBoardProjects,
  onUpdatePerson, onDeletePerson, onAddPerson, onAddRole,
  isOwner, canEdit, recentPeople = [],
  board, onRenameBoard, onDeleteBoard, onShare,
  onPersonClick,
}) {
  const [personDialogOpen, setPersonDialogOpen] = useState(false)
  const [phaseDialogOpen,  setPhaseDialogOpen]  = useState(false)
  const [editingPhase,     setEditingPhase]     = useState(null)  // phase object | null
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [editingProject,    setEditingProject]    = useState(null)  // project object | null
  const [showRename,       setShowRename]       = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [draggedPhaseId,  setDraggedPhaseId]  = useState(null)
  const [dragOverPhaseId, setDragOverPhaseId] = useState(null)
  const [dragPosition,    setDragPosition]    = useState(null)  // 'before' | 'after'
  const renameMounted = useMountWhileOpen(showRename)

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
    onUpdateBoardPhases((boardPhases || []).filter(p => p.id !== phaseId))
  }

  const openAddProject  = () => { setEditingProject(null); setProjectDialogOpen(true) }
  const openEditProject = (project) => { setEditingProject(project); setProjectDialogOpen(true) }

  const handleProjectSave = (newProject) => {
    const current = boardProjects || []
    if (editingProject) {
      onUpdateBoardProjects(current.map(p => p.id === newProject.id ? newProject : p))
    } else {
      onUpdateBoardProjects([...current, newProject])
    }
    setProjectDialogOpen(false)
    setEditingProject(null)
  }

  const handleDeleteProject = (projectId) => {
    onUpdateBoardProjects((boardProjects || []).filter(p => p.id !== projectId))
  }

  // Disabling a phase just hides it from the picker on new/edited tasks —
  // it stays defined (and still renders on any task that already has it)
  // so turning it back on doesn't lose anything.
  const handleTogglePhaseEnabled = (phaseId) => {
    onUpdateBoardPhases((boardPhases || []).map(p =>
      p.id === phaseId ? { ...p, enabled: p.enabled === false ? true : false } : p
    ))
  }

  // ── Phase reorder (drag and drop) ─────────────────────────────────────────
  const handlePhaseDragStart = (e, phaseId) => {
    setDraggedPhaseId(phaseId)
    e.dataTransfer.effectAllowed = 'move'
    const img = new Image()
    img.src = TRANSPARENT_GIF
    e.dataTransfer.setDragImage(img, 0, 0)
  }

  const handlePhaseDragOver = (e, phaseId) => {
    e.preventDefault()
    if (phaseId === draggedPhaseId) return
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOverPhaseId(phaseId)
    setDragPosition(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
  }

  const resetPhaseDrag = () => { setDraggedPhaseId(null); setDragOverPhaseId(null); setDragPosition(null) }

  const handlePhaseDrop = (e, targetId) => {
    e.preventDefault()
    if (!draggedPhaseId || draggedPhaseId === targetId) { resetPhaseDrag(); return }
    const ids = (boardPhases || []).map(p => p.id)
    const newIds = ids.filter(id => id !== draggedPhaseId)
    const targetIdx = newIds.indexOf(targetId)
    newIds.splice(dragPosition === 'after' ? targetIdx + 1 : targetIdx, 0, draggedPhaseId)
    const byId = Object.fromEntries((boardPhases || []).map(p => [p.id, p]))
    onUpdateBoardPhases(newIds.map(id => byId[id]))
    resetPhaseDrag()
  }

  return (
    <>
      {/* ── Main settings dialog ── */}
      <Dialog
        open={open}
        onClose={onClose}
        scroll="paper"
      slots={{ transition: SlideUp }}
      transitionDuration={{ enter: 300, exit: 220 }}
      slotProps={{ paper: { sx: { maxHeight: '85vh' } } }}
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
                    display: 'flex', alignItems: 'center', gap: 2, p: '8px 12px',
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
                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
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

            {/* ── Projects ── */}
            <Box sx={{ px: 2.5, py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Projects</Typography>
                {canEdit && (
                  <Button size="small" startIcon={<AddIcon />} onClick={openAddProject}>Add project</Button>
                )}
              </Box>

              {(boardProjects || []).map(project => (
                <Box
                  key={project.id}
                  onClick={canEdit ? () => openEditProject(project) : undefined}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 12px',
                    borderRadius: 2, cursor: canEdit ? 'pointer' : 'default',
                    '&:hover': canEdit ? { background: '#f3f4f6' } : {},
                  }}
                >
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: project.color, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ flex: 1 }}>{project.name}</Typography>
                  {canEdit && <ChevronRightIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />}
                </Box>
              ))}

              {(boardProjects || []).length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No projects yet.</Typography>
              )}
            </Box>

            <Divider sx={{ mx: 2 }} />

            {/* ── Phases ── */}
            <Box sx={{ px: 2.5, py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Phases</Typography>
                {canEdit && (
                  <Button size="small" startIcon={<AddIcon />} onClick={openAddPhase}>Add phase</Button>
                )}
              </Box>

              {(boardPhases || []).map(phase => (
                <Box
                  key={phase.id}
                  className={[
                    'settings-phase-wrap',
                    dragOverPhaseId === phase.id && dragPosition === 'before' ? 'settings-phase-wrap--before' : '',
                    dragOverPhaseId === phase.id && dragPosition === 'after'  ? 'settings-phase-wrap--after'  : '',
                  ].filter(Boolean).join(' ')}
                  draggable={canEdit}
                  onDragStart={canEdit ? (e) => handlePhaseDragStart(e, phase.id) : undefined}
                  onDragOver={canEdit ? (e) => handlePhaseDragOver(e, phase.id) : undefined}
                  onDrop={canEdit ? (e) => handlePhaseDrop(e, phase.id) : undefined}
                  onDragEnd={canEdit ? resetPhaseDrag : undefined}
                  sx={{ opacity: draggedPhaseId === phase.id ? 0.35 : 1 }}
                >
                  <Box onClick={canEdit ? () => openEditPhase(phase) : undefined} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 12px',
                    borderRadius: 2,
                    cursor: canEdit ? 'pointer' : 'default',
                    '&:hover': canEdit ? { background: '#f3f4f6' } : {},
                  }}>
                    <Typography variant="body2" sx={{ flex: 1 }}>{phase.name}</Typography>
                    {phase.optional && (
                      <Typography variant="caption" sx={{
                        px: 0.75, py: 0.25, borderRadius: 1,
                        background: '#f3f4f6', color: 'text.secondary',
                        fontWeight: 600, fontSize: 10, letterSpacing: 0.3, flexShrink: 0,
                      }}>
                        optional
                      </Typography>
                    )}
                    {canEdit && (
                      <Switch
                        size="small"
                        checked={phase.enabled !== false}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => handleTogglePhaseEnabled(phase.id)}
                      />
                    )}
                    {canEdit && <ChevronRightIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />}
                  </Box>
                </Box>
              ))}
            </Box>

            {/* ── Board actions ── */}
            {isOwner && (onShare || onRenameBoard || onDeleteBoard) && (
              <>
                <Divider sx={{ mx: 2 }} />
                <Box sx={{ px: 2.5, py: 1.5 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Board</Typography>
                  {onShare && (
                    <Box onClick={() => { onClose(); onShare() }} sx={{
                      display: 'flex', alignItems: 'center', gap: 1.25, p: '8px 10px',
                      borderRadius: 2, cursor: 'pointer', '&:hover': { background: '#f3f4f6' },
                    }}>
                      <ShareIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                      <Typography variant="body2">Share board</Typography>
                    </Box>
                  )}
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
                      onClick={() => setShowDeleteConfirm(true)}
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

      {/* ── Stacked: add / edit project ── */}
      <ProjectDialog
        open={projectDialogOpen}
        onClose={() => { setProjectDialogOpen(false); setEditingProject(null) }}
        existingProjects={boardProjects || []}
        project={editingProject}
        onSave={handleProjectSave}
        onDelete={handleDeleteProject}
      />

      {/* ── Stacked: rename board ── */}
      {renameMounted && (
        <RenameBoardDialog open={showRename} board={board} onSave={onRenameBoard} onClose={() => setShowRename(false)} />
      )}

      {/* ── Stacked: delete board confirm ── */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete board"
        message={`Delete "${board?.name}"? This cannot be undone.`}
        onConfirm={() => { setShowDeleteConfirm(false); onDeleteBoard(board.id); onClose() }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}

// Re-export icons for backward compat
export { EditIcon, DeleteIcon }
