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
import { toDateString, nextWorkday, isWeekend, addDays, getAvatarColor, parseLocalDate } from '../utils/dateUtils'

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

// ── Add person dialog (shared by Board settings and the Assignee/PM combobox) ─
export function AddPersonDialog({ open, onClose, roles, onSave, onAddRole, recentPeople = [], orgOptions = [], initialName = '', defaultRole = 'Designer' }) {
  const [query,      setQuery]      = useState(initialName)
  const [dropOpen,   setDropOpen]   = useState(false)
  const [selected,   setSelected]   = useState(null)
  const [email,      setEmail]      = useState('')
  const [photo,      setPhoto]      = useState(null)
  const [role,       setRole]       = useState(defaultRole)
  const [customRole, setCustomRole] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)

  // Carry over whatever was already typed (e.g. in the assignee search box) and
  // the field's default role each time the dialog opens, so the user doesn't
  // have to retype the name or reselect the role.
  useEffect(() => { if (open) { setQuery(initialName || ''); setRole(defaultRole) } }, [open, initialName, defaultRole])

  const reset = () => {
    setDropOpen(false); setSelected(null)
    setEmail(''); setPhoto(null); setRole(defaultRole); setCustomRole('')
    setFocusedIdx(-1)
  }

  const handleClose = () => { reset(); setQuery(''); onClose() }

  // Org-directory members first, then locally-remembered people — deduped by email.
  const seenEmails = new Set()
  const combined = [...orgOptions, ...recentPeople].filter(p => {
    const key = p.email?.toLowerCase()
    if (!key || seenEmails.has(key)) return false
    seenEmails.add(key)
    return true
  })

  const filtered = combined.filter(p =>
    !query || p.name?.toLowerCase().includes(query.toLowerCase()) ||
    p.email?.toLowerCase().includes(query.toLowerCase())
  )
  const dropList = query.length === 0 ? combined : filtered

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
      slots={{ transition: SlideUp }}
      transitionDuration={{ enter: 300, exit: 220 }}
      slotProps={{ paper: { sx: { minHeight: 360, overflow: 'visible' } } }}
    >
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
                    <InputAdornment position="start" sx={{ mr: '4px' }}>
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
            {dropOpen && combined.length > 0 && (
              <Box sx={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1500,
                background: '#fff', border: '1px solid', borderColor: 'divider',
                borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                maxHeight: 220, overflowY: 'auto', mt: 0.5,
              }}>
                {dropList.map((p, idx) => (
                  <Box key={p.email || p.name} onMouseDown={() => handleSelect(p)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 2, p: '8px 12px',
                      cursor: 'pointer',
                      background: focusedIdx === idx ? '#f3f4f6' : 'transparent',
                      '&:hover': { background: '#f3f4f6' },
                    }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', background: getAvatarColor(p.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                      {p.photo ? <img src={p.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : p.name?.charAt(0).toUpperCase()}
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <Typography variant="body2" fontWeight={500} sx={{ lineHeight: 1.2 }}>{p.name}</Typography>
                      {(p.role || p.email) && <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>{p.role || p.email}</Typography>}
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
      // Same border-driven hover/focus language as a standard MUI text field
      // (darken on hover, ring in the primary color while focused) instead of
      // a background-fill treatment that reads as a different control.
      transition: 'border-color 0.15s, box-shadow 0.15s',
      '&:hover': { borderColor: 'rgba(0, 0, 0, 0.87)' },
      '&:focus-within': { borderColor: 'primary.main', boxShadow: (t) => `0 0 0 1px ${t.palette.primary.main}` },
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
// Comparable "recency" value from a Firestore createdAt field (Timestamp, plain
// {seconds}, or Date) — null when unknown, so unknown-recency items fall back
// to sorting by name instead of clumping at an arbitrary end of the list.
const recencyMs = (o) => {
  const c = o?.createdAt
  if (!c) return null
  if (typeof c.toMillis === 'function') return c.toMillis()
  if (typeof c.seconds === 'number') return c.seconds * 1000
  if (c instanceof Date) return c.getTime()
  return null
}

function PersonCombobox({ value, onChange, options, orgOptions, label, placeholder, defaultRole, onCreatePerson, onCreatePersonWithId, onAddRole, roles }) {
  const [open,               setOpen]               = useState(false)
  const [inputValue,         setInputValue]         = useState('')
  const [focusedIdx,         setFocusedIdx]         = useState(-1)
  const [addPersonDialogOpen, setAddPersonDialogOpen] = useState(false)
  const wrapRef = useRef()
  const itemRefs = useRef([])

  const selected = options.find((o) => o.id === value)

  // Sync input with selection (only when value changes from outside)
  useEffect(() => { setInputValue(selected?.name || '') }, [value]) // eslint-disable-line

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      // Use composedPath (captured at dispatch time) instead of contains(e.target):
      // a click that swaps out the clicked row can detach it from the DOM before
      // this document-level listener runs, so by the time we get here e.target
      // may already be gone and .contains() would wrongly report "outside",
      // closing the dropdown we just interacted with.
      const path = e.composedPath ? e.composedPath() : []
      const isOutside = wrapRef.current && !path.includes(wrapRef.current)
      if (isOutside) {
        setOpen(false)
        // Reset input to selected name if user clicked away without picking
        setInputValue(selected?.name || '')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [selected])

  // Keep the keyboard-focused row in view once it scrolls past the fold.
  useEffect(() => {
    if (focusedIdx >= 0) itemRefs.current[focusedIdx]?.scrollIntoView({ block: 'nearest' })
  }, [focusedIdx])

  // Filter options based on what's typed (only filter when input differs from selected name)
  const isTyping = !selected || inputValue !== selected.name
  const filtered = isTyping && inputValue
    ? options.filter(o => o.name?.toLowerCase().includes(inputValue.toLowerCase()))
    : options

  // Org-directory members (same company email domain, from other boards) not
  // already an option here — offered as one-click adds instead of re-entering them.
  const optionEmails = new Set(options.map(o => o.email?.toLowerCase()).filter(Boolean))
  const orgSuggestions = (orgOptions || []).filter(m => !optionEmails.has(m.email?.toLowerCase()))
  const filteredOrgSuggestions = isTyping && inputValue
    ? orgSuggestions.filter(m => m.name?.toLowerCase().includes(inputValue.toLowerCase()))
    : orgSuggestions

  // One flat, keyboard-navigable list: board people and org suggestions merged
  // (no group label) — most recently added to this board first, then anyone
  // without a recency signal (e.g. org suggestions not yet on this board)
  // alphabetically by name.
  const combinedList = [
    ...filtered.map(o => ({ ...o, __kind: 'person' })),
    ...filteredOrgSuggestions.map(m => ({ ...m, __kind: 'org' })),
  ].sort((a, b) => {
    const ra = recencyMs(a), rb = recencyMs(b)
    if (ra !== rb) return (rb ?? -Infinity) - (ra ?? -Infinity)
    return (a.name || '').localeCompare(b.name || '')
  })

  const selectItem = (item) => {
    if (item.__kind === 'org') {
      // Instant: generate the id client-side and select right away — the
      // Firestore write happens in the background instead of blocking the UI.
      const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      onChange(id)
      setInputValue(item.name || '')
      setOpen(false)
      onCreatePersonWithId?.(id, { name: item.name, email: item.email, photo: item.photo || null, role: defaultRole || 'Designer' })
      return
    }
    onChange(item.id); setInputValue(item.name || ''); setOpen(false); setFocusedIdx(-1)
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
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setFocusedIdx(i => Math.min(i + 1, combinedList.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setFocusedIdx(i => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            if (focusedIdx >= 0 && combinedList[focusedIdx]) {
              e.preventDefault()
              selectItem(combinedList[focusedIdx])
            }
          } else if (e.key === 'Escape') {
            setOpen(false); setFocusedIdx(-1)
          }
        }}
        slotProps={{
          input: {
            startAdornment: selected && (
              <InputAdornment position="start" sx={{ mr: '4px' }}>
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
      {open && (
        <Box sx={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1300,
          background: '#fff', border: '1px solid', borderColor: 'divider',
          borderRadius: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          maxHeight: 240, overflowY: 'auto', mt: 0.5,
        }}>
          {combinedList.map((item, idx) => (
            <Box key={item.__kind === 'org' ? `org_${item.id}` : item.id}
              ref={el => { itemRefs.current[idx] = el }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 2, p: '8px 12px',
                cursor: 'pointer',
                background: focusedIdx === idx ? '#f3f4f6' : 'transparent',
                '&:hover': { background: '#f3f4f6' },
              }} onMouseDown={e => { e.preventDefault(); selectItem(item) }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: getAvatarColor(item.name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden',
              }}>
                {item.photo ? <img src={item.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : item.name?.charAt(0)}
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <Typography component="div" variant="body2" fontWeight={500} sx={{ lineHeight: 1.2 }}>{item.name}</Typography>
                {(item.role || item.email) && <Typography component="div" variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>{item.role || item.email}</Typography>}
              </Box>
            </Box>
          ))}
          <Box sx={{ p: '8px 12px', cursor: 'pointer', color: 'primary.main', fontSize: 13, '&:hover': { background: '#f3f4f6' } }}
            onMouseDown={e => { e.preventDefault(); setOpen(false); setAddPersonDialogOpen(true) }}>
            + Add new person…
          </Box>
        </Box>
      )}

      <AddPersonDialog
        open={addPersonDialogOpen}
        onClose={() => setAddPersonDialogOpen(false)}
        roles={roles}
        onAddRole={onAddRole}
        orgOptions={orgSuggestions}
        initialName={inputValue}
        defaultRole={defaultRole || 'Designer'}
        onSave={async (data) => {
          const id = await onCreatePerson(data)
          onChange(id)
          setInputValue(data.name)
        }}
      />
    </Box>
  )
}

// ── Task fields ───────────────────────────────────────────────────────────────
function TaskFields({ form, set, people, roles, onCreatePerson, onCreatePersonWithId, onAddRole, onStartDateChange, onEndDateChange, onTitleEnter, boardPhases, orgOptions }) {
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
        orgOptions={orgOptions}
        placeholder="Search or add…"
        defaultRole="Designer"
        onCreatePerson={onCreatePerson}
        onCreatePersonWithId={onCreatePersonWithId}
        onAddRole={onAddRole}
        roles={roles}
      />

      <PersonCombobox
        label="PM"
        value={form.pmId}
        onChange={(v) => set('pmId', v)}
        options={pmPeople}
        orgOptions={orgOptions}
        placeholder="Search or add PM…"
        defaultRole="PM"
        onCreatePerson={onCreatePerson}
        onCreatePersonWithId={onCreatePersonWithId}
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
export function TaskModal({ open = true, onClose, onSave, people, roles, boardPhases, defaultAssigneeId, defaultStartDate, onCreatePerson, onCreatePersonWithId, onAddRole, orgOptions }) {
  const today     = new Date()
  const baseStart = defaultStartDate ? parseLocalDate(defaultStartDate) : today
  const startDate = isWeekend(baseStart) ? nextWorkday(baseStart) : baseStart
  const endDate   = addDays(startDate, 14)

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
    if (!endDateTouched) set('endDate', toDateString(addDays(parseLocalDate(v), 14)))
  }

  const handleSave = () => {
    if (!form.title.trim()) return
    onSave({ ...form, assigneeId: form.assigneeId || null, pmId: form.pmId || null, taskColor: form.taskColor || 'white', phases: form.phases || [] })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose}
      slots={{ transition: SlideUp }}
      transitionDuration={{ enter: 300, exit: 220 }}
      slotProps={{ paper: { sx: { overflow: 'visible' } } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Add Task
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ overflow: 'visible' }}>
        <TaskFields
          form={form} set={set} people={people} roles={roles} boardPhases={boardPhases}
          onCreatePerson={onCreatePerson} onCreatePersonWithId={onCreatePersonWithId} onAddRole={onAddRole} orgOptions={orgOptions}
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
export function EditTaskModal({ open = true, task, onClose, onSave, onDelete, people, roles, boardPhases, onCreatePerson, onCreatePersonWithId, onAddRole, orgOptions }) {
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
    <Dialog open={open} onClose={onClose}
      slots={{ transition: SlideUp }}
      transitionDuration={{ enter: 300, exit: 220 }}
      slotProps={{ paper: { sx: { overflow: 'visible' } } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Edit Task
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ overflow: 'visible' }}>
        <TaskFields
          form={form} set={set} people={people} roles={roles} boardPhases={boardPhases}
          onCreatePerson={onCreatePerson} onCreatePersonWithId={onCreatePersonWithId} onAddRole={onAddRole} orgOptions={orgOptions}
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

export function ShareModal({ open = true, onClose, shareUrl, board, onSetPublicAccess }) {
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
    <Dialog open={open} onClose={onClose}
      slots={{ transition: SlideUp }}
      transitionDuration={{ enter: 300, exit: 220 }}
    >
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
