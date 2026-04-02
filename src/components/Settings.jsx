import { useState } from 'react'
import { getAvatarColor, AVATAR_COLORS } from '../utils/dateUtils'
import { updatePerson, deletePerson, updateTeam, deleteTeam, addPerson, addTeam } from '../firebase'
import { PhotoPicker } from './Modals'

// ── Inline edit form for a person ─────────────────────────────────────────────
function PersonEditForm({ person, teams, onDone }) {
  const [name,   setName]   = useState(person.name   || '')
  const [email,  setEmail]  = useState(person.email  || '')
  const [teamId, setTeamId] = useState(person.teamId || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await updatePerson(person.id, {
      name:   name.trim(),
      email:  email.trim(),
      teamId: teamId || null,
      color:  getAvatarColor(name.trim()),
    })
    setSaving(false)
    onDone()
  }

  return (
    <div className="settings-inline-form">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        autoFocus
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optional)"
        type="email"
      />
      <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
        <option value="">No team</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <div className="settings-inline-actions">
        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Inline edit form for a team ───────────────────────────────────────────────
function TeamEditForm({ team, onDone }) {
  const [name,   setName]   = useState(team.name || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await updateTeam(team.id, { name: name.trim() })
    setSaving(false)
    onDone()
  }

  return (
    <div className="settings-inline-form">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Team name"
        autoFocus
      />
      <div className="settings-inline-actions">
        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={handleSave} disabled={saving || !name.trim()}>
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
function AddPersonForm({ teams, onDone }) {
  const [name,   setName]   = useState('')
  const [email,  setEmail]  = useState('')
  const [teamId, setTeamId] = useState('')
  const [photo,  setPhoto]  = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await addPerson({
      name:   name.trim(),
      email:  email.trim(),
      teamId: teamId || null,
      photo:  photo || null,
      color:  getAvatarColor(name.trim()),
    })
    setSaving(false)
    onDone()
  }

  return (
    <div className="settings-inline-form">
      <PhotoPicker value={photo} onChange={setPhoto} />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email" />
      <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
        <option value="">No team</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <div className="settings-inline-actions">
        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Adding…' : 'Add Person'}
        </button>
        <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Add team form ─────────────────────────────────────────────────────────────
function AddTeamForm({ onDone }) {
  const [name,   setName]   = useState('')
  const [photo,  setPhoto]  = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await addTeam({ name: name.trim(), photo: photo || null })
    setSaving(false)
    onDone()
  }

  return (
    <div className="settings-inline-form">
      <PhotoPicker value={photo} onChange={setPhoto} isTeam />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name" autoFocus />
      <div className="settings-inline-actions">
        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Adding…' : 'Add Team'}
        </button>
        <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main Settings panel ───────────────────────────────────────────────────────
export default function Settings({ onClose, people, teams }) {
  const [editingPersonId, setEditingPersonId] = useState(null)
  const [editingTeamId,   setEditingTeamId]   = useState(null)
  const [addingPerson,    setAddingPerson]     = useState(false)
  const [addingTeam,      setAddingTeam]       = useState(false)
  const [confirmDelete,   setConfirmDelete]    = useState(null) // { type, id, name }

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return
    if (confirmDelete.type === 'person') await deletePerson(confirmDelete.id)
    if (confirmDelete.type === 'team')   await deleteTeam(confirmDelete.id)
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

          {/* ── Teams section ─────────────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section__header">
              <span className="settings-section__title">Teams</span>
              <button className="settings-section__add" onClick={() => { setAddingTeam(true); setAddingPerson(false) }}>
                + Add team
              </button>
            </div>

            {addingTeam && (
              <AddTeamForm onDone={() => setAddingTeam(false)} />
            )}

            {teams.map((team) => (
              <div key={team.id}>
                <div className="settings-item">
                  <div
                    className="settings-item__avatar settings-item__avatar--team"
                    style={{ background: '#6366f1' }}
                  >
                    {team.photo
                      ? <img src={team.photo} alt="" />
                      : team.name?.charAt(0).toUpperCase()
                    }
                  </div>
                  <div className="settings-item__info">
                    <div className="settings-item__name">{team.name}</div>
                    <div className="settings-item__sub">
                      {people.filter((p) => p.teamId === team.id).length} member(s)
                    </div>
                  </div>
                  <div className="settings-item__actions">
                    <button
                      className="settings-item__btn"
                      onClick={() => { setEditingTeamId(editingTeamId === team.id ? null : team.id); setEditingPersonId(null) }}
                    >
                      Edit
                    </button>
                    <button
                      className="settings-item__btn settings-item__btn--delete"
                      onClick={() => setConfirmDelete({ type: 'team', id: team.id, name: team.name })}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {editingTeamId === team.id && (
                  <TeamEditForm team={team} onDone={() => setEditingTeamId(null)} />
                )}
              </div>
            ))}

            {teams.length === 0 && !addingTeam && (
              <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>No teams yet.</div>
            )}
          </div>

          {/* ── People section ─────────────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section__header">
              <span className="settings-section__title">People</span>
              <button className="settings-section__add" onClick={() => { setAddingPerson(true); setAddingTeam(false) }}>
                + Add person
              </button>
            </div>

            {addingPerson && (
              <AddPersonForm teams={teams} onDone={() => setAddingPerson(false)} />
            )}

            {people.map((person) => {
              const personTeam = teams.find((t) => t.id === person.teamId)
              return (
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
                      <div className="settings-item__sub">
                        {[person.email, personTeam?.name].filter(Boolean).join(' · ') || 'No team'}
                      </div>
                    </div>
                    <div className="settings-item__actions">
                      <button
                        className="settings-item__btn"
                        onClick={() => { setEditingPersonId(editingPersonId === person.id ? null : person.id); setEditingTeamId(null) }}
                      >
                        Edit
                      </button>
                      <button
                        className="settings-item__btn settings-item__btn--delete"
                        onClick={() => setConfirmDelete({ type: 'person', id: person.id, name: person.name })}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {editingPersonId === person.id && (
                    <PersonEditForm
                      person={person}
                      teams={teams}
                      onDone={() => setEditingPersonId(null)}
                    />
                  )}
                </div>
              )
            })}

            {people.length === 0 && !addingPerson && (
              <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>No people yet.</div>
            )}
          </div>
        </div>

        {/* ── Delete confirmation ──────────────────────────────────────── */}
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
