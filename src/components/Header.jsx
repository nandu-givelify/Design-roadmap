import { useState } from 'react'
import { getAvatarColor } from '../utils/dateUtils'

export default function Header({
  viewMode, setViewMode,
  year, setYear,
  quarter, setQuarter,
  onJumpToday,
  onAddTask,
  onShare,
  onSettings,
  people, teams,
  filterPersonIds, setFilterPersonIds,
  filterTeamIds, setFilterTeamIds,
  readOnly,
}) {
  const [showFilters, setShowFilters] = useState(false)

  const navPrev = () => {
    if (viewMode === 'year') { setYear((y) => y - 1) }
    else if (quarter === 1) { setYear((y) => y - 1); setQuarter(4) }
    else setQuarter((q) => q - 1)
  }
  const navNext = () => {
    if (viewMode === 'year') { setYear((y) => y + 1) }
    else if (quarter === 4) { setYear((y) => y + 1); setQuarter(1) }
    else setQuarter((q) => q + 1)
  }

  const togglePerson = (id) =>
    setFilterPersonIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])
  const toggleTeam = (id) =>
    setFilterTeamIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])

  const activeFilters = filterPersonIds.length + filterTeamIds.length
  const navLabel = viewMode === 'year' ? `${year}` : `Q${quarter} ${year}`

  return (
    <header className="header">
      {/* Brand + Add */}
      <div className="header__brand">
        <span className="header__title">Design Roadmap</span>
        {!readOnly && (
          <button className="header__add-btn" onClick={onAddTask}>+ Add Task</button>
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

      <div className="header__spacer" />

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
              {teams.length > 0 && (
                <>
                  <div className="header__filter-section-title">PMs</div>
                  {teams.map((t) => (
                    <label key={t.id} className="filter-row">
                      <input type="checkbox" checked={filterTeamIds.includes(t.id)} onChange={() => toggleTeam(t.id)} />
                      <div className="filter-row__avatar filter-row__avatar--team" style={{ background: '#6366f1' }}>
                        {t.photo ? <img src={t.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : t.name?.charAt(0)}
                      </div>
                      <span className="filter-row__label">{t.name}</span>
                    </label>
                  ))}
                  <div className="header__filter-divider" />
                </>
              )}
              {people.length > 0 && (
                <>
                  <div className="header__filter-section-title">People</div>
                  {people.map((p) => (
                    <label key={p.id} className="filter-row">
                      <input type="checkbox" checked={filterPersonIds.includes(p.id)} onChange={() => togglePerson(p.id)} />
                      <div className="filter-row__avatar" style={{ background: p.color || getAvatarColor(p.name) }}>
                        {p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name?.charAt(0)}
                      </div>
                      <span className="filter-row__label">{p.name}</span>
                    </label>
                  ))}
                </>
              )}
              {activeFilters > 0 && (
                <button className="header__filter-clear" onClick={() => { setFilterPersonIds([]); setFilterTeamIds([]) }}>
                  Clear all filters
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Share */}
      <button className="header__share-btn" onClick={onShare}>Share</button>

      {/* Settings */}
      {!readOnly && (
        <button className="header__settings-btn" onClick={onSettings}>Settings</button>
      )}

      {readOnly && <div className="header__readonly-badge">View only</div>}
    </header>
  )
}
