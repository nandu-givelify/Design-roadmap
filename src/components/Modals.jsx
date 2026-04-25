import { useState, useRef, useEffect } from 'react'
import { toDateString, nextWorkday, isWeekend, addMonths, getAvatarColor, AVATAR_COLORS, parseLocalDate } from '../utils/dateUtils'

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
function TaskFields({ form, set, people, roles, onCreatePerson, onAddRole, onStartDateChange, onEndDateChange, onTitleEnter }) {
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
    </>
  )
}

// ── Add Task Modal ────────────────────────────────────────────────────────────
export function TaskModal({ onClose, onSave, people, roles, defaultAssigneeId, defaultStartDate, onCreatePerson, onAddRole }) {
  const today     = new Date()
  const baseStart = defaultStartDate ? parseLocalDate(defaultStartDate) : today
  const startDate = isWeekend(baseStart) ? nextWorkday(baseStart) : baseStart
  const endDate   = addMonths(startDate, 1)

  const [form, setForm] = useState({
    title: '', assigneeId: defaultAssigneeId || '', pmId: '',
    startDate: toDateString(startDate), endDate: toDateString(endDate),
  })
  const [endDateTouched, setEndDateTouched] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleStartDateChange = (v) => {
    set('startDate', v)
    if (!endDateTouched) set('endDate', toDateString(addMonths(parseLocalDate(v), 1)))
  }

  const handleSave = () => {
    if (!form.title.trim()) return
    onSave({ ...form, assigneeId: form.assigneeId || null, pmId: form.pmId || null })
    onClose()
  }

  return (
    <ModalShell title="Add Task" onClose={onClose}>
      <TaskFields
        form={form} set={set} people={people} roles={roles}
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
export function EditTaskModal({ task, onClose, onSave, onDelete, people, roles, onCreatePerson, onAddRole }) {
  const [form, setForm] = useState({
    title:      task.title      || '',
    assigneeId: task.assigneeId || '',
    pmId:       task.pmId       || task.teamId || '',  // support legacy teamId
    startDate:  task.startDate  || '',
    endDate:    task.endDate    || '',
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.title.trim()) return
    onSave({ ...form, assigneeId: form.assigneeId || null, pmId: form.pmId || null })
    onClose()
  }

  return (
    <ModalShell title="Edit Task" onClose={onClose}>
      <TaskFields
        form={form} set={set} people={people} roles={roles}
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
export function ShareModal({ onClose, shareUrl }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <ModalShell title="Share Board" onClose={onClose}>
      <p style={{ fontSize: 13, color: '#374151', marginBottom: 14 }}>
        Anyone with this link can view the board. They'll need to sign in to access it.
      </p>
      <div className="share-link-row">
        <div className="share-link-row__label">Board link</div>
        <div className="share-link-row__controls">
          <input readOnly className="share-link-row__input" value={shareUrl} onFocus={(e) => e.target.select()} />
          <button className={`share-copy-btn${copied ? ' share-copy-btn--copied' : ''}`} onClick={copy}>
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
