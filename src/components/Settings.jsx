import { useState } from 'react'
import { getAvatarColor, AVATAR_COLORS } from '../utils/dateUtils'
import { PhotoPicker } from './Modals'

// ── Inline edit form for a person ─────────────────────────────────────────────
function PersonEditForm({ person, roles, onSave, onDone, onAddRole }) {
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
      color: getAvatarColor(name.trim()),
    })
    setSaving(false)
    onDone()
  }

  return (
    <div className="settings-inline-form">
      <PhotoPicker value={photo} onChange={setPhoto} />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email" />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        {allRoles.map((r) => <option key={r} value={r}>{r}</option>)}
        <option value="__custom__">+ New role…</option>
      </select>
      {role === '__custom__' && (
        <input value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder="Role name" />
      )}
      <div className="settings-inline-actions">
        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={handleSave}
          disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Add person form ───────────────────────────────────────────────────────────
function AddPersonForm({ roles, onSave, onDone, onAddRole }) {
  const [name,       setName]       = useState('')
  const [email,      setEmail]      = useState('')
  const [role,       setRole]       = useState('Designer')
  const [photo,      setPhoto]      = useState(null)
  const [customRole, setCustomRole] = useState('')
  const [saving,     setSaving]     = useState(false)

  const allRoles = [...(roles || ['Designer', 'PM', 'Dev'])]

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const roleToUse = role === '__custom__' ? customRole.trim() : role
    if (roleToUse && !allRoles.includes(roleToUse)) await onAddRole?.(roleToUse)
    await onSave({
      name:  name.trim(),
      email: email.trim() || null,
      photo: photo || null,
      role:  roleToUse || 'Designer',
      color: getAvatarColor(name.trim()),
    })
    setSaving(false)
    onDone()
  }

  return (
    <div className="settings-inline-form">
      <PhotoPicker value={photo} onChange={setPhoto} />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email" />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        {allRoles.map((r) => <option key={r} value={r}>{r}</option>)}
        <option value="__custom__">+ New role…</option>
      </select>
      {role === '__custom__' && (
        <input value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder="Role name" />
      )}
      <div className="settings-inline-actions">
        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={handleSave}
          disabled={saving || !name.trim()}>
          {saving ? 'Adding…' : 'Add Person'}
        </button>
        <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
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
    <div className="settings-inline-form">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Phase name" autoFocus />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {PHASE_COLORS.map(c => (
          <button key={c} type="button" onClick={() => setColor(c)}
            style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer',
              border: color === c ? '2px solid #111827' : '2px solid transparent', padding: 0 }} />
        ))}
      </div>
      <div className="settings-inline-actions">
        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={handleSave} disabled={!name.trim()}>Add</button>
        <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={onDone}>Cancel</button>
      </div>
    </div>
  )
}

// ── Main Settings panel ───────────────────────────────────────────────────────
export default function Settings({
  onClose, boardId, people, roles,
  boardPhases, onUpdateBoardPhases,
  onUpdatePerson, onDeletePerson, onAddPerson, onAddRole,
  isOwner,
}) {
  const [editingId,     setEditingId]     = useState(null)
  const [adding,        setAdding]        = useState(false)
  const [addingPhase,   setAddingPhase]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return
    await onDeletePerson(confirmDelete.id)
    setConfirmDelete(null)
  }

  // Group people by role for display
  const byRole = {}
  people.forEach((p) => {
    const r = p.role || 'Other'
    if (!byRole[r]) byRole[r] = []
    byRole[r].push(p)
  })

  return (
    <>
      <div className="settings-overlay" onClick={onClose} />
      <div className="settings-panel">
        <div className="settings-panel__header">
          <span className="settings-panel__title">Settings</span>
          <button className="settings-panel__close" onClick={onClose}>×</button>
        </div>

        <div className="settings-panel__body">
          {/* ── People section ─────────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section__header">
              <span className="settings-section__title">People</span>
              <button className="settings-section__add" onClick={() => { setAdding(true); setEditingId(null) }}>
                + Add person
              </button>
            </div>

            {adding && (
              <AddPersonForm
                roles={roles}
                onSave={onAddPerson}
                onDone={() => setAdding(false)}
                onAddRole={onAddRole}
              />
            )}

            {people.map((person) => (
              <div key={person.id}>
                <div className="settings-item">
                  <div
                    className="settings-item__avatar"
                    style={{ background: person.color || getAvatarColor(person.name) }}
                  >
                    {person.photo
                      ? <img src={person.photo} alt="" />
                      : person.name?.charAt(0).toUpperCase()
                    }
                  </div>
                  <div className="settings-item__info">
                    <div className="settings-item__name">{person.name}</div>
                    <div className="settings-item__sub">{person.role || 'No role'}{person.email ? ` · ${person.email}` : ''}</div>
                  </div>
                  <div className="settings-item__actions">
                    <button
                      className="settings-item__btn"
                      onClick={() => setEditingId(editingId === person.id ? null : person.id)}
                    >Edit</button>
                    <button
                      className="settings-item__btn settings-item__btn--delete"
                      onClick={() => setConfirmDelete({ id: person.id, name: person.name })}
                    >Delete</button>
                  </div>
                </div>
                {editingId === person.id && (
                  <PersonEditForm
                    person={person}
                    roles={roles}
                    onSave={onUpdatePerson}
                    onDone={() => setEditingId(null)}
                    onAddRole={onAddRole}
                  />
                )}
              </div>
            ))}

            {people.length === 0 && !adding && (
              <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>No people yet.</div>
            )}
          </div>

          {/* ── Roles section ──────────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section__header">
              <span className="settings-section__title">Roles</span>
            </div>
            <div className="settings-roles">
              {(roles || []).map((r) => (
                <span key={r} className="settings-role-tag">{r}</span>
              ))}
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
              Add new roles when creating or editing a person.
            </p>
          </div>

          {/* ── Phases section ─────────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section__header">
              <span className="settings-section__title">Phases</span>
              {isOwner && (
                <button className="settings-section__add" onClick={() => setAddingPhase(true)}>
                  + Add phase
                </button>
              )}
            </div>

            {(boardPhases || []).map((phase) => (
              <div key={phase.id} className="settings-phase-item">
                <span className="settings-phase-dot" style={{ background: phase.color }} />
                <span className="settings-phase-name">{phase.name}</span>
                <div style={{ flex: 1 }} />
                {isOwner && (
                  <button className="settings-item__btn settings-item__btn--delete"
                    onClick={() => {
                      if ((boardPhases || []).length <= 1) return
                      onUpdateBoardPhases((boardPhases || []).filter(p => p.id !== phase.id))
                    }}>Delete</button>
                )}
              </div>
            ))}

            {addingPhase && isOwner && (
              <AddPhaseForm
                existingPhases={boardPhases || []}
                onSave={(phase) => {
                  onUpdateBoardPhases([...(boardPhases || []), phase])
                  setAddingPhase(false)
                }}
                onDone={() => setAddingPhase(false)}
              />
            )}
          </div>
        </div>

        {confirmDelete && (
          <div className="settings-confirm">
            <div className="settings-confirm__text">
              Delete <strong>{confirmDelete.name}</strong>? This cannot be undone.
            </div>
            <div className="settings-confirm__actions">
              <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="btn-danger" style={{ fontSize: 12, padding: '5px 12px' }} onClick={handleDeleteConfirmed}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
