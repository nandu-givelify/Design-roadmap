import { useState } from 'react'
import { signOutUser, setUserProfile } from '../firebase'
import { getAvatarColor } from '../utils/dateUtils'
import { PhotoPicker } from './Modals'

// Transparent 1×1 GIF — used as invisible drag image so browser shows nothing
const TRANSPARENT_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

// ── Profile editor panel ──────────────────────────────────────────────────────
function ProfilePanel({ user, profile, onSave, onClose }) {
  const [name,  setName]  = useState(profile?.name  || user?.displayName || '')
  const [photo, setPhoto] = useState(profile?.photo || user?.photoURL    || null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try { await onSave({ name: name.trim() || null, photo: photo || null }) } finally { setSaving(false) }
    onClose()
  }

  return (
    <div className="left-nav__profile-panel">
      <div className="left-nav__profile-panel__title">Edit profile</div>
      <PhotoPicker value={photo} onChange={setPhoto} />
      <input
        className="left-nav__profile-input"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Display name"
      />
      <div className="left-nav__profile-actions">
        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function LeftNav({
  user, userProfile, onUpdateProfile,
  boards, activeBoardId, favoriteBoardIds = [],
  onSelectBoard, onNewBoard, onReorderBoards, onToggleFavorite,
  isOverlay, onClose, onDock,
}) {
  const [showUserMenu,   setShowUserMenu]   = useState(false)
  const [showProfile,    setShowProfile]    = useState(false)
  const [draggedId,      setDraggedId]      = useState(null)
  const [dragOverId,     setDragOverId]     = useState(null)
  const [dragPosition,   setDragPosition]   = useState(null)

  const displayName  = userProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'You'
  const photoUrl     = userProfile?.photo || user?.photoURL || null
  const avatarLetter = displayName.charAt(0).toUpperCase()
  const avatarColor  = getAvatarColor(user?.email || displayName)

  const favoriteBoards = boards.filter(b => favoriteBoardIds.includes(b.id))
  const hasFavorites   = favoriteBoards.length > 0

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (e, boardId) => {
    setDraggedId(boardId)
    e.dataTransfer.effectAllowed = 'move'
    const img = new Image()
    img.src = TRANSPARENT_GIF
    e.dataTransfer.setDragImage(img, 0, 0)
  }

  const handleDragOver = (e, boardId) => {
    e.preventDefault()
    if (boardId === draggedId) return
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOverId(boardId)
    setDragPosition(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
  }

  const handleDrop = (e, targetId) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) { resetDrag(); return }
    const ids = boards.map(b => b.id)
    const newIds = ids.filter(id => id !== draggedId)
    const targetIdx = newIds.indexOf(targetId)
    newIds.splice(dragPosition === 'after' ? targetIdx + 1 : targetIdx, 0, draggedId)
    onReorderBoards(newIds)
    resetDrag()
  }

  const resetDrag = () => { setDraggedId(null); setDragOverId(null); setDragPosition(null) }

  const renderBoardItem = (board) => (
    <div
      key={board.id}
      className={[
        'left-nav__board-wrap',
        dragOverId === board.id && dragPosition === 'before' ? 'left-nav__board-wrap--before' : '',
        dragOverId === board.id && dragPosition === 'after'  ? 'left-nav__board-wrap--after'  : '',
      ].filter(Boolean).join(' ')}
      draggable
      onDragStart={e => handleDragStart(e, board.id)}
      onDragOver={e => handleDragOver(e, board.id)}
      onDrop={e => handleDrop(e, board.id)}
      onDragEnd={resetDrag}
    >
      <div className={`left-nav__board-row${board.id === activeBoardId ? ' left-nav__board-row--active' : ''}${draggedId === board.id ? ' left-nav__board-row--dragging' : ''}`}>
        <button
          className="left-nav__board-btn"
          onClick={() => { onSelectBoard(board.id); if (isOverlay) onClose?.() }}
          title={board.name}
        >
          <span className="left-nav__board-name">{board.name}</span>
        </button>

        <button
          className={`left-nav__star-btn${favoriteBoardIds.includes(board.id) ? ' left-nav__star-btn--active' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleFavorite(board.id) }}
          title={favoriteBoardIds.includes(board.id) ? 'Remove from favourites' : 'Add to favourites'}
        >
          <StarIcon filled={favoriteBoardIds.includes(board.id)} />
        </button>
      </div>
    </div>
  )

  return (
    <nav className={`left-nav${isOverlay ? ' left-nav--overlay' : ''}`}>

      {/* ── Header ── */}
      <div className="left-nav__header">
        <div className="left-nav__brand">
          <NavLogo />
          <span className="left-nav__brand-name">RoadMap</span>
        </div>
        {isOverlay ? (
          <button className="left-nav__toggle" onClick={onDock} title="Dock navigation">
            <ChevronRight />
          </button>
        ) : (
          <button className="left-nav__toggle" onClick={onClose} title="Collapse navigation">
            <ChevronLeft />
          </button>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div className="left-nav__body">

        {/* Favourites section — only when at least one board is starred */}
        {hasFavorites && (
          <div className="left-nav__section">
            <div className="left-nav__section-label">Favourites</div>
            <div className="left-nav__boards-list">
              {favoriteBoards.map(renderBoardItem)}
            </div>
          </div>
        )}

        {/* All Boards section */}
        <div className="left-nav__section">
          <div className="left-nav__section-label">
            <span>Boards</span>
            <button className="left-nav__new-btn" onClick={onNewBoard} title="New board"><PlusIcon /></button>
          </div>
          <div className="left-nav__boards-list">
            {boards.map(renderBoardItem)}
            {boards.length === 0 && (
              <div className="left-nav__empty-boards">No boards yet</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer (user profile) ── */}
      <div className="left-nav__footer">
        <div className="left-nav__user-wrap" style={{ position: 'relative' }}>
          {showProfile && (
            <ProfilePanel
              user={user}
              profile={userProfile}
              onSave={onUpdateProfile}
              onClose={() => setShowProfile(false)}
            />
          )}

          <button className="left-nav__user-btn" onClick={() => setShowUserMenu(v => !v)} title={displayName}>
            <div className="left-nav__avatar" style={{ background: photoUrl ? 'transparent' : avatarColor }}>
              {photoUrl ? <img src={photoUrl} alt="" /> : avatarLetter}
            </div>
            <div className="left-nav__user-text">
              <span className="left-nav__user-name">{displayName}</span>
              <span className="left-nav__user-email">{user?.email}</span>
            </div>
          </button>

          {showUserMenu && (
            <>
              <div className="left-nav__backdrop" onClick={() => setShowUserMenu(false)} />
              <div className="left-nav__user-menu">
                <div className="left-nav__user-menu-header">
                  <div className="left-nav__user-menu-name">{displayName}</div>
                  <div className="left-nav__user-menu-email">{user?.email}</div>
                </div>
                <button className="left-nav__user-menu-item"
                  onClick={() => { setShowUserMenu(false); setShowProfile(true) }}>
                  Edit profile
                </button>
                <button className="left-nav__user-menu-item left-nav__user-menu-item--danger"
                  onClick={() => { signOutUser(); setShowUserMenu(false) }}>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

// ── Icons (Material Design, 24px) ─────────────────────────────────────────────
function NavLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="var(--m3-primary)"/>
      <rect x="6" y="10" width="20" height="3" rx="1.5" fill="white"/>
      <rect x="6" y="15" width="14" height="3" rx="1.5" fill="white" opacity="0.75"/>
      <rect x="6" y="20" width="17" height="3" rx="1.5" fill="white" opacity="0.5"/>
    </svg>
  )
}
const ChevronLeft  = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
const ChevronRight = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
const PlusIcon     = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
const StarIcon     = ({ filled }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
  </svg>
)
