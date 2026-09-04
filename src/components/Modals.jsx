import { useState, useRef, useEffect, forwardRef } from 'react'
import Dialog from '@mui/material/Dialog'
import Slide from '@mui/material/Slide'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import InputLabel from '@mui/material/InputLabel'
import FormControl from '@mui/material/FormControl'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import InputAdornment from '@mui/material/InputAdornment'
import CloseIcon from '@mui/icons-material/Close'
import { toDateString, nextWorkday, isWeekend, addMonths, getAvatarColor, parseLocalDate } from '../utils/dateUtils'

const SlideUp = forwardRef((props, ref) => <Slide direction="up" ref={ref} {...props} />)

// ── Helper functions ──────────────────────────────────────────────────────────
function getTaskDays(startDate, endDate) {
  if (!startDate || !endDate) return 28
  const s = new Date(startDate), e = new Date(endDate)
  return Math.max(1, Math.round((e - s) / 86400000) + 1)
}

function normalizePhases(phases, totalDays) {
  if (!phases || phases.length === 0) return []
  const n = phases.length
  const equalDays = Math.max(1, Math.floor(totalDays / n))
  return phases.map((p, i) => ({
    ...p,
    days: i === n - 1 ? Math.max(1, totalDays - equalDays * (n - 1)) : equalDays,
  }))
}

function smartDefaultPhases(boardPhases, totalDays) {
  if (!boardPhases || boardPhases.length === 0) return []
  // Optional phases are off by default — new tasks only get non-optional phases
  const active = boardPhases.filter(bp => !bp.optional)
  if (active.length === 0) return []
  const n   = active.length
  const ids = active.map(p => p.id)
  if (ids.includes('discovery') && ids.includes('handoff') && ids.includes('ux') && ids.includes('ui')) {
    const discovery = Math.max(1, Math.min(7, Math.round(totalDays * 0.25)))
    const handoff   = Math.max(1, Math.min(3, Math.round(totalDays * 0.1)))
    const remaining = Math.max(2, totalDays - discovery - handoff)
    const ux = Math.max(1, Math.floor(remaining / 2))
    const ui = Math.max(1, remaining - ux)
    return active.map(bp => ({
      id: bp.id,
      days: bp.id === 'discovery' ? discovery : bp.id === 'handoff' ? handoff
          : bp.id === 'ux' ? ux : bp.id === 'ui' ? ui
          : Math.max(1, Math.floor(totalDays / n)),
    }))
  }
  return normalizePhases(active.map(bp => ({ id: bp.id })), totalDays)
}

// ── Photo picker ──────────────────────────────────────────────────────────────
export function PhotoPicker({ value, onChange }) {
  const ref = useRef()

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    // Compress image to max 400px and 80% quality before storing
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX = 400
        let w = img.width, h = img.height
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX }
          else        { w = Math.round(w * MAX / h); h = MAX }
        }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        onChange(canvas.toDataURL('image/jpeg', 0.80))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{
        width: 56, height: 56, borderRadius: '50%', overflow: 'hidden',
        background: '#f3f4f6', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 24, flexShrink: 0,
        border: '1px solid #e5e7eb',
      }}>
        {value ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
      </Box>
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="outlined" onClick={() => ref.current.click()}>
          {value ? 'Change photo' : 'Upload photo'}
        </Button>
        {value && (
          <Button size="small" color="error" onClick={() => onChange(null)}>Remove</Button>
        )}
      </Stack>
      <input ref={ref} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
    </Box>
  )
}

// ── Date range input (click-anywhere-to-open, auto-advance, min-date) ─────────
export function DateRangeInput({ start, end, onStartChange, onEndChange }) {
  const startRef = useRef(null)
  const endRef   = useRef(null)

  const openPicker = (ref) => {
    try { ref.current?.showPicker() } catch {}
  }

  const handleStartChange = (value) => {
    onStartChange(value)
    if (value) setTimeout(() => openPicker(endRef), 80)
  }

  const fieldBox = { flex: 1, p: 1.25, cursor: 'pointer', userSelect: 'none' }

  return (
    <Box sx={{
      display: 'flex',
      border: '1px solid', borderColor: 'divider', borderRadius: 2,
      overflow: 'hidden',
    }}>
      <Box sx={{ ...fieldBox, borderRight: '1px solid', borderColor: 'divider' }}
        onClick={() => openPicker(startRef)}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25, lineHeight: 1.2, pointerEvents: 'none' }}>
          Start date
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
          End date
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

// ── Combobox ──────────────────────────────────────────────────────────────────
function PersonCombobox({ value, onChange, options, label, placeholder, defaultRole, onCreatePerson, onAddRole, roles }) {
  const [open,        setOpen]        = useState(false)
  const [inputValue,  setInputValue]  = useState('')
  const [showCreate,  setShowCreate]  = useState(false)
  const [newName,     setNewName]     = useState('')
  const [newEmail,    setNewEmail]    = useState('')
  const [newRole,     setNewRole]     = useState(defaultRole || 'Designer')
  const [creating,    setCreating]    = useState(false)
  const [customRole,  setCustomRole]  = useState('')
  const [focusedIdx,  setFocusedIdx]  = useState(-1)
  const wrapRef = useRef()

  const selected = options.find((o) => o.id === value)
  const allRoles = [...(roles || ['Designer', 'PM', 'Dev'])]

  // Sync input with selection (only when value changes from outside)
  useEffect(() => { setInputValue(selected?.name || '') }, [value]) // eslint-disable-line

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false); setShowCreate(false)
        // Reset input to selected name if user clicked away without picking
        setInputValue(selected?.name || '')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [selected])

  // Filter options based on what's typed (only filter when input differs from selected name)
  const isTyping = !selected || inputValue !== selected.name
  const filtered = isTyping && inputValue
    ? options.filter(o => o.name?.toLowerCase().includes(inputValue.toLowerCase()))
    : options

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const roleToUse = newRole === '__custom__' ? customRole.trim() : newRole
    if (roleToUse && !allRoles.includes(roleToUse)) await onAddRole?.(roleToUse)
    const id = await onCreatePerson({ name: newName.trim(), email: newEmail.trim() || null, photo: null, role: roleToUse || 'Designer' })
    onChange(id)
    setInputValue(newName.trim())
    setOpen(false); setShowCreate(false)
    setNewName(''); setNewEmail(''); setCustomRole(''); setCreating(false)
  }

  return (
    <Box ref={wrapRef} sx={{ position: 'relative' }}>
      {/* Always-visible search TextField */}
      <TextField
        label={label}
        size="small"
        fullWidth
        value={inputValue}
        placeholder={!selected ? placeholder : undefined}
        onChange={(e) => {
          const v = e.target.value
          setInputValue(v)
          setOpen(true)
          setFocusedIdx(-1)
          // Clear the selected person immediately so the avatar updates
          if (value) onChange(null)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          const list = filtered
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setFocusedIdx(i => Math.min(i + 1, list.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setFocusedIdx(i => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            if (focusedIdx >= 0 && list[focusedIdx]) {
              e.preventDefault()
              const opt = list[focusedIdx]
              onChange(opt.id); setInputValue(opt.name || ''); setOpen(false); setFocusedIdx(-1)
            }
          } else if (e.key === 'Escape') {
            setOpen(false); setFocusedIdx(-1)
          }
        }}
        slotProps={{
          input: {
            startAdornment: selected && (
              <InputAdornment position="start" sx={{ mr: 0 }}>
                <Box sx={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: getAvatarColor(selected.name),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden',
                }}>
                  {selected.photo
                    ? <img src={selected.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : selected.name?.charAt(0)
                  }
                </Box>
              </InputAdornment>
            ),
            endAdornment: selected && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  sx={{ width: 22, height: 22, '& .MuiSvgIcon-root': { fontSize: '14px !important' } }}
                  onMouseDown={e => { e.preventDefault(); onChange(null); setInputValue(''); setOpen(false) }}
                >
                  <CloseIcon />
                </IconButton>
              </InputAdornment>
            ),
          }
        }}
      />

      {/* Dropdown */}
      {open && !showCreate && (
        <Box sx={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1300,
          background: '#fff', border: '1px solid', borderColor: 'divider',
          borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          maxHeight: 240, overflowY: 'auto', mt: 0.5,
        }}>
          {filtered.map((opt, idx) => (
            <Box key={opt.id} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, p: '8px 12px',
              cursor: 'pointer',
              background: focusedIdx === idx ? '#f3f4f6' : 'transparent',
              '&:hover': { background: '#f3f4f6' },
            }} onMouseDown={e => { e.preventDefault(); onChange(opt.id); setInputValue(opt.name || ''); setOpen(false); setFocusedIdx(-1) }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: getAvatarColor(opt.name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden',
              }}>
                {opt.photo ? <img src={opt.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : opt.name?.charAt(0)}
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <Typography component="div" variant="body2" fontWeight={500} sx={{ lineHeight: 1.2 }}>{opt.name}</Typography>
                {opt.role && <Typography component="div" variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>{opt.role}</Typography>}
              </Box>
            </Box>
          ))}
          <Box sx={{ p: '8px 12px', cursor: 'pointer', color: 'primary.main', fontSize: 13, '&:hover': { background: '#f3f4f6' } }}
            onMouseDown={e => { e.preventDefault(); setShowCreate(true) }}>
            + Add new person…
          </Box>
        </Box>
      )}

      {/* Create new person panel */}
      {open && showCreate && (
        <Box sx={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1300,
          background: '#fff', border: '1px solid', borderColor: 'divider',
          borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          p: 1.5, mt: 0.5,
        }} onMouseDown={e => e.stopPropagation()}>
          <TextField size="small" fullWidth placeholder="Full name" value={newName}
            onChange={e => setNewName(e.target.value)} autoFocus sx={{ mb: 1 }} />
          <TextField size="small" fullWidth placeholder="Email (optional)"
            value={newEmail} onChange={e => setNewEmail(e.target.value)} sx={{ mb: 1 }} />
          <FormControl size="small" fullWidth sx={{ mb: 1 }}>
            <Select value={newRole} onChange={e => setNewRole(e.target.value)}>
              {allRoles.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              <MenuItem value="__custom__">+ New role…</MenuItem>
            </Select>
          </FormControl>
          {newRole === '__custom__' && (
            <TextField size="small" fullWidth placeholder="Role name"
              value={customRole} onChange={e => setCustomRole(e.target.value)} sx={{ mb: 1 }} />
          )}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={() => { setShowCreate(false); setNewName(''); setNewEmail('') }}>Cancel</Button>
            <Button size="small" variant="contained" onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? 'Adding…' : 'Add'}
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  )
}

// ── Task fields ───────────────────────────────────────────────────────────────
function TaskFields({ form, set, people, roles, onCreatePerson, onAddRole, onStartDateChange, onEndDateChange, onTitleEnter, boardPhases }) {
  const pmPeople = people.filter(p => p.role === 'PM')

  return (
    <Stack spacing={2.5} sx={{ pt: 1.5 }}>
      <TextField
        label="Task title *"
        value={form.title}
        onChange={(e) => set('title', e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onTitleEnter?.() } }}
        autoFocus
        fullWidth
      />

      <PersonCombobox
        label="Assignee"
        value={form.assigneeId}
        onChange={(v) => set('assigneeId', v)}
        options={people}
        placeholder="Search or add…"
        defaultRole="Designer"
        onCreatePerson={onCreatePerson}
        onAddRole={onAddRole}
        roles={roles}
      />

      <PersonCombobox
        label="PM"
        value={form.pmId}
        onChange={(v) => set('pmId', v)}
        options={pmPeople}
        placeholder="Search or add PM…"
        defaultRole="PM"
        onCreatePerson={onCreatePerson}
        onAddRole={onAddRole}
        roles={roles}
      />

      <DateRangeInput
        start={form.startDate}
        end={form.endDate}
        onStartChange={v => {
          if (onStartDateChange) onStartDateChange(v)
          else set('startDate', v)
        }}
        onEndChange={v => {
          if (onEndDateChange) onEndDateChange(v)
          else set('endDate', v)
        }}
      />

      {boardPhases && boardPhases.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>Phases</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {boardPhases.map(bp => {
              const isActive = (form.phases || []).some(p => p.id === bp.id)
              return (
                <Box
                  key={bp.id}
                  component="label"
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75,
                    px: 1.25, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
                    border: '1.5px solid',
                    borderColor: isActive ? bp.color : 'divider',
                    background: isActive ? `${bp.color}18` : 'transparent',
                    transition: 'all 0.12s',
                  }}
                >
                  <input type="checkbox" checked={isActive} style={{ display: 'none' }} onChange={() => {
                    const cur = form.phases || []
                    let newPhases
                    if (isActive) {
                      if (cur.length <= 1) return
                      newPhases = cur.filter(p => p.id !== bp.id)
                    } else {
                      const added = [...cur, { id: bp.id, days: 1 }]
                      const ordered = boardPhases.filter(b => added.some(p => p.id === b.id)).map(b => ({ id: b.id, days: 1 }))
                      newPhases = normalizePhases(ordered, getTaskDays(form.startDate, form.endDate))
                    }
                    set('phases', newPhases)
                  }} />
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: bp.color, flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ fontWeight: isActive ? 600 : 400 }}>{bp.name}</Typography>
                </Box>
              )
            })}
          </Box>
        </Box>
      )}

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>Color</Typography>
        <Stack direction="row" spacing={1}>
          {[
            { value: 'white', label: 'White', hex: '#ffffff' },
            { value: 'gray',  label: 'Gray',  hex: '#eeeeee' },
          ].map(c => (
            <Box
              key={c.value}
              onClick={() => set('taskColor', c.value)}
              sx={{
                width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                background: c.hex,
                border: (form.taskColor || 'white') === c.value ? '3px solid #111827' : '2px solid #d1d5db',
                transition: 'border 0.12s',
              }}
              title={c.label}
            />
          ))}
        </Stack>
      </Box>
    </Stack>
  )
}

// ── Add Task Modal ────────────────────────────────────────────────────────────
export function TaskModal({ onClose, onSave, people, roles, boardPhases, defaultAssigneeId, defaultStartDate, onCreatePerson, onAddRole }) {
  const today     = new Date()
  const baseStart = defaultStartDate ? parseLocalDate(defaultStartDate) : today
  const startDate = isWeekend(baseStart) ? nextWorkday(baseStart) : baseStart
  const endDate   = addMonths(startDate, 1)

  const totalDays = getTaskDays(toDateString(startDate), toDateString(endDate))
  const defaultPhases = smartDefaultPhases(boardPhases || [], totalDays)

  const [form, setForm] = useState({
    title: '', assigneeId: defaultAssigneeId || '', pmId: '',
    startDate: toDateString(startDate), endDate: toDateString(endDate),
    taskColor: 'white', phases: defaultPhases,
  })
  const [endDateTouched, setEndDateTouched] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleStartDateChange = (v) => {
    set('startDate', v)
    if (!endDateTouched) set('endDate', toDateString(addMonths(parseLocalDate(v), 1)))
  }

  const handleSave = () => {
    if (!form.title.trim()) return
    onSave({ ...form, assigneeId: form.assigneeId || null, pmId: form.pmId || null, taskColor: form.taskColor || 'white', phases: form.phases || [] })
    onClose()
  }

  return (
    <Dialog open onClose={onClose} TransitionComponent={SlideUp} TransitionProps={{ timeout: { enter: 300, exit: 220 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Add Task
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <TaskFields
          form={form} set={set} people={people} roles={roles} boardPhases={boardPhases}
          onCreatePerson={onCreatePerson} onAddRole={onAddRole}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={(v) => { setEndDateTouched(true); set('endDate', v) }}
          onTitleEnter={() => { if (form.title.trim()) handleSave() }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!form.title.trim()}>Add Task</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Edit Task Modal ───────────────────────────────────────────────────────────
export function EditTaskModal({ task, onClose, onSave, onDelete, people, roles, boardPhases, onCreatePerson, onAddRole }) {
  const [form, setForm] = useState({
    title:      task.title      || '',
    assigneeId: task.assigneeId || '',
    pmId:       task.pmId       || task.teamId || '',
    startDate:  task.startDate  || '',
    endDate:    task.endDate    || '',
    taskColor:  task.taskColor  || 'white',
    phases:     task.phases     || [],
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.title.trim()) return
    onSave({ ...form, assigneeId: form.assigneeId || null, pmId: form.pmId || null, taskColor: form.taskColor || 'white', phases: form.phases || [] })
    onClose()
  }

  return (
    <Dialog open onClose={onClose} TransitionComponent={SlideUp} TransitionProps={{ timeout: { enter: 300, exit: 220 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Edit Task
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <TaskFields
          form={form} set={set} people={people} roles={roles} boardPhases={boardPhases}
          onCreatePerson={onCreatePerson} onAddRole={onAddRole}
          onTitleEnter={() => { if (form.title.trim()) handleSave() }}
        />
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={() => { onDelete(); onClose() }}>Delete</Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!form.title.trim()}>Save Changes</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Share Modal ───────────────────────────────────────────────────────────────
import { PUBLIC_FIRESTORE_RULES } from '../App'

const ACCESS_OPTIONS = [
  { value: 'off',  icon: '🔒', label: 'Private',   desc: 'Only signed-in members can view or edit.' },
  { value: 'view', icon: '👁',  label: 'View only', desc: 'Anyone with the link can view — no account needed.' },
  { value: 'edit', icon: '✏️', label: 'Edit',       desc: 'Anyone with the link can view and edit — no account needed.' },
]

export function ShareModal({ onClose, shareUrl, board, onSetPublicAccess }) {
  const currentAccess = board?.publicAccess || (board?.isPublic ? 'view' : 'off')
  const [access,      setAccess]      = useState(currentAccess)
  const [copied,      setCopied]      = useState(false)
  const [copiedRules, setCopiedRules] = useState(false)
  const [showRules,   setShowRules]   = useState(false)

  const handleAccess = (val) => { setAccess(val); onSetPublicAccess?.(val) }
  const copy = () => { navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }
  const copyRules = () => { navigator.clipboard.writeText(PUBLIC_FIRESTORE_RULES).then(() => { setCopiedRules(true); setTimeout(() => setCopiedRules(false), 2000) }) }
  const isPublic = access !== 'off'

  return (
    <Dialog open onClose={onClose} TransitionComponent={SlideUp} TransitionProps={{ timeout: { enter: 300, exit: 220 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Share Board
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {/* Access selector */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Access level</Typography>
            <Stack spacing={0.75}>
              {ACCESS_OPTIONS.map(opt => (
                <Box key={opt.value} onClick={() => handleAccess(opt.value)} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  p: '10px 14px', borderRadius: 2, cursor: 'pointer',
                  border: '1.5px solid', transition: 'all 0.12s',
                  borderColor: access === opt.value ? 'primary.main' : 'divider',
                  background: access === opt.value ? '#f9fafb' : '#fff',
                }}>
                  <Typography sx={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>{opt.icon}</Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{opt.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{opt.desc}</Typography>
                  </Box>
                  <Box sx={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: access === opt.value ? '5px solid #111827' : '1.5px solid #d1d5db',
                    background: '#fff', transition: 'all 0.12s',
                  }} />
                </Box>
              ))}
            </Stack>
          </Box>

          {/* Link */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {isPublic ? 'Shareable link' : 'Board link (sign in required)'}
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small" fullWidth value={shareUrl}
                inputProps={{ readOnly: true }}
                onFocus={e => e.target.select()}
              />
              <Button variant={copied ? 'outlined' : 'contained'} onClick={copy} sx={{ flexShrink: 0 }}>
                {copied ? '✓ Copied!' : 'Copy'}
              </Button>
            </Stack>
          </Box>

          {isPublic && (
            <Box sx={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 2, p: '10px 14px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#92400e' }}>⚠️ Firestore rules update required</Typography>
                <Button size="small" sx={{ color: '#92400e', minWidth: 0, fontSize: 11 }} onClick={() => setShowRules(r => !r)}>
                  {showRules ? 'Hide ▲' : 'Show ▼'}
                </Button>
              </Box>
              <Typography variant="caption" sx={{ color: '#78350f', mt: 0.5, display: 'block' }}>
                Public access won't work until you update your Firestore security rules.
              </Typography>
              {showRules && (
                <Box sx={{ mt: 1.5 }}>
                  <Box component="pre" sx={{ background: '#fff', borderRadius: 1.5, p: '10px 12px', fontSize: 10, color: '#111827', overflowX: 'auto', whiteSpace: 'pre', m: 0, border: '1px solid #e5e7eb', lineHeight: 1.6 }}>
                    {PUBLIC_FIRESTORE_RULES}
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                    <Button size="small" variant={copiedRules ? 'outlined' : 'contained'} onClick={copyRules}>
                      {copiedRules ? '✓ Copied!' : 'Copy rules'}
                    </Button>
                    <Typography component="a" href="https://console.firebase.google.com" target="_blank" rel="noreferrer" variant="caption" sx={{ color: '#92400e', fontWeight: 500 }}>
                      Open Firebase Console →
                    </Typography>
                  </Stack>
                </Box>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  )
}
