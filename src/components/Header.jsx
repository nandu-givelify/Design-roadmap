import { useState } from 'react'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import MenuIcon from '@mui/icons-material/Menu'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import TodayIcon from '@mui/icons-material/Today'
import FilterListIcon from '@mui/icons-material/FilterList'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import { getAvatarColor } from '../utils/dateUtils'

export default function Header({
  board, viewMode, setViewMode,
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
    setFilterPersonIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const activeFilters = filterPersonIds.length
  const navLabel = viewMode === 'year' ? `${year}` : `Q${quarter} ${year}`

  const uniqueRoles = [...new Set(people.map(p => p.role).filter(Boolean))]
  const groupOptions = ['none', ...uniqueRoles]

  return (
    <header className="header">
      {/* ── Row 1: hamburger + board title + settings ── */}
      {navCollapsed && (
        <Tooltip title="Open navigation" placement="bottom">
          <IconButton className="header__hamburger" onClick={onOpenNav} size="small">
            <MenuIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Board title — fills available space */}
      <Box className="header__board-area" sx={{ flex: 1, minWidth: 0 }}>
        {renaming ? (
          <Box component="span" sx={{ position: 'relative', display: 'inline-block' }}>
            <span className="header__board-title" style={{ visibility: 'hidden', display: 'inline-block', minWidth: 80 }} aria-hidden>
              {renameVal || ' '}
            </span>
            <input
              className="header__board-rename-input"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%' }}
              value={renameVal}
              onChange={e => setRenameVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setRenaming(false) }}
              onBlur={handleRenameSubmit}
              autoFocus
            />
          </Box>
        ) : (
          <span
            className="header__board-title"
            onClick={() => { if (!readOnly) { setRenameVal(boardName); setRenaming(true) } }}
            title={readOnly ? undefined : 'Click to rename'}
            style={{ cursor: readOnly ? 'default' : 'text' }}
          >{boardName}</span>
        )}
      </Box>

      {/* Settings icon — at top level so it sits at end of row 1 on mobile */}
      {!readOnly && !renaming && onSettings && (
        <Tooltip title="Board settings" placement="bottom">
          <IconButton className="header__board-dots" onClick={onSettings} size="small">
            <SettingsOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* ── Row 2: today + period nav (centered) + filter ── */}
      <Box className="header__controls">
        {/* Today */}
        <Tooltip title="Jump to today" placement="bottom">
          <IconButton className="header__today-btn" onClick={onJumpToday} size="small">
            <TodayIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Period navigation */}
        <Box className="header__nav">
          <IconButton className="header__nav-arrow" onClick={goPrev} size="small">
            <ChevronLeftIcon fontSize="small" />
          </IconButton>

          <Box sx={{ position: 'relative' }}>
            <Button
              className="header__nav-label header__nav-label--clickable"
              onClick={() => setShowViewPicker(v => !v)}
              endIcon={<KeyboardArrowDownIcon />}
              size="small"
              sx={{ fontWeight: 600, color: 'text.primary', textTransform: 'none', px: 1 }}
            >
              {navLabel}
            </Button>
            {showViewPicker && (
              <>
                <Box sx={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setShowViewPicker(false)} />
                <Box className="header__dropdown" sx={{ minWidth: 120, left: '50%', right: 'auto', transform: 'translateX(-50%)' }}>
                  {['quarter', 'year'].map(m => (
                    <button
                      key={m}
                      className={`header__dropdown-item${viewMode === m ? ' header__dropdown-item--active' : ''}`}
                      onClick={() => { setViewMode(m); setShowViewPicker(false) }}
                    >
                      {m === 'quarter' ? 'Quarter' : 'Year'}
                    </button>
                  ))}
                </Box>
              </>
            )}
          </Box>

          <IconButton className="header__nav-arrow" onClick={goNext} size="small">
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Filter */}
        <Box sx={{ position: 'relative' }}>
          <Tooltip title="Filter" placement="bottom">
            <IconButton
              className={`header__filter-btn${activeFilters > 0 ? ' header__filter-btn--active' : ''}`}
              onClick={() => setShowFilters(v => !v)}
              size="small"
            >
              <FilterListIcon fontSize="small" />
              {activeFilters > 0 && <span className="header__filter-count">{activeFilters}</span>}
            </IconButton>
          </Tooltip>

          {showFilters && (
            <>
              <Box sx={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setShowFilters(false)} />
              <Box className="header__filter-popover">
                {/* Group by */}
                <Typography variant="subtitle2" className="header__filter-section-title">Group by</Typography>
                {groupOptions.map(opt => (
                  <label key={opt} className="filter-row" style={{ cursor: 'pointer' }}>
                    <input type="radio" name="groupby" checked={groupBy === opt} onChange={() => setGroupBy(opt)} style={{ accentColor: '#111827' }} />
                    <span className="filter-row__label">{opt === 'none' ? 'None' : opt}</span>
                  </label>
                ))}

                <Box className="header__filter-divider" />

                {/* People */}
                <Typography variant="subtitle2" className="header__filter-section-title">People</Typography>
                {(() => {
                  const roleOrder = []
                  const byRole = {}
                  people.forEach(p => {
                    const role = p.role || '__other__'
                    if (!byRole[role]) { byRole[role] = []; roleOrder.push(role) }
                    byRole[role].push(p)
                  })
                  const orderedRoles = roleOrder.filter(r => r !== '__other__')
                  if (byRole['__other__']) orderedRoles.push('__other__')
                  return orderedRoles.map((role, roleIdx) => (
                    <Box key={role}>
                      <Typography variant="subtitle2" className="header__filter-section-title" sx={roleIdx > 0 ? { mt: 1 } : {}}>
                        {role === '__other__' ? 'Other' : role}
                      </Typography>
                      {byRole[role].map(p => (
                        <label key={p.id} className="filter-row">
                          <input type="checkbox" checked={filterPersonIds.includes(p.id)} onChange={() => togglePerson(p.id)} />
                          <Box className="filter-row__avatar" style={{ background: getAvatarColor(p.name) }}>
                            {p.photo
                              ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : p.name?.charAt(0)
                            }
                          </Box>
                          <span className="filter-row__label">{p.name}</span>
                        </label>
                      ))}
                    </Box>
                  ))
                })()}
                {people.length === 0 && <Typography variant="caption" color="text.secondary">No people yet.</Typography>}
                {activeFilters > 0 && (
                  <Button
                    size="small" color="primary" onClick={() => setFilterPersonIds([])}
                    sx={{ mt: 1, width: '100%', fontSize: 12 }}
                  >
                    Clear filters
                  </Button>
                )}
              </Box>
            </>
          )}
        </Box>
      </Box>

      {readOnly && <Box className="header__readonly-badge">View only</Box>}
    </header>
  )
}
