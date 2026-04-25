import { useState } from 'react'
import { getAvatarColor } from '../utils/dateUtils'

export default function Header({
  boardName,
  viewMode, setViewMode,
  year, setYear,
  quarter, setQuarter,
  onJumpToday,
  onShare,
  people,
  filterPersonIds, setFilterPersonIds,
  groupBy, setGroupBy,
  roles,
  readOnly,
}) {
  const [showFilters, setShowFilters] = useState(false)
  const [showGroup,   setShowGroup]   = useState(false)

  const navPrev = () => {
    if (viewMode === 'year') setYear((y) => y - 1)
    else if (quarter === 1) { setYear((y) => y - 1); setQuarter(4) }
    else setQuarter((q) => q - 1)
  }
  const navNext = () => {
    if (viewMode === 'year') setYear((y) => y + 1)
    else if (quarter === 4) { setYear((y) => y + 1); setQuarter(1) }
    else setQuarter((q) => q + 1)
  }

  const togglePerson = (id) =>
    setFilterPersonIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])

  const activeFilters = filterPersonIds.length
  const navLabel = viewMode === 'year' ? `${year}` : `Q${quarter} ${year}`

  const groupLabel = groupBy === 'none' ? 'No grouping' : `By ${groupBy}`

  const groupOptions = ['none', ...(roles || ['Designer', 'PM', 'Dev'])]

  return (
    <header className="header">
      {/* Board title */}
      <span className="header__board-title">{boardName}</span>

      <div className="header__spacer" />

      {/* Group by */}
      <div style={{ position: 'relative' }}>
        <button
          className={`header__group-btn${groupBy !== 'none' ? ' header__group-btn--active' : ''}`}
          onClick={() => setShowGroup((v) => !v)}
        >
          <GroupIcon />
          {groupLabel}
        </button>
        {showGroup && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setShowGroup(false)} />
            <div className="header__dropdown">
              {groupOptions.map((opt) => (
                <button
                  key={opt}
                  className={`header__dropdown-item${groupBy === opt ? ' header__dropdown-item--active' : ''}`}
                  onClick={() => { setGroupBy(opt); setShowGroup(false) }}
                >
                  {opt === 'none' ? 'No grouping' : `By ${opt}`}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="header__divider" />

      {/* View toggle */}
      <div className="header__view-toggle">
        {['year', 'quarter'].map((m) => (
          <button
            key={m}
            className={`header__view-btn${viewMode === m ? ' header__view-btn--active' : ''}`}
            onClick={() => setViewMode(m)}
          >
            {m === 'year' ? 'Year' : 'Quarter'}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="header__nav">
        <button className="header__nav-arrow" onClick={navPrev}>‹</button>
        <span className="header__nav-label">{navLabel}</span>
        <button className="header__nav-arrow" onClick={navNext}>›</button>
      </div>

      {/* Today */}
      <button className="header__today-btn" onClick={onJumpToday}>Today</button>

      {/* Filter */}
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

      {/* Share */}
      <button className="header__share-btn" onClick={onShare}>Share</button>

      {readOnly && <div className="header__readonly-badge">View only</div>}
    </header>
  )
}

function GroupIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 5, flexShrink: 0 }}>
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  )
}
