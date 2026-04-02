import { useState, useRef, useEffect } from 'react'
import { toDateString, nextWorkday, isWeekend, addMonths, TASK_COLORS, getAvatarColor, AVATAR_COLORS } from '../utils/dateUtils'
import { addPerson as fbAddPerson, addTeam as fbAddTeam } from '../firebase'

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
export function PhotoPicker({ value, onChange, isTeam }) {
  const ref = useRef()
  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => onChange(ev.target.result)
    reader.readAsDataURL(file)
  }
  return (
    <div className="photo-picker">
      <div className={`photo-picker__preview${isTeam ? ' photo-picker__preview--team' : ''}`}>
        {value ? <img src={value} alt="" /> : (isTeam ? '🏷' : '👤')}
      </div>
      <button type="button" className="photo-picker__btn" onClick={() => ref.current.click()}>
        {value ? 'Change' : 'Upload photo'}
      </button>
      {value && <button type="button" className="photo-picker__remove" onClick={() => onChange(null)}>Remove</button>}
      <input ref={ref} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
    </div>
  )
}

// ── Combobox: choose from existing list or add new inline ─────────────────────
function Combobox({ value, onChange, options, placeholder, onCreateNew, type = 'person' }) {
  const [open, setOpen]             = useState(false)
  const [query, setQuery]           = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName]       = useState('')
  const [newEmail, setNewEmail]     = useState('')
  const [newPhoto, setNewPhoto]     = useState(null)
  const [creating, setCreating]     = useState(false)
  const wrapRef = useRef()

  const selected = options.find((o) => o.id === value)

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const data = { name: newName.trim(), photo: newPhoto, color: getAvatarColor(newName.trim()) }
    if (type === 'person') data.email = newEmail
    const id = await onCreateNew(data)
    onChange(id)
    setOpen(false); setShowCreate(false); setNewName(''); setNewEmail(''); setNewPhoto(null); setCreating(false)
  }

  return (
    <div className="combobox" ref={wrapRef}>
      {selected ? (
        <div className="combobox__selected-badge" onClick={() => { setOpen(true); setQuery('') }}>
          <div
            className={`combobox__option-avatar${type === 'team' ? ' combobox__option-avatar--team' : ''}`}
            style={{ background: type === 'person' ? (selected.color || getAvatarColor(selected.name)) : '#6366f1' }}
          >
            {selected.photo ? <img src={selected.photo} alt="" /> : selected.name?.charAt(0)}
          </div>
          <span className="combobox__selected-name">{selected.name}</span>
          <span className="combobox__selected-change">change ▾</span>
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
            <div
              key={opt.id}
              className="combobox__option"
              onClick={() => { onChange(opt.id); setOpen(false); setQuery('') }}
            >
              <div
                className={`combobox__option-avatar${type === 'team' ? ' combobox__option-avatar--team' : ''}`}
                style={{ background: type === 'person' ? (opt.color || getAvatarColor(opt.name)) : '#6366f1' }}
              >
                {opt.photo ? <img src={opt.photo} alt="" /> : opt.name?.charAt(0)}
              </div>
              <div>
                <div className="combobox__option-label">{opt.name}</div>
                {opt.email && <div className="combobox__option-sub">{opt.email}</div>}
              </div>
            </div>
          ))}

          {!showCreate ? (
            <div className="combobox__option combobox__option--add" onClick={() => setShowCreate(true)}>
              + Add new {type}…
            </div>
          ) : (
            <div className="combobox__inline-form" onClick={(e) => e.stopPropagation()}>
              <input
                className="field__input"
                placeholder={type === 'person' ? 'Full name' : 'Team name'}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              {type === 'person' && (
                <input
                  className="field__input"
                  style={{ marginTop: 6 }}
                  placeholder="Email (optional)"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              )}
              <div className="combobox__inline-actions" style={{ marginTop: 6 }}>
                <button className="combobox__inline-add" onClick={handleCreate} disabled={creating || !newName.trim()}>
                  {creating ? 'Adding…' : 'Add'}
                </button>
                <button className="combobox__inline-cancel" onClick={() => { setShowCreate(false); setNewName(''); setNewEmail('') }}>
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

// ── Task fields (shared between Add and Edit modals) ──────────────────────────
function TaskFields({ form, set, people, teams, onCreatePerson, onCreateTeam }) {
  return (
    <>
      <Field label="Task title *">
        <input
          className="field__input"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="e.g. Homepage redesign"
          autoFocus
        />
      </Field>

      <Field label="Assignee">
        <Combobox
          value={form.assigneeId}
          onChange={(v) => set('assigneeId', v)}
          options={people}
          placeholder="Search or add person…"
          onCreateNew={onCreatePerson}
          type="person"
        />
      </Field>

      <Field label="PM">
        <Combobox
          value={form.teamId}
          onChange={(v) => set('teamId', v)}
          options={teams}
          placeholder="Search or add PM…"
          onCreateNew={onCreateTeam}
          type="team"
        />
      </Field>

      <div className="field__row">
        <Field label="Start date">
          <input className="field__input" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="End date">
          <input className="field__input" type="date" value={form.endDate} min={form.startDate} onChange={(e) => set('endDate', e.target.value)} />
        </Field>
      </div>

      <Field label="Color">
        <div className="color-picker">
          {TASK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-swatch${form.color === c ? ' color-swatch--selected' : ''}`}
              style={{ background: c }}
              onClick={() => set('color', c)}
            />
          ))}
        </div>
      </Field>
    </>
  )
}

// ── Task Modal (Add) ──────────────────────────────────────────────────────────
export function TaskModal({ onClose, onSave, people, teams, defaultAssigneeId, onCreatePerson, onCreateTeam }) {
  const today     = new Date()
  const startDate = isWeekend(today) ? nextWorkday(today) : today
  const endDate   = addMonths(startDate, 1)

  const [form, setForm] = useState({
    title:      '',
    assigneeId: defaultAssigneeId || '',
    teamId:     '',
    startDate:  toDateString(startDate),
    endDate:    toDateString(endDate),
    color:      TASK_COLORS[0],
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.title.trim()) return
    onSave({ ...form, assigneeId: form.assigneeId || null, teamId: form.teamId || null })
    onClose()
  }

  return (
    <ModalShell title="Add Task" onClose={onClose}>
      <TaskFields
        form={form} set={set}
        people={people} teams={teams}
        onCreatePerson={onCreatePerson}
        onCreateTeam={onCreateTeam}
      />
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={!form.title.trim()}>Add Task</button>
      </div>
    </ModalShell>
  )
}

// ── Edit Task Modal ────────────────────────────────────────────────────────────
export function EditTaskModal({ task, onClose, onSave, onDelete, people, teams, onCreatePerson, onCreateTeam }) {
  const [form, setForm] = useState({
    title:      task.title      || '',
    assigneeId: task.assigneeId || '',
    teamId:     task.teamId     || '',
    startDate:  task.startDate  || '',
    endDate:    task.endDate    || '',
    color:      task.color      || TASK_COLORS[0],
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.title.trim()) return
    onSave({ ...form, assigneeId: form.assigneeId || null, teamId: form.teamId || null })
    onClose()
  }

  const handleDelete = () => {
    onDelete()
    onClose()
  }

  return (
    <ModalShell title="Edit Task" onClose={onClose}>
      <TaskFields
        form={form} set={set}
        people={people} teams={teams}
        onCreatePerson={onCreatePerson}
        onCreateTeam={onCreateTeam}
      />
      <div className="modal-footer">
        <button className="btn-danger" onClick={handleDelete}>Delete</button>
        <div style={{ flex: 1 }} />
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={!form.title.trim()}>Save Changes</button>
      </div>
    </ModalShell>
  )
}

// ── Person Modal ──────────────────────────────────────────────────────────────
export function PersonModal({ onClose, onSave, teams }) {
  const [form, setForm] = useState({ name: '', email: '', photo: null, teamId: '', color: AVATAR_COLORS[0] })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <ModalShell title="Add Person" onClose={onClose}>
      <PhotoPicker value={form.photo} onChange={(v) => set('photo', v)} />
      <Field label="Name *">
        <input className="field__input" value={form.name} onChange={(e) => { set('name', e.target.value); set('color', getAvatarColor(e.target.value)) }} placeholder="e.g. Alex Johnson" autoFocus />
      </Field>
      <Field label="Email (optional)">
        <input className="field__input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="alex@company.com" />
      </Field>
      {!form.photo && (
        <Field label="Avatar color">
          <div className="color-picker">
            {AVATAR_COLORS.map((c) => (
              <button key={c} type="button" className={`color-swatch${form.color === c ? ' color-swatch--selected' : ''}`} style={{ background: c }} onClick={() => set('color', c)} />
            ))}
          </div>
        </Field>
      )}
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => { if (form.name.trim()) { onSave({ ...form, teamId: null, color: form.color || getAvatarColor(form.name) }); onClose() } }} disabled={!form.name.trim()}>Add Person</button>
      </div>
    </ModalShell>
  )
}

// ── Team Modal ────────────────────────────────────────────────────────────────
export function TeamModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', photo: null })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <ModalShell title="Add PM" onClose={onClose}>
      <PhotoPicker value={form.photo} onChange={(v) => set('photo', v)} isTeam />
      <Field label="PM name *">
        <input className="field__input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sarah Chen" autoFocus />
      </Field>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => { if (form.name.trim()) { onSave(form); onClose() } }} disabled={!form.name.trim()}>Add PM</button>
      </div>
    </ModalShell>
  )
}

// ── Share Modal ───────────────────────────────────────────────────────────────
export function ShareModal({ onClose }) {
  const base    = window.location.origin + window.location.pathname
  const [copied, setCopied] = useState(null)
  const copy = (url, key) => {
    navigator.clipboard.writeText(url).then(() => { setCopied(key); setTimeout(() => setCopied(null), 2000) })
  }
  const LinkRow = ({ label, url, desc, k }) => (
    <div className="share-link-row">
      <div className="share-link-row__label">{label}</div>
      <div className="share-link-row__desc">{desc}</div>
      <div className="share-link-row__controls">
        <input readOnly className="share-link-row__input" value={url} onFocus={(e) => e.target.select()} />
        <button className={`share-copy-btn${copied === k ? ' share-copy-btn--copied' : ''}`} onClick={() => copy(url, k)}>
          {copied === k ? '✓ Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
  return (
    <ModalShell title="Share Roadmap" onClose={onClose}>
      <LinkRow k="view" label="View only" desc="Can view, cannot edit." url={`${base}?mode=view`} />
      <LinkRow k="edit" label="Full access" desc="Can view and edit." url={`${base}?mode=edit`} />
      <p className="share-hint">The base URL (no query param) opens in edit mode.</p>
    </ModalShell>
  )
}
