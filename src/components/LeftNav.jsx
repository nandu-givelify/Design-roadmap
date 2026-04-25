import { useState, useRef } from 'react'
import { signOutUser } from '../firebase'
import { getAvatarColor } from '../utils/dateUtils'

export default function LeftNav({
  user, boards, activeBoardId,
  onSelectBoard, onNewBoard, onSettings, onReorderBoards,
}) {
  const [collapsed,    setCollapsed]    = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [draggedId,    setDraggedId]    = useState(null)
  const [dragOverId,   setDragOverId]   = useState(null)
  const [dragPosition, setDragPosition] = useState(null) // 'before' | 'after'

  const displayName  = user?.displayName || user?.email?.split('@')[0] || 'You'
  const avatarLetter = displayName.charAt(0).toUpperCase()
  const avatarColor  = getAvatarColor(user?.email || displayName)

  // ── Drag-and-drop handlers ────────────────────────────────────────────────
  const handleDragStart = (e, boardId) => {
    setDraggedId(boardId)
    e.dataTransfer.effectAllowed = 'move'
    // Transparent drag image
    const ghost = document.createElement('div')
    ghost.style.position = 'absolute'
    ghost.style.top = '-999px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  const handleDragOver = (e, boardId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (boardId === draggedId) return
    // Determine if dropping before or after target
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDragOverId(boardId)
    setDragPosition(e.clientY < midY ? 'before' : 'after')
  }

  const handleDrop = (e, targetId) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null); setDragOverId(null); setDragPosition(null)
      return
    }
    const ids = boards.map(b => b.id)
    const fromIdx = ids.indexOf(draggedId)
    const toIdx   = ids.indexOf(targetId)
    const newIds  = [...ids]
    newIds.splice(fromIdx, 1)
    const insertAt = dragPosition === 'after' ? toIdx : toIdx
    // Recalculate insert index after removal
    const adjustedIdx = newIds.indexOf(targetId)
    newIds.splice(dragPosition === 'after' ? adjustedIdx + 1 : adjustedIdx, 0, draggedId)
    onReorderBoards(newIds)
    setDraggedId(null); setDragOverId(null); setDragPosition(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null); setDragOverId(null); setDragPosition(null)
  }

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
        <button
          className="left-nav__toggle"
          onClick={() => setCollapsed(v => !v)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>

      {/* ── Boards ── */}
      <div className="left-nav__section">
        {!collapsed && (
          <div className="left-nav__section-label">
            <span>Boards</span>
            <button className="left-nav__new-btn" onClick={onNewBoard} title="New board">
              <PlusIcon />
            </button>
          </div>
        )}
        {collapsed && (
          <button className="left-nav__icon-btn" onClick={onNewBoard} title="New board">
            <PlusIcon />
          </button>
        )}

        <div className="left-nav__boards-list">
          {boards.map(board => (
            <div
              key={board.id}
              className={[
                'left-nav__board-wrap',
                dragOverId === board.id && dragPosition === 'before' ? 'left-nav__board-wrap--drop-before' : '',
                dragOverId === board.id && dragPosition === 'after'  ? 'left-nav__board-wrap--drop-after'  : '',
              ].filter(Boolean).join(' ')}
              draggable
              onDragStart={e => handleDragStart(e, board.id)}
              onDragOver={e => handleDragOver(e, board.id)}
              onDrop={e => handleDrop(e, board.id)}
              onDragEnd={handleDragEnd}
            >
              <button
                className={[
                  'left-nav__board-item',
                  board.id === activeBoardId ? 'left-nav__board-item--active' : '',
                  draggedId === board.id ? 'left-nav__board-item--dragging' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => onSelectBoard(board.id)}
                title={board.name}
              >
                {!collapsed && (
                  <span className="left-nav__board-drag-handle" title="Drag to reorder">
                    <GripIcon />
                  </span>
                )}
                <div className="left-nav__board-icon">
                  {board.name.charAt(0).toUpperCase()}
                </div>
                {!collapsed && (
                  <span className="left-nav__board-name">{board.name}</span>
                )}
              </button>
            </div>
          ))}

          {boards.length === 0 && !collapsed && (
            <div className="left-nav__empty-boards">No boards yet</div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="left-nav__footer">
        <button className="left-nav__footer-btn" onClick={onSettings} title="Settings">
          <GearIcon />
          {!collapsed && <span>Settings</span>}
        </button>

        <div className="left-nav__user-wrap">
          <button
            className="left-nav__user-btn"
            onClick={() => setShowUserMenu(v => !v)}
            title={displayName}
          >
            <div className="left-nav__avatar" style={{ background: user?.photoURL ? 'transparent' : avatarColor }}>
              {user?.photoURL ? <img src={user.photoURL} alt="" /> : avatarLetter}
            </div>
            {!collapsed && (
              <div className="left-nav__user-text">
                <span className="left-nav__user-name">{displayName}</span>
                <span className="left-nav__user-email">{user?.email}</span>
              </div>
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
                <button
                  className="left-nav__user-menu-item left-nav__user-menu-item--danger"
                  onClick={() => { signOutUser(); setShowUserMenu(false) }}
                >
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
      <rect width="32" height="32" rx="8" fill="#6366f1"/>
      <rect x="6" y="10" width="20" height="3" rx="1.5" fill="white"/>
      <rect x="6" y="15" width="14" height="3" rx="1.5" fill="white" opacity="0.7"/>
      <rect x="6" y="20" width="17" height="3" rx="1.5" fill="white" opacity="0.5"/>
    </svg>
  )
}
const ChevronLeft = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
const ChevronRight= () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
const PlusIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const GearIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
const GripIcon    = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
    <circle cx="4" cy="3" r="1"/><circle cx="8" cy="3" r="1"/>
    <circle cx="4" cy="6" r="1"/><circle cx="8" cy="6" r="1"/>
    <circle cx="4" cy="9" r="1"/><circle cx="8" cy="9" r="1"/>
  </svg>
)
