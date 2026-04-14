import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import {
  getDaysInRange, groupDaysByMonth, isWeekend, startOfDay, diffDays,
  getTotalRange, getYearRange, getQuarterRange,
  MONTHS_SHORT, getQuarterForMonth,
  getAvatarColor, addDays, toDateString, nextWorkday, VIEW_PAD_DAYS, formatDateWithDay, parseLocalDate,
} from '../utils/dateUtils'
import TaskBar from './TaskBar'

// ── Layout constants ────────────────────────────────────────────────────────
const PERSON_COL_W = 200
const LANE_H       = 34
const LANE_GAP     = 6
const ROW_PAD_TOP  = 10
const ROW_PAD_BOT  = 10
const MIN_ROW_H    = ROW_PAD_TOP + LANE_H + ROW_PAD_BOT

// View shows this many days — includes 7-day buffer on each side
const VIEW_DAYS_YEAR    = 365 + VIEW_PAD_DAYS * 2  // 379
const VIEW_DAYS_QUARTER = 91  + VIEW_PAD_DAYS * 2  // 105

const snapWeekday = (date, forward = true) => {
  const d = new Date(date)
  if (!isWeekend(d)) return d
  return forward ? nextWorkday(d) : (() => { while (isWeekend(d)) d.setDate(d.getDate() - 1); return d })()
}

const Timeline = forwardRef(function Timeline({
  viewMode, year, quarter,
  people, teams, tasks,
  filterPersonIds, filterTeamIds,
  onUpdateTask, onDeleteTask, onAddTaskForPerson, onEditTask,
  readOnly,
}, ref) {
  const scrollRef    = useRef(null)
  const containerRef = useRef(null)
  const rowRefsMap   = useRef({})

  const [containerW, setContainerW] = useState(0)
  const [activeDrag, setActiveDrag] = useState(null) // floating clone drag state
  const [scrollLeft, setScrollLeft] = useState(0)
  const [zoomScale, setZoomScale]   = useState(1.0)  // pinch-to-zoom multiplier
  const zoomScaleRef = useRef(1.0)                   // sync ref for wheel handler

  // ── Multi-select state ────────────────────────────────────────────────────
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set())
  const [selectionBox, setSelectionBox]       = useState(null) // {startX,startY,curX,curY} viewport
  const [bulkAssignOpen, setBulkAssignOpen]   = useState(null) // 'person' | 'pm' | null

  const totalRange = getTotalRange(year)
  const totalStart = totalRange.start
  const totalEnd   = totalRange.end
  const allDays    = getDaysInRange(totalStart, totalEnd)

  const baseViewDays = viewMode === 'year' ? VIEW_DAYS_YEAR : VIEW_DAYS_QUARTER
  // zoomScale > 1 = zoomed in (fewer days visible); < 1 = zoomed out (more days)
  const viewDays = Math.max(7, baseViewDays / zoomScale)
  const dayWidth = containerW > 0 ? (containerW - PERSON_COL_W) / viewDays : 0
  const totalW   = dayWidth * allDays.length

  // ── Container width tracking ──────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => {
      const w = containerRef.current?.clientWidth || 0
      setContainerW(w)
      if (scrollRef.current) {
        scrollRef.current.style.setProperty('--cw', (w - PERSON_COL_W) + 'px')
      }
    })
    ro.observe(containerRef.current)
    setContainerW(containerRef.current.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Scroll listener (rAF-throttled React state)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let rafId
    const handler = () => {
      el.style.setProperty('--sl', el.scrollLeft + 'px')
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => setScrollLeft(el.scrollLeft))
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => { el.removeEventListener('scroll', handler); cancelAnimationFrame(rafId) }
  }, [])

  // Pinch-to-zoom: trackpad pinch generates ctrl+wheel events in browsers
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onWheel = (e) => {
      if (!e.ctrlKey) return   // regular scroll — let it pass through
      e.preventDefault()       // stop browser page-zoom

      const rect = el.getBoundingClientRect()
      const cursorXInGrid = e.clientX - rect.left - PERSON_COL_W
      if (cursorXInGrid < 0) return  // cursor over person column — ignore

      // Capture current geometry before changing scale
      const baseVD   = viewMode === 'year' ? VIEW_DAYS_YEAR : VIEW_DAYS_QUARTER
      const curVD    = Math.max(7, baseVD / zoomScaleRef.current)
      const oldDayW  = (el.clientWidth - PERSON_COL_W) / curVD
      // Which day is currently under the cursor?
      const cursorDay = (el.scrollLeft + cursorXInGrid) / oldDayW

      // Compute new scale (exponential so feel is consistent at all zoom levels)
      const factor   = Math.exp(-e.deltaY / 120)
      const newScale = Math.max(0.1, Math.min(15, zoomScaleRef.current * factor))
      zoomScaleRef.current = newScale

      // Recompute dayWidth at new scale and restore the cursor day to same position
      const newVD      = Math.max(7, baseVD / newScale)
      const newDayW    = (el.clientWidth - PERSON_COL_W) / newVD
      el.scrollLeft    = Math.max(0, cursorDay * newDayW - cursorXInGrid)

      setZoomScale(newScale)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [viewMode]) // eslint-disable-line

  // Escape key clears selection
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { setSelectedTaskIds(new Set()); setBulkAssignOpen(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Scroll helpers ────────────────────────────────────────────────────────
  const dateToGridX = useCallback((date) =>
    diffDays(startOfDay(totalStart), startOfDay(parseLocalDate(date))) * dayWidth,
  [dayWidth, totalStart])

  const scrollToDate = useCallback((date) => {
    if (!scrollRef.current || dayWidth <= 0) return
    const idx = diffDays(startOfDay(totalStart), startOfDay(date))
    scrollRef.current.scrollLeft = Math.max(0, idx * dayWidth)
  }, [dayWidth, totalStart])

  const scrollToToday = useCallback(() => {
    const today = new Date()
    const yr = today.getFullYear()
    const q  = getQuarterForMonth(today.getMonth())
    const { start } = viewMode === 'year'
      ? getYearRange(yr)
      : getQuarterRange(yr, q)
    scrollToDate(addDays(start, -VIEW_PAD_DAYS))
  }, [viewMode, scrollToDate])

  useImperativeHandle(ref, () => ({ scrollToToday, scrollToDate }), [scrollToToday, scrollToDate])

  // Only re-scroll when navigation changes, NOT on every zoom-induced dayWidth change.
  // hasDayWidth transitions false→true once (initial load), then stays true.
  const hasDayWidth = dayWidth > 0
  useEffect(() => {
    if (!hasDayWidth) return
    const { start } = viewMode === 'year'
      ? getYearRange(year)
      : getQuarterRange(year, quarter)
    scrollToDate(addDays(start, -VIEW_PAD_DAYS))
  }, [hasDayWidth, viewMode, year, quarter]) // eslint-disable-line

  // ── Today line ────────────────────────────────────────────────────────────
  const today    = startOfDay(new Date())
  const todayIdx = diffDays(startOfDay(totalStart), today)
  const todayX   = todayIdx >= 0 && todayIdx < allDays.length
    ? PERSON_COL_W + todayIdx * dayWidth + dayWidth / 2
    : null

  // ── Resolve person from cursor Y ─────────────────────────────────────────
  const resolveAssigneeFromY = (clientY) => {
    for (const [personId, el] of Object.entries(rowRefsMap.current)) {
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientY >= rect.top && clientY <= rect.bottom) return personId
    }
    return null
  }

  // ── Move-drag (lifted from TaskBar) ─────────────────────────────────────
  const startMoveDrag = useCallback((task, e, barRect) => {
    if (readOnly) return
    const drag = {
      task,
      origAssigneeId: task.assigneeId || null,
      targetAssigneeId: task.assigneeId || null,
      startCursorX: e.clientX,
      startCursorY: e.clientY,
      cursorX: e.clientX,
      cursorY: e.clientY,
      barRect,
    }
    const dragRef = { current: drag }
    setActiveDrag(drag)

    const onMove = (me) => {
      const target = resolveAssigneeFromY(me.clientY)
      const updated = {
        ...dragRef.current,
        cursorX: me.clientX,
        cursorY: me.clientY,
        targetAssigneeId: target || dragRef.current.origAssigneeId,
      }
      dragRef.current = updated
      setActiveDrag({ ...updated })
    }

    const onUp = () => {
      const d = dragRef.current
      if (d) {
        const ddx = d.cursorX - d.startCursorX
        const ddy = d.cursorY - d.startCursorY
        const dist = Math.sqrt(ddx * ddx + ddy * ddy)
        if (dist < 5) {
          if (onEditTask) onEditTask(d.task)
        } else {
          const daysDelta = Math.round(ddx / dayWidth)
          const updates = {}
          const ns = snapWeekday(addDays(parseLocalDate(d.task.startDate), daysDelta), daysDelta >= 0)
          const ne = snapWeekday(addDays(parseLocalDate(d.task.endDate),   daysDelta), daysDelta >= 0)
          if (toDateString(ns) !== d.task.startDate) updates.startDate = toDateString(ns)
          if (toDateString(ne) !== d.task.endDate)   updates.endDate   = toDateString(ne)
          if (d.targetAssigneeId !== d.origAssigneeId) {
            updates.assigneeId = d.targetAssigneeId === '__unassigned__' ? null : d.targetAssigneeId
          }
          if (Object.keys(updates).length > 0) onUpdateTask(d.task.id, updates)
        }
      }
      dragRef.current = null
      setActiveDrag(null)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [dayWidth, readOnly, onUpdateTask]) // eslint-disable-line

  // ── Double-click on empty grid → add task ────────────────────────────────
  const handleGridDoubleClick = useCallback((personId, e) => {
    if (readOnly || !onAddTaskForPerson) return
    if (e.target.closest('.task-bar')) return
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    const containerLeft = scrollEl.getBoundingClientRect().left
    const clickXInGrid  = (e.clientX - containerLeft + scrollEl.scrollLeft) - PERSON_COL_W
    const dayIdx = Math.floor(clickXInGrid / dayWidth)
    if (dayIdx < 0 || dayIdx >= allDays.length) return
    const clicked = allDays[dayIdx]
    const snapped = isWeekend(clicked) ? nextWorkday(clicked) : clicked
    onAddTaskForPerson(personId === '__unassigned__' ? null : personId, toDateString(snapped))
  }, [readOnly, dayWidth, allDays, onAddTaskForPerson]) // eslint-disable-line

  // ── Rubber-band selection (Figma-style) ──────────────────────────────────
  const handleScrollMouseDown = useCallback((e) => {
    if (readOnly) return
    if (e.button !== 0) return
    if (e.target.closest('.task-bar')) return
    if (e.target.closest('.timeline__person-col')) return
    if (e.target.closest('.timeline__bulk-bar')) return

    // Prevent browser text-selection highlight during drag
    e.preventDefault()

    const scrollEl = scrollRef.current
    if (!scrollEl) return

    // Compute grid-area bounds in viewport coords — selection is clipped to these
    const cr = scrollEl.getBoundingClientRect()
    const gridMinX = cr.left + PERSON_COL_W   // left edge = right of person col
    const gridMaxX = cr.right
    const gridMinY = cr.top
    const gridMaxY = cr.bottom
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

    const startX = clamp(e.clientX, gridMinX, gridMaxX)
    const startY = clamp(e.clientY, gridMinY, gridMaxY)

    const hitTest = (curX, curY) => {
      const selLeft   = Math.min(startX, curX)
      const selTop    = Math.min(startY, curY)
      const selRight  = Math.max(startX, curX)
      const selBottom = Math.max(startY, curY)
      const bars = document.querySelectorAll('[data-task-id]')
      const hitIds = new Set()
      bars.forEach((bar) => {
        const rect = bar.getBoundingClientRect()
        if (rect.left < selRight && rect.right > selLeft &&
            rect.top < selBottom && rect.bottom > selTop) {
          hitIds.add(bar.getAttribute('data-task-id'))
        }
      })
      return hitIds
    }

    const onMove = (me) => {
      const curX = clamp(me.clientX, gridMinX, gridMaxX)
      const curY = clamp(me.clientY, gridMinY, gridMaxY)
      const w = Math.abs(curX - startX)
      const h = Math.abs(curY - startY)
      if (w > 5 || h > 5) {
        setSelectionBox({ startX, startY, curX, curY })
        setSelectedTaskIds(hitTest(curX, curY))
      }
    }

    const onUp = (ue) => {
      const curX = clamp(ue.clientX, gridMinX, gridMaxX)
      const curY = clamp(ue.clientY, gridMinY, gridMaxY)
      const w = Math.abs(curX - startX)
      const h = Math.abs(curY - startY)
      if (w <= 5 && h <= 5) {
        setSelectedTaskIds(new Set())
      }
      setSelectionBox(null)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [readOnly])

  // ── Bulk actions ─────────────────────────────────────────────────────────
  const handleBulkDelete = () => {
    if (!window.confirm(`Delete ${selectedTaskIds.size} task${selectedTaskIds.size > 1 ? 's' : ''}?`)) return
    selectedTaskIds.forEach((id) => onDeleteTask(id))
    setSelectedTaskIds(new Set())
  }

  const handleBulkAssignPerson = (personId) => {
    selectedTaskIds.forEach((id) => onUpdateTask(id, { assigneeId: personId }))
    setBulkAssignOpen(null)
    setSelectedTaskIds(new Set())
  }

  const handleBulkAssignPM = (teamId) => {
    selectedTaskIds.forEach((id) => onUpdateTask(id, { teamId }))
    setBulkAssignOpen(null)
    setSelectedTaskIds(new Set())
  }

  // ── Filter logic ─────────────────────────────────────────────────────────
  const getPmFilteredTasks = (personTasks) =>
    filterTeamIds.length > 0
      ? personTasks.filter((t) => filterTeamIds.includes(t.teamId))
      : personTasks

  let visiblePeople = people
  if (filterPersonIds.length > 0 && filterTeamIds.length === 0) {
    visiblePeople = people.filter((p) => filterPersonIds.includes(p.id))
  } else if (filterTeamIds.length > 0 && filterPersonIds.length === 0) {
    const personIdsWithMatch = new Set(
      tasks.filter((t) => filterTeamIds.includes(t.teamId)).map((t) => t.assigneeId).filter(Boolean)
    )
    visiblePeople = people.filter((p) => personIdsWithMatch.has(p.id))
  } else if (filterPersonIds.length > 0 && filterTeamIds.length > 0) {
    visiblePeople = people.filter((p) => filterPersonIds.includes(p.id))
  }

  const unassignedTasks = getPmFilteredTasks(
    tasks.filter((t) => !t.assigneeId || !people.find((p) => p.id === t.assigneeId))
  )

  // ── Month groups ──────────────────────────────────────────────────────────
  const monthGroups = groupDaysByMonth(allDays)

  // ── Render each person's row ──────────────────────────────────────────────
  const renderPersonRow = (person, rowTasks, isUnassigned = false) => {
    const personId    = person ? person.id : '__unassigned__'
    const personName  = person ? person.name : 'Unassigned'
    const personColor = person ? (person.color || getAvatarColor(person.name)) : '#9ca3af'

    const sorted = [...rowTasks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))

    // Visible scroll window in date space
    const visibleStart = dayWidth > 0
      ? addDays(totalStart, Math.max(0, Math.floor(scrollLeft / dayWidth)))
      : totalStart
    const visibleEnd = dayWidth > 0
      ? addDays(totalStart, Math.ceil((scrollLeft + Math.max(containerW, 1) - PERSON_COL_W) / dayWidth))
      : totalEnd

    // Only tasks overlapping the visible window, lanes indexed from 0
    const lanedTasks = sorted
      .filter((t) => {
        const ts = parseLocalDate(t.startDate)
        const te = parseLocalDate(t.endDate)
        return te >= visibleStart && ts <= visibleEnd &&
               te >= totalStart  && ts <= totalEnd
      })
      .map((t, i) => ({ ...t, _lane: i }))

    // Extra slot for incoming drag from another row
    const isIncomingDrag = activeDrag &&
      activeDrag.targetAssigneeId === personId &&
      activeDrag.origAssigneeId  !== personId
    const extraSlots = isIncomingDrag ? 1 : 0

    const numVisible = lanedTasks.length + extraSlots
    const rowH = numVisible > 0
      ? ROW_PAD_TOP + numVisible * LANE_H + (numVisible - 1) * LANE_GAP + ROW_PAD_BOT
      : MIN_ROW_H

    const isDropTgt = activeDrag?.targetAssigneeId === personId

    return (
      <div
        key={personId}
        className={[
          'timeline__person-row',
          isUnassigned ? 'timeline__person-row--unassigned' : '',
          isDropTgt    ? 'timeline__person-row--drop-target' : '',
        ].filter(Boolean).join(' ')}
        ref={(el) => { rowRefsMap.current[personId] = el }}
        data-person-id={personId}
        style={{ minHeight: rowH }}
      >
        {/* Sticky left column — avatar + name, vertically centered */}
        <div className="timeline__person-col" style={{ minHeight: rowH }}>
          <div
            className="timeline__avatar"
            style={{ background: isUnassigned ? '#e5e7eb' : personColor }}
          >
            {person?.photo
              ? <img src={person.photo} alt="" />
              : <span>{isUnassigned ? '?' : personName.charAt(0).toUpperCase()}</span>
            }
          </div>
          <div className="timeline__person-info">
            <div className="timeline__person-name">{personName}</div>
          </div>
        </div>

        {/* Grid area — only visible tasks, lanes from 0 */}
        <div
          className="timeline__grid-area"
          style={{ minHeight: rowH }}
          onDoubleClick={(e) => handleGridDoubleClick(personId, e)}
        >
          {lanedTasks.map((task) => {
            const isGhost = activeDrag?.task?.id === task.id
            return (
              <TaskBar
                key={task.id}
                task={task}
                totalStart={totalStart}
                dayWidth={dayWidth}
                laneIndex={task._lane}
                rowPaddingTop={ROW_PAD_TOP}
                laneHeight={LANE_H}
                laneGap={LANE_GAP}
                people={people}
                teams={teams}
                onDelete={() => onDeleteTask(task.id)}
                onResizeDone={(updates) => onUpdateTask(task.id, updates)}
                onMoveDragStart={startMoveDrag}
                onEdit={() => onEditTask && onEditTask(task)}
                isGhost={isGhost}
                isSelected={selectedTaskIds.has(task.id)}
                readOnly={readOnly}
              />
            )
          })}
        </div>
      </div>
    )
  }

  // ── Floating drag overlay ─────────────────────────────────────────────────
  const renderDragOverlay = () => {
    if (!activeDrag) return null
    const { task, barRect, startCursorX, startCursorY, cursorX, cursorY, targetAssigneeId } = activeDrag
    const dx = cursorX - startCursorX
    const dy = cursorY - startCursorY

    const displayAssigneeId = targetAssigneeId || task.assigneeId
    const assignee  = people.find((p) => p.id === displayAssigneeId)
    const pmTeam    = teams.find((t)  => t.id === task.teamId)
    const assigneeColor = assignee ? (assignee.color || getAvatarColor(assignee.name)) : '#9ca3af'

    const daysDelta = dayWidth > 0 ? Math.round(dx / dayWidth) : 0
    const dragStart = snapWeekday(addDays(parseLocalDate(task.startDate), daysDelta), daysDelta >= 0)
    const dragEnd   = snapWeekday(addDays(parseLocalDate(task.endDate),   daysDelta), daysDelta >= 0)

    const overlayW = barRect.width
    return (
      <div
        className="task-drag-overlay"
        style={{
          left:   barRect.left + dx,
          top:    barRect.top  + dy,
          width:  overlayW,
          height: barRect.height,
        }}
      >
        {(assignee || pmTeam) && (
          <div className="task-bar__avatars" style={{ marginRight: 5 }}>
            {assignee && (
              <div className="task-bar__avatar" style={{ background: assigneeColor, zIndex: 2 }}>
                {assignee.photo ? <img src={assignee.photo} alt="" /> : assignee.name?.charAt(0).toUpperCase()}
              </div>
            )}
            {pmTeam && (
              <div
                className={`task-bar__avatar${assignee ? ' task-bar__avatar--second' : ''}`}
                style={{ background: '#6366f1', zIndex: 1, borderRadius: '5px' }}
              >
                {pmTeam.photo ? <img src={pmTeam.photo} alt="" /> : pmTeam.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
        <span className="task-drag-overlay__title">{task.title}</span>
        {overlayW < 260 ? (
          <div className="task-bar__tooltip task-bar__tooltip--center">
            {formatDateWithDay(dragStart)} → {formatDateWithDay(dragEnd)}
          </div>
        ) : (
          <>
            <div className="task-bar__tooltip task-bar__tooltip--left">{formatDateWithDay(dragStart)}</div>
            <div className="task-bar__tooltip task-bar__tooltip--right">{formatDateWithDay(dragEnd)}</div>
          </>
        )}
      </div>
    )
  }

  // ── Selection box (rubber-band) ───────────────────────────────────────────
  const renderSelectionBox = () => {
    if (!selectionBox) return null
    const left   = Math.min(selectionBox.startX, selectionBox.curX)
    const top    = Math.min(selectionBox.startY, selectionBox.curY)
    const width  = Math.abs(selectionBox.curX - selectionBox.startX)
    const height = Math.abs(selectionBox.curY - selectionBox.startY)
    return (
      <div
        className="timeline__selection-box"
        style={{ position: 'fixed', left, top, width, height, pointerEvents: 'none' }}
      />
    )
  }

  // ── Bulk action bar ───────────────────────────────────────────────────────
  const renderBulkBar = () => {
    if (selectedTaskIds.size === 0) return null
    const count = selectedTaskIds.size
    return (
      <div className="timeline__bulk-bar" onClick={(e) => e.stopPropagation()}>
        <span className="timeline__bulk-count">
          {count} task{count > 1 ? 's' : ''} selected
        </span>

        {/* Assign Person */}
        <div className="timeline__bulk-action-wrap">
          <button
            className="timeline__bulk-btn"
            onClick={() => setBulkAssignOpen(bulkAssignOpen === 'person' ? null : 'person')}
          >
            Assign person
          </button>
          {bulkAssignOpen === 'person' && (
            <div className="timeline__bulk-dropdown">
              {people.map((p) => (
                <div
                  key={p.id}
                  className="timeline__bulk-dropdown-item"
                  onClick={() => handleBulkAssignPerson(p.id)}
                >
                  <div
                    className="timeline__bulk-dropdown-avatar"
                    style={{ background: p.color || getAvatarColor(p.name) }}
                  >
                    {p.photo
                      ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : p.name?.charAt(0).toUpperCase()
                    }
                  </div>
                  {p.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assign PM */}
        <div className="timeline__bulk-action-wrap">
          <button
            className="timeline__bulk-btn"
            onClick={() => setBulkAssignOpen(bulkAssignOpen === 'pm' ? null : 'pm')}
          >
            Assign PM
          </button>
          {bulkAssignOpen === 'pm' && (
            <div className="timeline__bulk-dropdown">
              {teams.map((t) => (
                <div
                  key={t.id}
                  className="timeline__bulk-dropdown-item"
                  onClick={() => handleBulkAssignPM(t.id)}
                >
                  <div
                    className="timeline__bulk-dropdown-avatar"
                    style={{ background: '#6366f1', borderRadius: '3px' }}
                  >
                    {t.photo
                      ? <img src={t.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : t.name?.charAt(0).toUpperCase()
                    }
                  </div>
                  {t.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete */}
        <button className="timeline__bulk-btn timeline__bulk-btn--delete" onClick={handleBulkDelete}>
          Delete
        </button>

        {/* Clear selection */}
        <button
          className="timeline__bulk-close"
          onClick={() => { setSelectedTaskIds(new Set()); setBulkAssignOpen(null) }}
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="timeline" ref={containerRef}>
        <div
          className="timeline__scroll"
          ref={scrollRef}
          style={{ '--pcol': `${PERSON_COL_W}px` }}
          onMouseDown={handleScrollMouseDown}
        >
          <div className="timeline__inner" style={{ width: PERSON_COL_W + totalW }}>

            {/* ── Sticky header ──────────────────────────────────────── */}
            <div className="timeline__header">
              <div className="timeline__header-person-col">Designer</div>
              <div className="timeline__header-grid">
                <div className="timeline__month-row">
                  {monthGroups.map((mg, i) => {
                    const label = viewMode === 'year'
                      ? (mg.month === 0 ? `${MONTHS_SHORT[mg.month]} ${mg.year}` : MONTHS_SHORT[mg.month])
                      : `${MONTHS_SHORT[mg.month]} ${mg.year}`
                    return (
                      <div key={i} className="timeline__month-cell" style={{ width: mg.days.length * dayWidth }}>
                        {label}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* ── Body ─────────────────────────────────────────────── */}
            <div className="timeline__body">
              {/* Weekend shading */}
              {allDays.map((d, i) => isWeekend(d) ? (
                <div
                  key={`we-${i}`}
                  className="timeline__weekend-col"
                  style={{ left: PERSON_COL_W + i * dayWidth, width: dayWidth }}
                />
              ) : null)}

              {/* Month boundary lines */}
              {monthGroups.map((mg, i) => {
                const x = allDays.findIndex(
                  (d) => d.getMonth() === mg.month && d.getFullYear() === mg.year
                ) * dayWidth
                const isQBoundary = mg.month === 0 || mg.month === 3 || mg.month === 6 || mg.month === 9
                return (
                  <div
                    key={`ml-${i}`}
                    className={`timeline__month-line${isQBoundary ? ' timeline__month-line--quarter' : ''}`}
                    style={{ left: PERSON_COL_W + x - 1 }}
                  />
                )
              })}

              {/* Today line */}
              {todayX !== null && (
                <div className="timeline__today-line" style={{ left: todayX }}>
                  <div className="timeline__today-label">TODAY</div>
                </div>
              )}

              {/* Person rows */}
              {visiblePeople.map((person) => {
                const allPersonTasks = tasks.filter((t) => t.assigneeId === person.id)
                const rowTasks = getPmFilteredTasks(allPersonTasks)
                return renderPersonRow(person, rowTasks)
              })}

              {/* Unassigned row */}
              {unassignedTasks.length > 0 && renderPersonRow(null, unassignedTasks, true)}

              {visiblePeople.length === 0 && unassignedTasks.length === 0 && (
                <div className="timeline__empty">
                  No people added yet. Use the Add button to get started.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating drag clone */}
      {renderDragOverlay()}

      {/* Rubber-band selection box */}
      {renderSelectionBox()}

      {/* Bulk action bar */}
      {renderBulkBar()}
    </>
  )
})

export default Timeline
