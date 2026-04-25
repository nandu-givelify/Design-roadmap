import { useState } from 'react'
import { signOutUser } from '../firebase'
import { getAvatarColor } from '../utils/dateUtils'

export default function LeftNav({
  user, boards, activeBoardId, onSelectBoard,
  onNewBoard, onSettings,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'You'
  const avatarLetter = displayName.charAt(0).toUpperCase()
  const avatarColor = getAvatarColor(user?.email || displayName)

  return (
    <nav className={`left-nav${collapsed ? ' left-nav--collapsed' : ''}`}>
      {/* Top: logo + collapse toggle */}
      <div className="left-nav__top">
        {!collapsed && (
          <div className="left-nav__logo">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#6366f1"/>
              <rect x="6" y="10" width="20" height="3" rx="1.5" fill="white"/>
              <rect x="6" y="15" width="14" height="3" rx="1.5" fill="white" opacity="0.7"/>
              <rect x="6" y="20" width="17" height="3" rx="1.5" fill="white" opacity="0.5"/>
            </svg>
            <span className="left-nav__logo-text">RoadMap</span>
          </div>
        )}
        {collapsed && (
          <div className="left-nav__logo left-nav__logo--icon-only">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#6366f1"/>
              <rect x="6" y="10" width="20" height="3" rx="1.5" fill="white"/>
              <rect x="6" y="15" width="14" height="3" rx="1.5" fill="white" opacity="0.7"/>
              <rect x="6" y="20" width="17" height="3" rx="1.5" fill="white" opacity="0.5"/>
            </svg>
          </div>
        )}
        <button
          className="left-nav__collapse-btn"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Boards section */}
      <div className="left-nav__section">
        {!collapsed && (
          <div className="left-nav__section-header">
            <span className="left-nav__section-label">Boards</span>
            <button className="left-nav__add-btn" onClick={onNewBoard} title="New board">+</button>
          </div>
        )}
        {collapsed && (
          <button className="left-nav__add-btn left-nav__add-btn--centered" onClick={onNewBoard} title="New board">+</button>
        )}

        <div className="left-nav__boards">
          {boards.map((board) => (
            <button
              key={board.id}
              className={`left-nav__board-item${board.id === activeBoardId ? ' left-nav__board-item--active' : ''}`}
              onClick={() => onSelectBoard(board.id)}
              title={board.name}
            >
              <div className="left-nav__board-icon">
                {board.name.charAt(0).toUpperCase()}
              </div>
              {!collapsed && <span className="left-nav__board-name">{board.name}</span>}
            </button>
          ))}
          {boards.length === 0 && !collapsed && (
            <div className="left-nav__empty">No boards yet</div>
          )}
        </div>
      </div>

      {/* Bottom: Settings + user */}
      <div className="left-nav__bottom">
        <button
          className="left-nav__settings-btn"
          onClick={onSettings}
          title="Settings"
        >
          <SettingsIcon />
          {!collapsed && <span>Settings</span>}
        </button>

        {/* User avatar + menu */}
        <div className="left-nav__user-wrap" style={{ position: 'relative' }}>
          <button
            className="left-nav__user-btn"
            onClick={() => setShowUserMenu((v) => !v)}
            title={displayName}
          >
            <div
              className="left-nav__user-avatar"
              style={{ background: user?.photoURL ? 'transparent' : avatarColor }}
            >
              {user?.photoURL
                ? <img src={user.photoURL} alt="" />
                : avatarLetter
              }
            </div>
            {!collapsed && (
              <div className="left-nav__user-info">
                <span className="left-nav__user-name">{displayName}</span>
                <span className="left-nav__user-email">{user?.email}</span>
              </div>
            )}
          </button>

          {showUserMenu && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 300 }}
                onClick={() => setShowUserMenu(false)}
              />
              <div className="left-nav__user-menu">
                <div className="left-nav__user-menu-name">{displayName}</div>
                <div className="left-nav__user-menu-email">{user?.email}</div>
                <div className="left-nav__user-menu-divider" />
                <button
                  className="left-nav__user-menu-item"
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

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}
