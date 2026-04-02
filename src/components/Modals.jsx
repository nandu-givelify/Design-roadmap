import { useState, useRef } from 'react'
import { toDateString, nextWorkday, prevWorkday, isWeekend, TASK_COLORS } from '../utils/dateUtils'

// ── Shared ────────────────────────────────────────────────────────────────────
const ModalShell = ({ title, onClose, children }) => (
  <div
    style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
    onClick={onClose}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: '#fff', borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        width: 480, maxWidth: '90vw',
        maxHeight: '90vh', overflowY: 'auto',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 20px', borderBottom: '1px solid #f3f4f6'
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{title}</div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 20, color: '#6b7280', lineHeight: 1,
        }}>×</button>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  </div>
)

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
      {label}
    </label>
    {children}
  </div>
)

const inputStyle = {
  width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
  borderRadius: 6, fontSize: 13, color: '#111827',
  outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const BtnPrimary = ({ onClick, children, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      background: '#6366f1', color: '#fff', border: 'none',
      padding: '9px 18px', borderRadius: 6, fontSize: 13,
      fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
    }}
  >
    {children}
  </button>
)

const BtnSecondary = ({ onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      background: 'none', color: '#374151', border: '1px solid #d1d5db',
      padding: '9px 18px', borderRadius: 6, fontSize: 13,
      fontWeight: 500, cursor: 'pointer',
    }}
  >
    {children}
  </button>
)

// ── Photo picker (base64 upload) ──────────────────────────────────────────────
function PhotoPicker({ value, onChange, label = 'Photo' }) {
  const ref = useRef()
  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => onChange(ev.target.result)
    reader.readAsDataURL(file)
  }
  return (
    <Field label={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: '#f3f4f6',
          border: '2px dashed #d1d5db',
          overflow: 'hidden', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {value
            ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            : <span style={{ fontSize: 20, color: '#9ca3af' }}>👤</span>
          }
        </div>
        <button
          type="button"
          onClick={() => ref.current.click()}
          style={{
            background: 'none', border: '1px solid #d1d5db',
            borderRadius: 6, padding: '6px 12px',
            fontSize: 12, color: '#374151', cursor: 'pointer',
          }}
        >
          {value ? 'Change photo' : 'Upload photo'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
          >Remove</button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }}/>
    </Field>
  )
}

// ── Add / Edit Task Modal ─────────────────────────────────────────────────────
export function TaskModal({ onClose, onSave, people, teams, defaultAssigneeId }) {
  const today = new Date()
  const [form, setForm] = useState({
    title: '',
    project: '',
    assigneeId: defaultAssigneeId || (people[0]?.id || ''),
    startDate: toDateString(isWeekend(today) ? nextWorkday(today) : today),
    endDate: toDateString(isWeekend(today) ? nextWorkday(new Date(today.getTime() + 7 * 86400000)) : new Date(today.getTime() + 7 * 86400000)),
    color: TASK_COLORS[0],
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.title.trim() || !form.assigneeId || !form.startDate || !form.endDate) return
    // Enforce no weekends
    let s = new Date(form.startDate)
    let e = new Date(form.endDate)
    if (isWeekend(s)) s = nextWorkday(s)
    if (isWeekend(e)) e = prevWorkday(e)
    onSave({ ...form, startDate: toDateString(s), endDate: toDateString(e) })
    onClose()
  }

  return (
    <ModalShell title="Add Task" onClose={onClose}>
      <Field label="Task title *">
        <input style={inputStyle} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Homepage redesign"/>
      </Field>
      <Field label="Project">
        <input style={inputStyle} value={form.project} onChange={(e) => set('project', e.target.value)} placeholder="e.g. Website Rebrand"/>
      </Field>
      <Field label="Assignee *">
        <select style={inputStyle} value={form.assigneeId} onChange={(e) => set('assigneeId', e.target.value)}>
          <option value="">Select person…</option>
          {people.map((p) => {
            const team = teams.find((t) => t.id === p.teamId)
            return <option key={p.id} value={p.id}>{p.name}{team ? ` (${team.name})` : ''}</option>
          })}
        </select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Start date *">
          <input style={inputStyle} type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)}/>
        </Field>
        <Field label="End date *">
          <input style={inputStyle} type="date" value={form.endDate} min={form.startDate} onChange={(e) => set('endDate', e.target.value)}/>
        </Field>
      </div>
      <Field label="Color">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TASK_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => set('color', c)}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: c,
                border: form.color === c ? '3px solid #111827' : '3px solid transparent',
                cursor: 'pointer', padding: 0,
              }}
            />
          ))}
        </div>
      </Field>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
        <BtnPrimary onClick={handleSave} disabled={!form.title.trim() || !form.assigneeId}>Add Task</BtnPrimary>
      </div>
    </ModalShell>
  )
}

// ── Add Person Modal ──────────────────────────────────────────────────────────
export function PersonModal({ onClose, onSave, teams }) {
  const [form, setForm] = useState({ name: '', email: '', photo: null, teamId: teams[0]?.id || '', color: '#6366f1' })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6']

  const handleSave = () => {
    if (!form.name.trim()) return
    onSave(form)
    onClose()
  }

  return (
    <ModalShell title="Add Person" onClose={onClose}>
      <PhotoPicker value={form.photo} onChange={(v) => set('photo', v)} label="Photo (optional)"/>
      <Field label="Name *">
        <input style={inputStyle} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Alex Johnson"/>
      </Field>
      <Field label="Email (optional)">
        <input style={inputStyle} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="alex@company.com"/>
      </Field>
      <Field label="Team">
        <select style={inputStyle} value={form.teamId} onChange={(e) => set('teamId', e.target.value)}>
          <option value="">No team</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      {!form.photo && (
        <Field label="Avatar color">
          <div style={{ display: 'flex', gap: 8 }}>
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => set('color', c)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: c,
                  border: form.color === c ? '3px solid #111827' : '3px solid transparent',
                  cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>
        </Field>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
        <BtnPrimary onClick={handleSave} disabled={!form.name.trim()}>Add Person</BtnPrimary>
      </div>
    </ModalShell>
  )
}

// ── Add Team Modal ────────────────────────────────────────────────────────────
export function TeamModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', photo: null })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim()) return
    onSave(form)
    onClose()
  }

  return (
    <ModalShell title="Add Team" onClose={onClose}>
      <PhotoPicker value={form.photo} onChange={(v) => set('photo', v)} label="Team photo / icon (optional)"/>
      <Field label="Team name *">
        <input style={inputStyle} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Product Design"/>
      </Field>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
        <BtnPrimary onClick={handleSave} disabled={!form.name.trim()}>Add Team</BtnPrimary>
      </div>
    </ModalShell>
  )
}

// ── Share Modal ────────────────────────────────────────────────────────────────
export function ShareModal({ onClose }) {
  const base = window.location.origin + window.location.pathname
  const viewUrl = base + '?mode=view'
  const editUrl = base + '?mode=edit'
  const [copied, setCopied] = useState(null)

  const copy = (url, key) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const LinkRow = ({ label, url, desc, k }) => (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: 8,
      padding: '12px 14px', marginBottom: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>{desc}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          readOnly value={url}
          style={{ ...inputStyle, flex: 1, background: '#f9fafb', fontSize: 12 }}
          onFocus={(e) => e.target.select()}
        />
        <button
          onClick={() => copy(url, k)}
          style={{
            background: copied === k ? '#10b981' : '#6366f1',
            color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 12px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          {copied === k ? '✓ Copied!' : 'Copy link'}
        </button>
      </div>
    </div>
  )

  return (
    <ModalShell title="Share Roadmap" onClose={onClose}>
      <LinkRow
        k="view"
        label="View only"
        desc="Anyone with this link can view the roadmap but cannot make changes."
        url={viewUrl}
      />
      <LinkRow
        k="edit"
        label="Full access"
        desc="Anyone with this link can view and edit the roadmap."
        url={editUrl}
      />
      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
        The base URL (no query param) always opens in edit mode for you.
      </p>
    </ModalShell>
  )
}
