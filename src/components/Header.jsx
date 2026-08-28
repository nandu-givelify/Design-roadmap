import { useState, useRef, useEffect } from 'react'
import { getAvatarColor } from '../utils/dateUtils'

export default function Header({
  board,
  viewMode, setViewMode,
  year, setYear,
  quarter, setQuarter,
  onJumpToday,
  onShare,
  onSettings,
  onRenameBoard,
  onDeleteBoard,
  people,
  filterPersonIds, setFilterPersonIds,
  groupBy, setGroupBy,
  roles,
  readOnly,
  navCollapsed,
  onOpenNav,
}) {
  const [showFilters,    setShowFilters]    = useState(false)
  const [showViewPicker, setShowViewPicker] = useState(false)
  const [renaming,       setRenaming]       = useState(false)
  const [renameVal,      setRenameVal]      = useState('')
  const renameInputRef = useRef(null)

  useEffect(() => { if (renaming) renameInputRef.current?.select() }, [renaming])

  const handleRenameSubmit = () => {
    const name = renameVal.trim()
    if (name && name !== board?.name) onRenameBoard?.(board.id, name)
    setRenaming(false)
  }

  const boardName = board?.name || ''

  const goPrev = () => {
    if (viewMode === 'year') { setYear(y => y - 1) }
    else {
      if (quarter === 1) { setYear(y => y - 1); setQuarter(4) }
      else setQuarter(q => q - 1)
    }
  }
  const goNext = () => {
    if (viewMode === 'year') { setYear(y => y + 1) }
    else {
      if (quarter === 4) { setYear(y => y + 1); setQuarter(1) }
      else setQuarter(q => q + 1)
    }
  }

  const togglePerson = (id) =>
    setFilterPersonIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])

  const activeFilters = filterPersonIds.length
  const navLabel = viewMode === 'year' ? `${year}` : `Q${quarter} ${year}`

  // Derive unique roles from people for group-by options
  const uniqueRoles = [...new Set(people.map(p => p.role).filter(Boolean))]
  const groupOptions = ['none', ...uniqueRoles]

  return (
    <header className="header">
      {/* Hamburger — only when nav is hidden */}
      {navCollapsed && (
        <button className="header__hamburger" onClick={onOpenNav} title="Open navigation">
          <MenuIcon />
        </button>
      )}

      {/* Board title + settings gear */}
      <div className="header__board-area">
        {renaming ? (
          <input
            ref={renameInputRef}
            className="header__board-rename-input"
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setRenaming(false) }}
            onBlur={handleRenameSubmit}
          />
        ) : (
          <span
            className="header__board-title"
            onDoubleClick={() => { if (!readOnly) { setRenameVal(boardName); setRenaming(true) } }}
            title="Double-click to rename"
          >{boardName}</span>
        )}

        {!readOnly && !renaming && onSettings && (
          <button className="header__board-dots" onClick={onSettings} title="Board settings" style={{ marginRight: 2 }}>
            <ChevronRightIcon />
          </button>
        )}
      </div>

      <div className="header__spacer" />

      {/* Today */}
      <button className="header__today-btn" onClick={onJumpToday}>Today</button>

      {/* Period navigation */}
      <div className="header__nav">
        <button className="header__nav-arrow" onClick={goPrev}><NavChevronLeft /></button>

        {/* Clickable period label → view mode picker dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className="header__nav-label header__nav-label--clickable"
            onClick={() => setShowViewPicker(v => !v)}
            title="Switch view"
          >{navLabel} <ArrowDropDownIcon /></button>
          {showViewPicker && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setShowViewPicker(false)} />
              <div className="header__dropdown" style={{ minWidth: 120, left: '50%', right: 'auto', transform: 'translateX(-50%)' }}>
                {['quarter', 'year'].map((m) => (
                  <button
                    key={m}
                    className={`header__dropdown-item${viewMode === m ? ' header__dropdown-item--active' : ''}`}
                    onClick={() => { setViewMode(m); setShowViewPicker(false) }}
                  >
                    {m === 'quarter' ? 'Quarter' : 'Year'}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button className="header__nav-arrow" onClick={goNext}><NavChevronRight /></button>
      </div>

      {/* Filter (with group-by at top) */}
      <div style={{ position: 'relative' }}>
        <button
          className={`header__filter-btn${activeFilters > 0 ? ' header__filter-btn--active' : ''}`}
          onClick={() => setShowFilters((v) => !v)}
        >
          Filter{activeFilters > 0 ? ` (${activeFilters})` : ''}
        </button>

        {showFilters && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setShowFilters(false)} />
            <div className="header__filter-popover">
              {/* Group by section */}
              <div className="header__filter-section-title">Group by</div>
              {groupOptions.map((opt) => (
                <label key={opt} className="filter-row" style={{ cursor: 'pointer' }}>
                  <input type="radio" name="groupby" checked={groupBy === opt} onChange={() => setGroupBy(opt)} style={{ accentColor: '#111827' }} />
                  <span className="filter-row__label">{opt === 'none' ? 'None' : opt}</span>
                </label>
              ))}

              <div className="header__filter-divider" />

              {/* People filter */}
              <div className="header__filter-section-title">People</div>
              {people.map((p) => (
                <label key={p.id} className="filter-row">
                  <input type="checkbox" checked={filterPersonIds.includes(p.id)} onChange={() => togglePerson(p.id)} />
                  <div
                    className="filter-row__avatar"
                    style={{ background: p.color || getAvatarColor(p.name) }}
                  >
                    {p.photo
                      ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : p.name?.charAt(0)
                    }
                  </div>
                  <span className="filter-row__label">
                    {p.name}
                    {p.role && <span style={{ color: '#9ca3af', marginLeft: 4, fontSize: 11 }}>· {p.role}</span>}
                  </span>
                </label>
              ))}
              {people.length === 0 && <div style={{ fontSize: 12, color: '#9ca3af' }}>No people yet.</div>}
              {activeFilters > 0 && (
                <button className="header__filter-clear" onClick={() => setFilterPersonIds([])}>
                  Clear filters
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {readOnly && <div className="header__readonly-badge">View only</div>}
    </header>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
    </svg>
  )
}

function NavChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
    </svg>
  )
}

function NavChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
    </svg>
  )
}

function ArrowDropDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ verticalAlign: 'middle', opacity: 0.7 }}>
      <path d="M7 10l5 5 5-5z"/>
    </svg>
  )
}
