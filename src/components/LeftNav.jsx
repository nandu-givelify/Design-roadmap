import { useState, useRef, useEffect } from 'react'
import { signOutUser } from '../firebase'
import { getAvatarColor } from '../utils/dateUtils'

export default function LeftNav({
  user, boards, activeBoardId,
  onSelectBoard, onNewBoard, onSettings,
  onRenameBoard, onDeleteBoard, onShareBoard,
}) {
  const [collapsed,    setCollapsed]    = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const displayName  = user?.displayName || user?.email?.split('@')[0] || 'You'
  const avatarLetter = displayName.charAt(0).toUpperCase()
  const avatarColor  = getAvatarColor(user?.email || displayName)

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
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
            <BoardItem
              key={board.id}
              board={board}
              active={board.id === activeBoardId}
              collapsed={collapsed}
              onSelect={() => onSelectBoard(board.id)}
              onRename={(name) => onRenameBoard(board.id, name)}
              onDelete={() => onDeleteBoard(board.id)}
              onShare={() => onShareBoard(board.id)}
            />
          ))}
          {boards.length === 0 && !collapsed && (
            <div className="left-nav__empty-boards">No boards yet</div>
          )}
        </div>
      </div>

      {/* ── Bottom ── */}
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

// ── Individual board item with 3-dot menu ─────────────────────────────────────
function BoardItem({ board, active, collapsed, onSelect, onRename, onDelete, onShare }) {
  const [showMenu,   setShowMenu]   = useState(false)
  const [renaming,   setRenaming]   = useState(false)
  const [nameValue,  setNameValue]  = useState(board.name)
  const inputRef = useRef(null)
  const menuRef  = useRef(null)

  useEffect(() => { if (renaming) inputRef.current?.select() }, [renaming])

  useEffect(() => {
    if (!showMenu) return
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  const handleRenameSubmit = () => {
    const name = nameValue.trim()
    if (name && name !== board.name) onRename(name)
    setRenaming(false)
  }

  const boardLetter = board.name.charAt(0).toUpperCase()

  if (collapsed) {
    return (
      <button
        className={`left-nav__board-icon-btn${active ? ' left-nav__board-icon-btn--active' : ''}`}
        onClick={onSelect}
        title={board.name}
      >
        <div className="left-nav__board-icon">{boardLetter}</div>
      </button>
    )
  }

  return (
    <div className={`left-nav__board-item${active ? ' left-nav__board-item--active' : ''}`}>
      {renaming ? (
        <div className="left-nav__board-rename">
          <input
            ref={inputRef}
            className="left-nav__board-rename-input"
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRenameSubmit()
              if (e.key === 'Escape') setRenaming(false)
            }}
            onBlur={handleRenameSubmit}
          />
        </div>
      ) : (
        <>
          <button className="left-nav__board-row" onClick={onSelect}>
            <div className="left-nav__board-icon">{boardLetter}</div>
            <span className="left-nav__board-name">{board.name}</span>
          </button>

          <div className="left-nav__board-menu-wrap" ref={menuRef}>
            <button
              className="left-nav__board-dots"
              onClick={e => { e.stopPropagation(); setShowMenu(v => !v) }}
              title="Board options"
            >
              <DotsIcon />
            </button>

            {showMenu && (
              <div className="left-nav__board-dropdown">
                <button className="left-nav__board-dropdown-item" onClick={() => { setRenaming(true); setNameValue(board.name); setShowMenu(false) }}>
                  Rename
                </button>
                <button className="left-nav__board-dropdown-item" onClick={() => { onShare(); setShowMenu(false) }}>
                  Copy link
                </button>
                <div className="left-nav__board-dropdown-divider" />
                <button
                  className="left-nav__board-dropdown-item left-nav__board-dropdown-item--danger"
                  onClick={() => {
                    if (window.confirm(`Delete "${board.name}"? This cannot be undone.`)) onDelete()
                    setShowMenu(false)
                  }}
                >
                  Delete board
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function NavLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" flexShrink="0">
      <rect width="32" height="32" rx="8" fill="#6366f1"/>
      <rect x="6" y="10" width="20" height="3" rx="1.5" fill="white"/>
      <rect x="6" y="15" width="14" height="3" rx="1.5" fill="white" opacity="0.7"/>
      <rect x="6" y="20" width="17" height="3" rx="1.5" fill="white" opacity="0.5"/>
    </svg>
  )
}
const ChevronLeft  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
const ChevronRight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
const PlusIcon     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const GearIcon     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
const DotsIcon     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
