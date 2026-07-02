import { useState, useRef, useEffect } from 'react'
import { toDateString, nextWorkday, isWeekend, addMonths, getAvatarColor, AVATAR_COLORS, parseLocalDate } from '../utils/dateUtils'

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

// Smart defaults: Discovery & Handoff = 1 week (or proportional), UX+UI split remaining
function smartDefaultPhases(boardPhases, totalDays) {
  if (!boardPhases || boardPhases.length === 0) return []
  const n   = boardPhases.length
  const ids = boardPhases.map(p => p.id)
  if (ids.includes('discovery') && ids.includes('handoff') && ids.includes('ux') && ids.includes('ui')) {
    const fixed     = Math.max(1, Math.min(7, Math.round(totalDays / 4)))
    const remaining = Math.max(2, totalDays - fixed * 2)
    const ux = Math.max(1, Math.floor(remaining / 2))
    const ui = Math.max(1, remaining - ux)
    return boardPhases.map(bp => ({
      id: bp.id,
      days: bp.id === 'discovery' ? fixed : bp.id === 'handoff' ? fixed
          : bp.id === 'ux' ? ux : bp.id === 'ui' ? ui
          : Math.max(1, Math.floor(totalDays / n)),
    }))
  }
  return normalizePhases(boardPhases.map(bp => ({ id: bp.id })), totalDays)
}

// ── Shared shell ─────────────────────────────────────────────────────────────
function ModalShell({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <span className="modal__title">{title}</span>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="field">
      <label className="field__label">{label}</label>
      {children}
    </div>
  )
}

// ── Photo picker ──────────────────────────────────────────────────────────────
export function PhotoPicker({ value, onChange }) {
  const ref = useRef()
  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => onChange(ev.target.result)
    reader.readAsDataURL(file)
  }
  return (
    <div className="photo-picker">
      <div className="photo-picker__preview">
        {value ? <img src={value} alt="" /> : '👤'}
      </div>
      <button type="button" className="photo-picker__btn" onClick={() => ref.current.click()}>
        {value ? 'Change photo' : 'Upload photo'}
      </button>
      {value && <button type="button" className="photo-picker__remove" onClick={() => onChange(null)}>Remove</button>}
      <input ref={ref} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
    </div>
  )
}

// ── Combobox: choose person from list or create new inline ────────────────────
// Unified — works for both assignee and PM (no separate teams)
function PersonCombobox({ value, onChange, options, placeholder, defaultRole, onCreatePerson, onAddRole, roles }) {
  const [open, setOpen]             = useState(false)
  const [query, setQuery]           = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName]       = useState('')
  const [newEmail, setNewEmail]     = useState('')
  const [newRole, setNewRole]       = useState(defaultRole || 'Designer')
  const [newPhoto, setNewPhoto]     = useState(null)
  const [creating, setCreating]     = useState(false)
  const [customRole, setCustomRole] = useState('')
  const wrapRef = useRef()

  const selected = options.find((o) => o.id === value)

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query
    ? options.filter((o) => o.name?.toLowerCase().includes(query.toLowerCase()))
    : options

  const allRoles = [...(roles || ['Designer', 'PM', 'Dev'])]

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const roleToUse = newRole === '__custom__' ? customRole.trim() : newRole
    if (roleToUse && !allRoles.includes(roleToUse)) {
      await onAddRole?.(roleToUse)
    }
    const data = {
      name:  newName.trim(),
      email: newEmail.trim() || null,
      photo: newPhoto,
      role:  roleToUse || 'Designer',
      color: getAvatarColor(newName.trim()),
    }
    const id = await onCreatePerson(data)
    onChange(id)
    setOpen(false); setShowCreate(false)
    setNewName(''); setNewEmail(''); setNewPhoto(null); setCustomRole(''); setCreating(false)
  }

  return (
    <div className="combobox" ref={wrapRef}>
      {selected ? (
        <div className="combobox__selected-badge" onClick={() => { setOpen(true); setQuery('') }}>
          <div className="combobox__option-avatar" style={{ background: selected.color || getAvatarColor(selected.name) }}>
            {selected.photo ? <img src={selected.photo} alt="" /> : selected.name?.charAt(0)}
          </div>
          <span className="combobox__selected-name">{selected.name}</span>
          {selected.role && <span style={{ fontSize: 11, color: '#9ca3af' }}>{selected.role}</span>}
          <span className="combobox__selected-change">change ▾</span>
          <button
            type="button" className="combobox__selected-clear"
            onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false) }}
          >×</button>
        </div>
      ) : (
        <div className="combobox__input-wrap">
          <input
            className="combobox__input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
          />
        </div>
      )}

      {open && (
        <div className="combobox__dropdown">
          {filtered.map((opt) => (
            <div key={opt.id} className="combobox__option" onClick={() => { onChange(opt.id); setOpen(false); setQuery('') }}>
              <div className="combobox__option-avatar" style={{ background: opt.color || getAvatarColor(opt.name) }}>
                {opt.photo ? <img src={opt.photo} alt="" /> : opt.name?.charAt(0)}
              </div>
              <div>
                <div className="combobox__option-label">{opt.name}</div>
                <div className="combobox__option-sub">{opt.role}{opt.email ? ` · ${opt.email}` : ''}</div>
              </div>
            </div>
          ))}

          {!showCreate ? (
            <div className="combobox__option combobox__option--add" onClick={() => setShowCreate(true)}>
              + Add new person…
            </div>
          ) : (
            <div className="combobox__inline-form" onClick={(e) => e.stopPropagation()}>
              <input className="field__input" placeholder="Full name" value={newName}
                onChange={(e) => setNewName(e.target.value)} autoFocus />
              <input className="field__input" style={{ marginTop: 6 }} placeholder="Email (optional)"
                value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <select
                className="field__input"
                style={{ marginTop: 6 }}
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                {allRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                <option value="__custom__">+ New role…</option>
              </select>
              {newRole === '__custom__' && (
                <input className="field__input" style={{ marginTop: 6 }} placeholder="Role name"
                  value={customRole} onChange={(e) => setCustomRole(e.target.value)} />
              )}
              <div className="combobox__inline-actions" style={{ marginTop: 6 }}>
                <button className="combobox__inline-add" onClick={handleCreate}
                  disabled={creating || !newName.trim()}>
                  {creating ? 'Adding…' : 'Add'}
                </button>
                <button className="combobox__inline-cancel"
                  onClick={() => { setShowCreate(false); setNewName(''); setNewEmail('') }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Task fields (shared between Add and Edit) ─────────────────────────────────
function TaskFields({ form, set, people, roles, onCreatePerson, onAddRole, onStartDateChange, onEndDateChange, onTitleEnter, boardPhases }) {
  // For PM field: only show people with PM role
  const pmPeople = people.filter((p) => p.role === 'PM')

  return (
    <>
      <Field label="Task title *">
        <input
          className="field__input"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onTitleEnter?.() } }}
          placeholder="e.g. Homepage redesign"
          autoFocus
        />
      </Field>

      <Field label="Assignee">
        <PersonCombobox
          value={form.assigneeId}
          onChange={(v) => set('assigneeId', v)}
          options={people}
          placeholder="Search or add person…"
          defaultRole="Designer"
          onCreatePerson={onCreatePerson}
          onAddRole={onAddRole}
          roles={roles}
        />
      </Field>

      <Field label="PM">
        <PersonCombobox
          value={form.pmId}
          onChange={(v) => set('pmId', v)}
          options={pmPeople}
          placeholder="Search or add PM…"
          defaultRole="PM"
          onCreatePerson={onCreatePerson}
          onAddRole={onAddRole}
          roles={roles}
        />
      </Field>

      <div className="field__row">
        <Field label="Start date">
          <input className="field__input" type="date" value={form.startDate}
            onChange={(e) => onStartDateChange ? onStartDateChange(e.target.value) : set('startDate', e.target.value)} />
        </Field>
        <Field label="End date">
          <input className="field__input" type="date" value={form.endDate} min={form.startDate}
            onChange={(e) => onEndDateChange ? onEndDateChange(e.target.value) : set('endDate', e.target.value)} />
        </Field>
      </div>

      {/* Phases picker */}
      {boardPhases && boardPhases.length > 0 && (
        <Field label="Phases">
          <div className="task-phases-picker">
            {boardPhases.map(bp => {
              const isActive = (form.phases || []).some(p => p.id === bp.id)
              return (
                <label key={bp.id} className={`phase-checkbox${isActive ? ' phase-checkbox--active' : ''}`}>
                  <input type="checkbox" checked={isActive} onChange={() => {
                    const cur = form.phases || []
                    let newPhases
                    if (isActive) {
                      if (cur.length <= 1) return
                      newPhases = cur.filter(p => p.id !== bp.id)
                    } else {
                      const added = [...cur, { id: bp.id, days: 1 }]
                      const ordered = boardPhases
                        .filter(b => added.some(p => p.id === b.id))
                        .map(b => ({ id: b.id, days: 1 }))
                      newPhases = normalizePhases(ordered, getTaskDays(form.startDate, form.endDate))
                    }
                    set('phases', newPhases)
                  }} />
                  <span className="phase-checkbox__dot" style={{ background: bp.color }} />
                  <span className="phase-checkbox__label">{bp.name}</span>
                </label>
              )
            })}
          </div>
        </Field>
      )}

      {/* Task color */}
      <Field label="Color">
        <div className="task-color-picker">
          {[
            { value: 'white', label: 'White', hex: '#ffffff' },
            { value: 'gray',  label: 'Gray',  hex: '#eeeeee' },
          ].map(c => (
            <button key={c.value} type="button"
              className={`task-color-swatch${(form.taskColor || 'white') === c.value ? ' task-color-swatch--active' : ''}`}
              style={{ background: c.hex }}
              onClick={() => set('taskColor', c.value)}
              title={c.label}
            />
          ))}
        </div>
      </Field>
    </>
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
    taskColor: 'white',
    phases: defaultPhases,
  })
  const [endDateTouched, setEndDateTouched] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleStartDateChange = (v) => {
    set('startDate', v)
    if (!endDateTouched) set('endDate', toDateString(addMonths(parseLocalDate(v), 1)))
  }

  const handleSave = () => {
    if (!form.title.trim()) return
    onSave({
      ...form,
      assigneeId: form.assigneeId || null,
      pmId: form.pmId || null,
      taskColor: form.taskColor || 'white',
      phases: form.phases || [],
    })
    onClose()
  }

  return (
    <ModalShell title="Add Task" onClose={onClose}>
      <TaskFields
        form={form} set={set} people={people} roles={roles}
        boardPhases={boardPhases}
        onCreatePerson={onCreatePerson} onAddRole={onAddRole}
        onStartDateChange={handleStartDateChange}
        onEndDateChange={(v) => { setEndDateTouched(true); set('endDate', v) }}
        onTitleEnter={() => { if (form.title.trim()) handleSave() }}
      />
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={!form.title.trim()}>Add Task</button>
      </div>
    </ModalShell>
  )
}

// ── Edit Task Modal ────────────────────────────────────────────────────────────
export function EditTaskModal({ task, onClose, onSave, onDelete, people, roles, boardPhases, onCreatePerson, onAddRole }) {
  const [form, setForm] = useState({
    title:      task.title      || '',
    assigneeId: task.assigneeId || '',
    pmId:       task.pmId       || task.teamId || '',  // support legacy teamId
    startDate:  task.startDate  || '',
    endDate:    task.endDate    || '',
    taskColor:  task.taskColor  || 'white',
    phases:     task.phases     || [],
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.title.trim()) return
    onSave({
      ...form,
      assigneeId: form.assigneeId || null,
      pmId: form.pmId || null,
      taskColor: form.taskColor || 'white',
      phases: form.phases || [],
    })
    onClose()
  }

  return (
    <ModalShell title="Edit Task" onClose={onClose}>
      <TaskFields
        form={form} set={set} people={people} roles={roles}
        boardPhases={boardPhases}
        onCreatePerson={onCreatePerson} onAddRole={onAddRole}
        onTitleEnter={() => { if (form.title.trim()) handleSave() }}
      />
      <div className="modal-footer">
        <button className="btn-danger" onClick={() => { onDelete(); onClose() }}>Delete</button>
        <div style={{ flex: 1 }} />
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={!form.title.trim()}>Save Changes</button>
      </div>
    </ModalShell>
  )
}

// ── Share Modal ───────────────────────────────────────────────────────────────
const PUBLIC_FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /boards/{boardId} {
      allow read: if request.auth != null
                  || resource.data.isPublic == true;
      allow write: if request.auth != null;
      match /{subcol}/{docId} {
        allow read: if request.auth != null
                    || get(/databases/$(database)/documents/boards/$(boardId))
                         .data.isPublic == true;
        allow write: if request.auth != null;
      }
    }
    match /userPrefs/{uid} {
      allow read, write: if request.auth != null
                         && request.auth.uid == uid;
    }
  }
}`

export function ShareModal({ onClose, shareUrl, board, onTogglePublic }) {
  const [copied,       setCopied]       = useState(false)
  const [copiedRules,  setCopiedRules]  = useState(false)
  const [showRules,    setShowRules]    = useState(false)
  const isPublic = board?.isPublic || false

  const copy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  const copyRules = () => {
    navigator.clipboard.writeText(PUBLIC_FIRESTORE_RULES).then(() => {
      setCopiedRules(true); setTimeout(() => setCopiedRules(false), 2000)
    })
  }

  return (
    <ModalShell title="Share Board" onClose={onClose}>
      <div className="share-public-row">
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Public access</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {isPublic ? 'Anyone with the link can view without signing in.' : 'Only invited people can access this board.'}
          </div>
        </div>
        <button className={`share-toggle${isPublic ? ' share-toggle--on' : ''}`}
          onClick={() => onTogglePublic?.(!isPublic)}>
          <span className="share-toggle__knob" />
        </button>
      </div>

      <div className="share-link-row" style={{ marginTop: 16 }}>
        <div className="share-link-row__label">{isPublic ? 'Public link' : 'Board link (sign in required)'}</div>
        <div className="share-link-row__controls">
          <input readOnly className="share-link-row__input" value={shareUrl} onFocus={(e) => e.target.select()} />
          <button className={`share-copy-btn${copied ? ' share-copy-btn--copied' : ''}`} onClick={copy}>
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {isPublic && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
              ⚠️ Firestore rules required for public access
            </span>
            <button
              style={{ fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => setShowRules(r => !r)}>
              {showRules ? 'Hide' : 'Show rules'}
            </button>
          </div>
          {showRules && (
            <>
              <pre style={{ background: '#f3f4f6', borderRadius: 6, padding: '10px 12px', fontSize: 10,
                            color: '#111827', overflowX: 'auto', whiteSpace: 'pre', margin: 0, lineHeight: 1.5 }}>
                {PUBLIC_FIRESTORE_RULES}
              </pre>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <button className={`share-copy-btn${copiedRules ? ' share-copy-btn--copied' : ''}`} onClick={copyRules}>
                  {copiedRules ? '✓ Copied!' : 'Copy rules'}
                </button>
                <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer"
                   style={{ fontSize: 11, color: '#6b7280' }}>
                  Open Firebase Console →
                </a>
              </div>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8, marginBottom: 0 }}>
                Paste these rules in Firebase Console → Firestore → Rules, then publish.
              </p>
            </>
          )}
        </div>
      )}
    </ModalShell>
  )
}
