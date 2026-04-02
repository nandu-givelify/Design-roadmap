import { useState } from 'react'

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

export default function Header({
  viewMode, setViewMode,
  year, setYear,
  quarter, setQuarter,
  onJumpToday,
  onAddTask,
  onAddPerson,
  onAddTeam,
  onShare,
  people, teams,
  filterPersonIds, setFilterPersonIds,
  filterTeamIds, setFilterTeamIds,
  readOnly,
}) {
  const [showFilters, setShowFilters] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)

  const togglePerson = (id) =>
    setFilterPersonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  const toggleTeam = (id) =>
    setFilterTeamIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )

  const navPrev = () => {
    if (viewMode === 'year') {
      setYear((y) => y - 1)
    } else {
      if (quarter === 1) { setYear((y) => y - 1); setQuarter(4) }
      else setQuarter((q) => q - 1)
    }
  }
  const navNext = () => {
    if (viewMode === 'year') {
      setYear((y) => y + 1)
    } else {
      if (quarter === 4) { setYear((y) => y + 1); setQuarter(1) }
      else setQuarter((q) => q + 1)
    }
  }

  const navLabel = viewMode === 'year'
    ? `${year}`
    : `Q${quarter} ${year}`

  const activeFilters = filterPersonIds.length + filterTeamIds.length

  return (
    <div style={{
      background: '#fff',
      borderBottom: '1px solid #e5e7eb',
      padding: '0 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      height: 56,
      flexShrink: 0,
      position: 'relative',
      zIndex: 40,
    }}>
      {/* App title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
        }}>🗓</div>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Design Roadmap</span>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 24, background: '#e5e7eb' }}/>

      {/* View mode toggle */}
      <div style={{
        display: 'flex', background: '#f3f4f6', borderRadius: 7,
        padding: 2, gap: 2,
      }}>
        {['year', 'quarter'].map((m) => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            style={{
              padding: '4px 12px', borderRadius: 5, border: 'none',
              background: viewMode === m ? '#fff' : 'transparent',
              boxShadow: viewMode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontSize: 12, fontWeight: 600,
              color: viewMode === m ? '#111827' : '#6b7280',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {m === 'year' ? 'Year' : 'Quarter'}
          </button>
        ))}
      </div>

      {/* Nav: prev / label / next */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button onClick={navPrev} style={navBtnStyle}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', minWidth: 70, textAlign: 'center' }}>
          {navLabel}
        </span>
        <button onClick={navNext} style={navBtnStyle}>›</button>
      </div>

      {/* Today */}
      <button onClick={onJumpToday} style={pillBtn}>
        Today
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }}/>

      {/* Filter */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowFilters((v) => !v)}
          style={{
            ...pillBtn,
            background: activeFilters > 0 ? '#ede9fe' : '#f9fafb',
            color: activeFilters > 0 ? '#6366f1' : '#374151',
            border: `1px solid ${activeFilters > 0 ? '#c4b5fd' : '#e5e7eb'}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span>⊞</span>
          <span>Filter{activeFilters > 0 ? ` (${activeFilters})` : ''}</span>
        </button>
        {showFilters && (
          <div
            style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6,
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              minWidth: 220, zIndex: 200, padding: 12,
            }}
          >
            {teams.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6, letterSpacing: '0.05em' }}>TEAMS</div>
                {teams.map((t) => (
                  <FilterRow
                    key={t.id}
                    label={t.name}
                    photo={t.photo}
                    checked={filterTeamIds.includes(t.id)}
                    onChange={() => toggleTeam(t.id)}
                  />
                ))}
                <div style={{ height: 1, background: '#f3f4f6', margin: '8px 0' }}/>
              </>
            )}
            {people.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6, letterSpacing: '0.05em' }}>PEOPLE</div>
                {people.map((p) => (
                  <FilterRow
                    key={p.id}
                    label={p.name}
                    photo={p.photo}
                    initials={p.name?.charAt(0)}
                    color={p.color}
                    checked={filterPersonIds.includes(p.id)}
                    onChange={() => togglePerson(p.id)}
                  />
                ))}
              </>
            )}
            {activeFilters > 0 && (
              <button
                onClick={() => { setFilterPersonIds([]); setFilterTeamIds([]) }}
                style={{
                  marginTop: 8, background: 'none', border: 'none',
                  fontSize: 12, color: '#6366f1', cursor: 'pointer', padding: 0,
                }}
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Share */}
      <button onClick={onShare} style={{ ...pillBtn, border: '1px solid #e5e7eb' }}>
        Share
      </button>

      {/* Add menu */}
      {!readOnly && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAddMenu((v) => !v)}
            style={{
              background: '#6366f1', color: '#fff', border: 'none',
              padding: '7px 14px', borderRadius: 7,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            + Add
          </button>
          {showAddMenu && (
            <div
              style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6,
                background: '#fff', border: '1px solid #e5e7eb',
                borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                minWidth: 160, zIndex: 200, overflow: 'hidden',
              }}
              onMouseLeave={() => setShowAddMenu(false)}
            >
              {[
                { label: '+ Task', action: onAddTask },
                { label: '+ Person', action: onAddPerson },
                { label: '+ Team', action: onAddTeam },
              ].map(({ label, action }) => (
                <button
                  key={label}
                  onClick={() => { action(); setShowAddMenu(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 14px', border: 'none', background: 'none',
                    fontSize: 13, color: '#111827', cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {readOnly && (
        <div style={{
          background: '#fef3c7', color: '#92400e',
          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
        }}>
          View only
        </div>
      )}

      {/* Close filter dropdown when clicking outside */}
      {showFilters && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100 }}
          onClick={() => setShowFilters(false)}
        />
      )}
    </div>
  )
}

const navBtnStyle = {
  background: 'none', border: '1px solid #e5e7eb',
  borderRadius: 6, width: 28, height: 28,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', fontSize: 16, color: '#374151',
}

const pillBtn = {
  background: '#f9fafb', border: '1px solid #e5e7eb',
  borderRadius: 7, padding: '6px 12px',
  fontSize: 12, fontWeight: 500, color: '#374151',
  cursor: 'pointer',
}

function FilterRow({ label, photo, initials, color, checked, onChange }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 2px', cursor: 'pointer',
    }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor: '#6366f1' }}/>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: color || '#e5e7eb',
        overflow: 'hidden', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color: '#fff',
      }}>
        {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : initials}
      </div>
      <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>
    </label>
  )
}
