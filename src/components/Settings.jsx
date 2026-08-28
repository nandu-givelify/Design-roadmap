import { useState, useRef, useEffect } from 'react'
import { getAvatarColor } from '../utils/dateUtils'
import { PhotoPicker } from './Modals'

// ── Enter-key navigation helper ───────────────────────────────────────────────
// Pass refs array; onSubmit triggers primary button when Enter pressed on last field.
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
function PersonEditForm({ person, roles, onSave, onDone, onAddRole }) {
  const [name,       setName]       = useState(person.name  || '')
  const [email,      setEmail]      = useState(person.email || '')
  const [role,       setRole]       = useState(person.role  || 'Designer')
  const [photo,      setPhoto]      = useState(person.photo || null)
  const [customRole, setCustomRole] = useState('')
  const [saving,     setSaving]     = useState(false)

  const nameRef       = useRef(null)
  const emailRef      = useRef(null)
  const customRoleRef = useRef(null)

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

  const fieldRefs = [nameRef, emailRef, ...(role === '__custom__' ? [customRoleRef] : [])]
  const onKey = useEnterNav(fieldRefs, handleSave)

  return (
    <div className="settings-inline-form">
      <PhotoPicker value={photo} onChange={setPhoto} />
      <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Full name" autoFocus onKeyDown={onKey(0)} />
      <input ref={emailRef} value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optional)" type="email" onKeyDown={onKey(1)} />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        {allRoles.map((r) => <option key={r} value={r}>{r}</option>)}
        <option value="__custom__">+ New role…</option>
      </select>
      {role === '__custom__' && (
        <input ref={customRoleRef} value={customRole} onChange={(e) => setCustomRole(e.target.value)}
          placeholder="Role name" onKeyDown={onKey(2)} />
      )}
      <div className="settings-inline-actions">
        <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={onDone}>
          Cancel
        </button>
        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={handleSave}
          disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Save'}
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

  const inputRef      = useRef(null)
  const emailRef      = useRef(null)
  const customRoleRef = useRef(null)

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

  const fieldRefs = [inputRef, ...(isNew ? [emailRef] : []), ...(role === '__custom__' ? [customRoleRef] : [])]
  const onKey = useEnterNav(fieldRefs, handleSave)

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
          onKeyDown={onKey(0)}
        />
        {open && (recentPeople.length > 0 || query.length > 0) && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            background: 'var(--m3-surface)', border: '1px solid var(--m3-outline-variant)', borderRadius: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto',
            marginTop: 4,
          }}>
            {(query.length === 0 ? recentPeople : filtered).map((p) => (
              <div key={p.email || p.name}
                onMouseDown={() => handleSelect(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--m3-surface-container-high)'}
                onMouseLeave={(e) => e.currentTarget.style.background = ''}
              >
                {p.photo
                  ? <img src={p.photo} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                  : <div style={{ width: 28, height: 28, borderRadius: '50%', background: getAvatarColor(p.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {p.name?.charAt(0).toUpperCase()}
                    </div>
                }
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface)' }}>{p.name}</div>
                  {p.email && <div style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)' }}>{p.email}</div>}
                </div>
              </div>
            ))}
            {query.length > 0 && filtered.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>
                Press Save to add "{query}" as a new person
              </div>
            )}
          </div>
        )}
      </div>

      {isNew && (
        <>
          <input ref={emailRef} value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)" type="email" onKeyDown={onKey(1)} />
          <PhotoPicker value={photo} onChange={setPhoto} />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {(roles || ['Designer', 'PM', 'Dev']).map(r => <option key={r} value={r}>{r}</option>)}
            <option value="__custom__">+ New role…</option>
          </select>
          {role === '__custom__' && (
            <input ref={customRoleRef} value={customRole} onChange={(e) => setCustomRole(e.target.value)}
              placeholder="Role name" onKeyDown={onKey(2)} />
          )}
        </>
      )}

      {selected && (
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {(roles || ['Designer', 'PM', 'Dev']).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      )}

      <div className="settings-inline-actions">
        <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={onDone}>
          Cancel
        </button>
        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={handleSave} disabled={saving || !query.trim()}>
          {saving ? 'Saving…' : selected ? 'Add to board' : 'Save'}
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
  const nameRef = useRef(null)

  const handleSave = () => {
    if (!name.trim()) return
    const id = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    onSave({ id, name: name.trim(), color })
  }

  return (
    <div className="settings-inline-form">
      <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Phase name" autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {PHASE_COLORS.map(c => (
          <button key={c} type="button" onClick={() => setColor(c)}
            style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer',
              border: color === c ? '2px solid var(--m3-primary)' : '2px solid transparent', padding: 0 }} />
        ))}
      </div>
      <div className="settings-inline-actions">
        <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={onDone}>
          Cancel
        </button>
        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={handleSave} disabled={!name.trim()}>
          Add
        </button>
      </div>
    </div>
  )
}

// ── Board rename modal ────────────────────────────────────────────────────────
function RenameBoardModal({ board, onSave, onClose }) {
  const [name, setName] = useState(board?.name || '')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSave = () => {
    if (name.trim() && name.trim() !== board?.name) onSave(board.id, name.trim())
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 360 }} onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <span className="modal__title">Rename board</span>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>
        <div className="modal__body">
          <div className="field">
            <label className="field__label">Board name</label>
            <input ref={inputRef} className="field__input" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
              placeholder="Board name" />
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={!name.trim()}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Person row with "..." dropdown ───────────────────────────────────────────
function PersonRow({ person, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div
      className="settings-item"
      style={{ cursor: 'pointer' }}
      onClick={() => setOpen(v => !v)}
    >
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
      <div className="settings-item__actions" ref={menuRef} style={{ position: 'relative' }}>
        <button
          className="settings-item__btn"
          style={{ padding: '4px 8px', fontSize: 18, lineHeight: 1, letterSpacing: 1 }}
          onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
          title="More actions"
        >
          <DotsVerticalIcon />
        </button>
        {open && (
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 300,
            background: 'var(--m3-surface-container-low)',
            border: '1px solid var(--m3-outline-variant)',
            borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            minWidth: 140, overflow: 'hidden',
          }}>
            <button
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 16px',
                fontSize: 13, color: 'var(--m3-on-surface)', textAlign: 'left',
                transition: 'background 0.1s', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--m3-surface-container-high)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
              onClick={e => { e.stopPropagation(); setOpen(false); onEdit() }}
            >
              <EditIcon /> Edit
            </button>
            <button
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 16px',
                fontSize: 13, color: 'var(--m3-error)', textAlign: 'left',
                transition: 'background 0.1s', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--m3-error-container)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
              onClick={e => { e.stopPropagation(); setOpen(false); onDelete() }}
            >
              <DeleteIcon /> Delete
            </button>
          </div>
        )}
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
  const [showRename,    setShowRename]    = useState(false)
  const [boardMenuOpen, setBoardMenuOpen] = useState(false)
  const boardMenuRef = useRef(null)

  useEffect(() => {
    if (!boardMenuOpen) return
    const handler = (e) => { if (!boardMenuRef.current?.contains(e.target)) setBoardMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [boardMenuOpen])

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return
    await onDeletePerson(confirmDelete.id)
    setConfirmDelete(null)
  }

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
                <div ref={boardMenuRef} style={{ position: 'relative' }}>
                  <button
                    className="settings-item__btn"
                    style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setBoardMenuOpen(v => !v)}
                  >
                    <DotsVerticalIcon /> Actions
                  </button>
                  {boardMenuOpen && (
                    <div style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 300,
                      background: 'var(--m3-surface-container-low)',
                      border: '1px solid var(--m3-outline-variant)',
                      borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                      minWidth: 160, overflow: 'hidden',
                    }}>
                      {onRenameBoard && (
                        <button
                          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 16px',
                            fontSize: 13, color: 'var(--m3-on-surface)', textAlign: 'left',
                            transition: 'background 0.1s', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--m3-surface-container-high)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}
                          onClick={() => { setBoardMenuOpen(false); setShowRename(true) }}
                        >
                          <EditIcon /> Rename board
                        </button>
                      )}
                      {onDeleteBoard && (
                        <button
                          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 16px',
                            fontSize: 13, color: 'var(--m3-error)', textAlign: 'left',
                            transition: 'background 0.1s', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--m3-error-container)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}
                          onClick={() => {
                            setBoardMenuOpen(false)
                            if (window.confirm(`Delete "${board?.name}"? This cannot be undone.`)) {
                              onDeleteBoard(board.id)
                              onClose()
                            }
                          }}
                        >
                          <DeleteIcon /> Delete board
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', padding: '4px 0' }}>
                {board?.name}
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
                <PersonRow
                  person={person}
                  onEdit={() => setEditingId(editingId === person.id ? null : person.id)}
                  onDelete={() => setConfirmDelete({ id: person.id, name: person.name })}
                />
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
              <div style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', padding: '8px 0' }}>No people yet.</div>
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

      {showRename && (
        <RenameBoardModal
          board={board}
          onSave={onRenameBoard}
          onClose={() => setShowRename(false)}
        />
      )}
    </>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const DotsVerticalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
  </svg>
)

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
  </svg>
)

const DeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
  </svg>
)
