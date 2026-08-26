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
}) {
  const [collapsed,      setCollapsed]      = useState(false)
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
          onClick={() => onSelectBoard(board.id)}
          title={board.name}
        >
          {!collapsed && <span className="left-nav__board-name">{board.name}</span>}
          {collapsed && <span className="left-nav__board-initial">{board.name.charAt(0).toUpperCase()}</span>}
        </button>

        {!collapsed && (
          <button
            className={`left-nav__star-btn${favoriteBoardIds.includes(board.id) ? ' left-nav__star-btn--active' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleFavorite(board.id) }}
            title={favoriteBoardIds.includes(board.id) ? 'Remove from favourites' : 'Add to favourites'}
          >
            <StarIcon filled={favoriteBoardIds.includes(board.id)} />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <nav className={`left-nav${collapsed ? ' left-nav--collapsed' : ''}`}>

      {/* ── Header ── */}
      <div className="left-nav__header">
        {!collapsed && (
          <div className="left-nav__brand">
            <NavLogo />
            <span className="left-nav__brand-name">RoadMap</span>
          </div>
        )}
        <button className="left-nav__toggle" onClick={() => setCollapsed(v => !v)} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="left-nav__body">

        {/* Favourites section — only when at least one board is starred */}
        {hasFavorites && (
          <div className="left-nav__section">
            {!collapsed && <div className="left-nav__section-label">Favourites</div>}
            <div className="left-nav__boards-list">
              {favoriteBoards.map(renderBoardItem)}
            </div>
          </div>
        )}

        {/* All Boards section */}
        <div className="left-nav__section">
          {!collapsed && (
            <div className="left-nav__section-label">
              <span>Boards</span>
              <button className="left-nav__new-btn" onClick={onNewBoard} title="New board"><PlusIcon /></button>
            </div>
          )}
          {collapsed && (
            <button className="left-nav__icon-btn" onClick={onNewBoard} title="New board"><PlusIcon /></button>
          )}
          <div className="left-nav__boards-list">
            {boards.map(renderBoardItem)}
            {boards.length === 0 && !collapsed && (
              <div className="left-nav__empty-boards">No boards yet</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer (user profile only — settings moved to header) ── */}
      <div className="left-nav__footer">
        <div className="left-nav__user-wrap" style={{ position: 'relative' }}>
          {showProfile && !collapsed && (
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
            {!collapsed && (
              <div className="left-nav__user-text">
                <span className="left-nav__user-name">{displayName}</span>
                <span className="left-nav__user-email">{user?.email}</span>
              </div>
            )}
            {!collapsed && (
              <button
                className="left-nav__edit-profile-btn"
                title="Edit profile"
                onClick={e => { e.stopPropagation(); setShowUserMenu(false); setShowProfile(v => !v) }}
              >
                <PencilIcon />
              </button>
            )}
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

// ── Icons ─────────────────────────────────────────────────────────────────────
function NavLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#111827"/>
      <rect x="6" y="10" width="20" height="3" rx="1.5" fill="white"/>
      <rect x="6" y="15" width="14" height="3" rx="1.5" fill="white" opacity="0.7"/>
      <rect x="6" y="20" width="17" height="3" rx="1.5" fill="white" opacity="0.5"/>
    </svg>
  )
}
const ChevronLeft  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
const ChevronRight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
const PlusIcon     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const PencilIcon   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const StarIcon     = ({ filled }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)
