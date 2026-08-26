import { useState, useRef } from 'react'
import { getAvatarColor } from '../utils/dateUtils'
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

// ── Add person form (combobox style) ─────────────────────────────────────────
function AddPersonForm({ roles, onSave, onDone, onAddRole, recentPeople = [] }) {
  const [query,      setQuery]      = useState('')
  const [open,       setOpen]       = useState(false)
  const [selected,   setSelected]   = useState(null)
  const [email,      setEmail]      = useState('')
  const [photo,      setPhoto]      = useState(null)
  const [role,       setRole]       = useState('Designer')
  const [customRole, setCustomRole] = useState('')
  const [saving,     setSaving]     = useState(false)
  const inputRef = useRef(null)

  const filtered = recentPeople.filter(p =>
    !query || p.name?.toLowerCase().includes(query.toLowerCase()) ||
    p.email?.toLowerCase().includes(query.toLowerCase())
  )

  const handleSelect = (person) => {
    setSelected(person)
    setQuery(person.name)
    setEmail(person.email || '')
    setPhoto(person.photo || null)
    setRole(person.role || 'Designer')
    setOpen(false)
  }

  const isNew = !selected && query.trim().length > 0

  const handleSave = async () => {
    if (!query.trim()) return
    setSaving(true)
    const roleToUse = role === '__custom__' ? customRole.trim() : role
    if (roleToUse && !roles?.includes(roleToUse)) await onAddRole?.(roleToUse)
    await onSave({
      name:  query.trim(),
      email: email.trim() || null,
      photo: photo || null,
      role:  roleToUse || 'Designer',
      color: getAvatarColor(query.trim()),
    })
    setSaving(false)
    onDone()
  }

  return (
    <div className="settings-inline-form" style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Name or email…"
          autoFocus
          style={{ width: '100%' }}
        />
        {open && (recentPeople.length > 0 || query.length > 0) && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto',
            marginTop: 4,
          }}>
            {(query.length === 0 ? recentPeople : filtered).map((p) => (
              <div key={p.email || p.name}
                onMouseDown={() => handleSelect(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.background = ''}
              >
                {p.photo
                  ? <img src={p.photo} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                  : <div style={{ width: 28, height: 28, borderRadius: '50%', background: getAvatarColor(p.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {p.name?.charAt(0).toUpperCase()}
                    </div>
                }
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{p.name}</div>
                  {p.email && <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.email}</div>}
                </div>
              </div>
            ))}
            {query.length > 0 && filtered.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280' }}>
                Press Save to add "{query}" as a new person
              </div>
            )}
          </div>
        )}
      </div>

      {isNew && (
        <>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email" />
          <PhotoPicker value={photo} onChange={setPhoto} />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {(roles || ['Designer', 'PM', 'Dev']).map(r => <option key={r} value={r}>{r}</option>)}
            <option value="__custom__">+ New role…</option>
          </select>
          {role === '__custom__' && (
            <input value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder="Role name" />
          )}
        </>
      )}

      {selected && (
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {(roles || ['Designer', 'PM', 'Dev']).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      )}

      <div className="settings-inline-actions">
        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={handleSave} disabled={saving || !query.trim()}>
          {saving ? 'Saving…' : selected ? 'Add to board' : 'Save'}
        </button>
        <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={onDone}>Cancel</button>
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
  isOwner, recentPeople = [],
  board, onRenameBoard, onDeleteBoard,
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
          {/* ── Board actions ──────────────────────────────────────── */}
          {isOwner && (onRenameBoard || onDeleteBoard) && (
            <div className="settings-section">
              <div className="settings-section__header">
                <span className="settings-section__title">Board</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {onRenameBoard && (
                  <button className="settings-item__btn" onClick={() => {
                    const name = window.prompt('Rename board:', board?.name || '')
                    if (name?.trim() && name.trim() !== board?.name) {
                      onRenameBoard(board.id, name.trim())
                    }
                  }}>Rename board</button>
                )}
                {onDeleteBoard && (
                  <button className="settings-item__btn settings-item__btn--delete" onClick={() => {
                    if (window.confirm(`Delete "${board?.name}"? This cannot be undone.`)) {
                      onDeleteBoard(board.id)
                      onClose()
                    }
                  }}>Delete board</button>
                )}
              </div>
            </div>
          )}

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
                recentPeople={recentPeople}
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
