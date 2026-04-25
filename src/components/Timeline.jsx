import { useRef, useEffect, useLayoutEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
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

const VIEW_DAYS_YEAR    = 365 + VIEW_PAD_DAYS * 2
const VIEW_DAYS_QUARTER = 91  + VIEW_PAD_DAYS * 2

const snapWeekday = (date, forward = true) => {
  const d = new Date(date)
  if (!isWeekend(d)) return d
  return forward ? nextWorkday(d) : (() => { while (isWeekend(d)) d.setDate(d.getDate() - 1); return d })()
}

const Timeline = forwardRef(function Timeline({
  viewMode, year, quarter,
  people, tasks,
  groupBy,           // 'none' | role string like 'Designer' | 'PM' | 'Dev'
  filterPersonIds,
  onUpdateTask, onDeleteTask, onAddTaskForPerson, onEditTask,
  readOnly,
}, ref) {
  const scrollRef    = useRef(null)
  const containerRef = useRef(null)
  const rowRefsMap   = useRef({})

  const [containerW,      setContainerW]      = useState(0)
  const [activeDrag,      setActiveDrag]       = useState(null)
  const [scrollLeft,      setScrollLeft]       = useState(0)
  const [zoomScale,       setZoomScale]        = useState(1.0)
  const zoomScaleRef    = useRef(1.0)
  const pendingScrollRef = useRef(null)

  // Multi-select
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set())
  const [selectionBox,    setSelectionBox]    = useState(null)
  const [bulkAssignOpen,  setBulkAssignOpen]  = useState(null)

  // ── Effective person-column width (0 when no grouping) ───────────────────
  const personColW    = groupBy === 'none' ? 0 : PERSON_COL_W
  const personColWRef = useRef(personColW)
  personColWRef.current = personColW

  const totalRange = getTotalRange(year)
  const totalStart = totalRange.start
  const totalEnd   = totalRange.end
  const allDays    = getDaysInRange(totalStart, totalEnd)

  const baseViewDays = viewMode === 'year' ? VIEW_DAYS_YEAR : VIEW_DAYS_QUARTER
  const MIN_VD = 60
  const MAX_VD = 730
  const viewDays = Math.max(MIN_VD, Math.min(MAX_VD, baseViewDays / zoomScale))
  const dayWidth = containerW > 0 ? (containerW - personColW) / viewDays : 0
  const totalW   = dayWidth * allDays.length

  // ── Container width ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => {
      const w = containerRef.current?.clientWidth || 0
      setContainerW(w)
      if (scrollRef.current) scrollRef.current.style.setProperty('--cw', (w - personColWRef.current) + 'px')
    })
    ro.observe(containerRef.current)
    setContainerW(containerRef.current.clientWidth)
    return () => ro.disconnect()
  }, []) // eslint-disable-line

  // Update --pcol when groupBy changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.style.setProperty('--cw', (containerW - personColW) + 'px')
  }, [personColW, containerW])

  // Scroll listener
  useEffect(() => {
    const el = scrollRef.current; if (!el) return
    let rafId
    const handler = () => {
      el.style.setProperty('--sl', el.scrollLeft + 'px')
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => setScrollLeft(el.scrollLeft))
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => { el.removeEventListener('scroll', handler); cancelAnimationFrame(rafId) }
  }, [])

  // Pinch-to-zoom (ctrl+wheel)
  useEffect(() => {
    const el = scrollRef.current; if (!el) return
    const onWheel = (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const pcw  = personColWRef.current
      const cursorXInGrid = e.clientX - rect.left - pcw
      if (cursorXInGrid < 0) return
      const baseVD = viewMode === 'year' ? VIEW_DAYS_YEAR : VIEW_DAYS_QUARTER
      const currentScrollLeft = pendingScrollRef.current !== null ? pendingScrollRef.current : el.scrollLeft
      const curVD    = Math.max(MIN_VD, Math.min(MAX_VD, baseVD / zoomScaleRef.current))
      const oldDayW  = (el.clientWidth - pcw) / curVD
      const cursorDay = (currentScrollLeft + cursorXInGrid) / oldDayW
      const factor    = Math.exp(-e.deltaY / 120)
      const newVD     = Math.max(MIN_VD, Math.min(MAX_VD, baseVD / (zoomScaleRef.current * factor)))
      const newScale  = baseVD / newVD
      zoomScaleRef.current = newScale
      const newDayW = (el.clientWidth - pcw) / newVD
      pendingScrollRef.current = Math.max(0, cursorDay * newDayW - cursorXInGrid)
      setZoomScale(newScale)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [viewMode]) // eslint-disable-line

  useLayoutEffect(() => {
    if (pendingScrollRef.current !== null && scrollRef.current) {
      scrollRef.current.scrollLeft = pendingScrollRef.current
      pendingScrollRef.current = null
    }
  }, [zoomScale])

  // Escape clears selection
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { setSelectedTaskIds(new Set()); setBulkAssignOpen(null) } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Scroll helpers ────────────────────────────────────────────────────────
  const scrollToDate = useCallback((date) => {
    if (!scrollRef.current || dayWidth <= 0) return
    scrollRef.current.scrollLeft = Math.max(0, diffDays(startOfDay(totalStart), startOfDay(date)) * dayWidth)
  }, [dayWidth, totalStart])

  const scrollToToday = useCallback(() => {
    const today = new Date()
    const yr = today.getFullYear()
    const q  = getQuarterForMonth(today.getMonth())
    const { start } = viewMode === 'year' ? getYearRange(yr) : getQuarterRange(yr, q)
    scrollToDate(addDays(start, -VIEW_PAD_DAYS))
  }, [viewMode, scrollToDate])

  useImperativeHandle(ref, () => ({ scrollToToday, scrollToDate }), [scrollToToday, scrollToDate])

  // Reset zoom + scroll on view/period change OR when personColW changes (groupBy switch)
  const hasDayWidth = dayWidth > 0
  useEffect(() => {
    if (!hasDayWidth) return
    zoomScaleRef.current = 1.0
    pendingScrollRef.current = null
    const pcw = personColWRef.current
    const resetDayW = containerW > pcw ? (containerW - pcw) / baseViewDays : 0
    if (resetDayW > 0 && scrollRef.current) {
      const { start } = viewMode === 'year' ? getYearRange(year) : getQuarterRange(year, quarter)
      const idx = diffDays(startOfDay(totalStart), startOfDay(addDays(start, -VIEW_PAD_DAYS)))
      scrollRef.current.scrollLeft = Math.max(0, idx * resetDayW)
    }
    setZoomScale(1.0)
  }, [hasDayWidth, viewMode, year, quarter, personColW]) // eslint-disable-line

  // ── Today line ────────────────────────────────────────────────────────────
  const today    = startOfDay(new Date())
  const todayIdx = diffDays(startOfDay(totalStart), today)
  const todayX   = todayIdx >= 0 && todayIdx < allDays.length
    ? personColW + todayIdx * dayWidth + dayWidth / 2
    : null

  // ── Resolve person row from Y ─────────────────────────────────────────────
  const resolveAssigneeFromY = (clientY) => {
    for (const [personId, el] of Object.entries(rowRefsMap.current)) {
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientY >= rect.top && clientY <= rect.bottom) return personId
    }
    return null
  }

  // ── Move drag ─────────────────────────────────────────────────────────────
  const startMoveDrag = useCallback((task, e, barRect) => {
    if (readOnly) return
    const drag = { task, origAssigneeId: task.assigneeId || null, targetAssigneeId: task.assigneeId || null,
      startCursorX: e.clientX, startCursorY: e.clientY, cursorX: e.clientX, cursorY: e.clientY, barRect }
    const dragRef = { current: drag }
    setActiveDrag(drag)

    const onMove = (me) => {
      const target = groupBy !== 'none' ? resolveAssigneeFromY(me.clientY) : null
      const updated = { ...dragRef.current, cursorX: me.clientX, cursorY: me.clientY,
        targetAssigneeId: target || dragRef.current.origAssigneeId }
      dragRef.current = updated
      setActiveDrag({ ...updated })
    }

    const onUp = () => {
      const d = dragRef.current
      if (d) {
        const ddx = d.cursorX - d.startCursorX
        const ddy = d.cursorY - d.startCursorY
        if (Math.sqrt(ddx * ddx + ddy * ddy) < 5) {
          if (onEditTask) onEditTask(d.task)
        } else {
          const daysDelta = Math.round(ddx / dayWidth)
          const updates = {}
          const ns = snapWeekday(addDays(parseLocalDate(d.task.startDate), daysDelta), daysDelta >= 0)
          const ne = snapWeekday(addDays(parseLocalDate(d.task.endDate),   daysDelta), daysDelta >= 0)
          if (toDateString(ns) !== d.task.startDate) updates.startDate = toDateString(ns)
          if (toDateString(ne) !== d.task.endDate)   updates.endDate   = toDateString(ne)
          if (d.targetAssigneeId !== d.origAssigneeId)
            updates.assigneeId = d.targetAssigneeId === '__unassigned__' ? null : d.targetAssigneeId
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
  }, [dayWidth, readOnly, groupBy, onUpdateTask]) // eslint-disable-line

  // ── Double-click → add task ───────────────────────────────────────────────
  const handleGridDoubleClick = useCallback((personId, e) => {
    if (readOnly || !onAddTaskForPerson) return
    if (e.target.closest('.task-bar')) return
    const scrollEl = scrollRef.current; if (!scrollEl) return
    const containerLeft = scrollEl.getBoundingClientRect().left
    const pcw = personColWRef.current
    const clickXInGrid = (e.clientX - containerLeft + scrollEl.scrollLeft) - pcw
    const dayIdx = Math.floor(clickXInGrid / dayWidth)
    if (dayIdx < 0 || dayIdx >= allDays.length) return
    const clicked = allDays[dayIdx]
    const snapped = isWeekend(clicked) ? nextWorkday(clicked) : clicked
    onAddTaskForPerson(personId === '__unassigned__' ? null : personId, toDateString(snapped))
  }, [readOnly, dayWidth, allDays, onAddTaskForPerson]) // eslint-disable-line

  // ── Rubber-band selection ─────────────────────────────────────────────────
  const handleScrollMouseDown = useCallback((e) => {
    if (readOnly) return
    if (e.button !== 0) return
    if (e.target.closest('.task-bar')) return
    if (e.target.closest('.timeline__person-col')) return
    if (e.target.closest('.timeline__bulk-bar')) return
    e.preventDefault()
    const scrollEl = scrollRef.current; if (!scrollEl) return
    const cr = scrollEl.getBoundingClientRect()
    const pcw = personColWRef.current
    const gridMinX = cr.left + pcw
    const gridMaxX = cr.right
    const gridMinY = cr.top
    const gridMaxY = cr.bottom
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
    const startX = clamp(e.clientX, gridMinX, gridMaxX)
    const startY = clamp(e.clientY, gridMinY, gridMaxY)

    const hitTest = (curX, curY) => {
      const selLeft = Math.min(startX, curX), selTop = Math.min(startY, curY)
      const selRight = Math.max(startX, curX), selBottom = Math.max(startY, curY)
      const hitIds = new Set()
      document.querySelectorAll('[data-task-id]').forEach((bar) => {
        const rect = bar.getBoundingClientRect()
        if (rect.left < selRight && rect.right > selLeft && rect.top < selBottom && rect.bottom > selTop)
          hitIds.add(bar.getAttribute('data-task-id'))
      })
      return hitIds
    }

    const onMove = (me) => {
      const curX = clamp(me.clientX, gridMinX, gridMaxX)
      const curY = clamp(me.clientY, gridMinY, gridMaxY)
      if (Math.abs(curX - startX) > 5 || Math.abs(curY - startY) > 5) {
        setSelectionBox({ startX, startY, curX, curY })
        setSelectedTaskIds(hitTest(curX, curY))
      }
    }
    const onUp = (ue) => {
      const curX = clamp(ue.clientX, gridMinX, gridMaxX)
      const curY = clamp(ue.clientY, gridMinY, gridMaxY)
      if (Math.abs(curX - startX) <= 5 && Math.abs(curY - startY) <= 5) setSelectedTaskIds(new Set())
      setSelectionBox(null)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [readOnly])

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const handleBulkDelete = () => {
    if (!window.confirm(`Delete ${selectedTaskIds.size} task${selectedTaskIds.size > 1 ? 's' : ''}?`)) return
    selectedTaskIds.forEach((id) => onDeleteTask(id))
    setSelectedTaskIds(new Set())
  }

  const handleBulkAssignPerson = (personId) => {
    selectedTaskIds.forEach((id) => onUpdateTask(id, { assigneeId: personId }))
    setBulkAssignOpen(null); setSelectedTaskIds(new Set())
  }

  const handleBulkAssignPM = (personId) => {
    selectedTaskIds.forEach((id) => onUpdateTask(id, { pmId: personId }))
    setBulkAssignOpen(null); setSelectedTaskIds(new Set())
  }

  // ── Filter logic ──────────────────────────────────────────────────────────
  let visiblePeople = people
  if (filterPersonIds.length > 0) {
    visiblePeople = people.filter((p) => filterPersonIds.includes(p.id))
  }

  // When grouping by a role, only show people of that role
  const groupedPeople = groupBy !== 'none'
    ? visiblePeople.filter((p) => p.role === groupBy)
    : []

  // All tasks (for no-grouping mode), filtered if needed
  const filteredTasks = filterPersonIds.length > 0
    ? tasks.filter((t) => filterPersonIds.includes(t.assigneeId) || filterPersonIds.includes(t.pmId))
    : tasks

  // Unassigned tasks (for grouped mode) — depends on what field we're grouping by
  const unassignedTasks = groupBy !== 'none'
    ? groupBy === 'PM'
      ? filteredTasks.filter((t) => {
          const pmId = t.pmId || t.teamId
          return !pmId || !groupedPeople.find((p) => p.id === pmId)
        })
      : filteredTasks.filter((t) => !t.assigneeId || !groupedPeople.find((p) => p.id === t.assigneeId))
    : []

  const monthGroups = groupDaysByMonth(allDays)

  // ── Render a single task row (no-grouping mode) ───────────────────────────
  const renderTaskRow = (task) => {
    const rowH = MIN_ROW_H

    return (
      <div
        key={task.id}
        className="timeline__person-row"
        style={{ minHeight: rowH }}
      >
        {/* Grid area — full width, no person col */}
        <div
          className="timeline__grid-area"
          style={{ minHeight: rowH }}
          onDoubleClick={(e) => handleGridDoubleClick(null, e)}
        >
          {dayWidth > 0 && (
            <TaskBar
              task={task}
              totalStart={totalStart}
              dayWidth={dayWidth}
              laneIndex={0}
              rowPaddingTop={ROW_PAD_TOP}
              laneHeight={LANE_H}
              laneGap={LANE_GAP}
              people={people}
              onDelete={() => onDeleteTask(task.id)}
              onResizeDone={(updates) => onUpdateTask(task.id, updates)}
              onMoveDragStart={startMoveDrag}
              onEdit={() => onEditTask && onEditTask(task)}
              isGhost={activeDrag?.task?.id === task.id}
              isSelected={selectedTaskIds.has(task.id)}
              readOnly={readOnly}
            />
          )}
        </div>
      </div>
    )
  }

  // ── Render a grouped person row ───────────────────────────────────────────
  const renderPersonRow = (person, rowTasks, isUnassigned = false) => {
    const personId    = person ? person.id : '__unassigned__'
    const personName  = person ? person.name : 'Unassigned'
    const personColor = person ? (person.color || getAvatarColor(person.name)) : '#9ca3af'

    const sorted = [...rowTasks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))

    const visibleStart = dayWidth > 0
      ? addDays(totalStart, Math.max(0, Math.floor(scrollLeft / dayWidth)))
      : totalStart
    const visibleEnd = dayWidth > 0
      ? addDays(totalStart, Math.ceil((scrollLeft + Math.max(containerW, 1) - personColW) / dayWidth))
      : totalEnd

    const lanedTasks = sorted
      .filter((t) => {
        const ts = parseLocalDate(t.startDate), te = parseLocalDate(t.endDate)
        return te >= visibleStart && ts <= visibleEnd && te >= totalStart && ts <= totalEnd
      })
      .map((t, i) => ({ ...t, _lane: i }))

    const isIncomingDrag = activeDrag &&
      activeDrag.targetAssigneeId === personId &&
      activeDrag.origAssigneeId   !== personId
    const numVisible = lanedTasks.length + (isIncomingDrag ? 1 : 0)
    const rowH = numVisible > 0
      ? ROW_PAD_TOP + numVisible * LANE_H + (numVisible - 1) * LANE_GAP + ROW_PAD_BOT
      : MIN_ROW_H

    const isDropTgt = activeDrag?.targetAssigneeId === personId

    return (
      <div
        key={personId}
        className={['timeline__person-row', isUnassigned ? 'timeline__person-row--unassigned' : '',
          isDropTgt ? 'timeline__person-row--drop-target' : ''].filter(Boolean).join(' ')}
        ref={(el) => { rowRefsMap.current[personId] = el }}
        data-person-id={personId}
        style={{ minHeight: rowH }}
      >
        {/* Left column — sticky */}
        <div className="timeline__person-col" style={{ minHeight: rowH, width: PERSON_COL_W }}>
          <div className="timeline__avatar" style={{ background: isUnassigned ? '#e5e7eb' : personColor }}>
            {person?.photo
              ? <img src={person.photo} alt="" />
              : <span>{isUnassigned ? '?' : personName.charAt(0).toUpperCase()}</span>
            }
          </div>
          <div className="timeline__person-info">
            <div className="timeline__person-name">{personName}</div>
            {person?.role && <div className="timeline__person-team">{person.role}</div>}
          </div>
        </div>

        {/* Grid area */}
        <div
          className="timeline__grid-area"
          style={{ minHeight: rowH }}
          onDoubleClick={(e) => handleGridDoubleClick(personId, e)}
        >
          {lanedTasks.map((task) => (
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
              onDelete={() => onDeleteTask(task.id)}
              onResizeDone={(updates) => onUpdateTask(task.id, updates)}
              onMoveDragStart={startMoveDrag}
              onEdit={() => onEditTask && onEditTask(task)}
              isGhost={activeDrag?.task?.id === task.id}
              isSelected={selectedTaskIds.has(task.id)}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>
    )
  }

  // ── Floating drag overlay ─────────────────────────────────────────────────
  const renderDragOverlay = () => {
    if (!activeDrag) return null
    const { task, barRect, startCursorX, startCursorY, cursorX, cursorY } = activeDrag
    const dx = cursorX - startCursorX
    const dy = cursorY - startCursorY
    const assignee = people.find((p) => p.id === task.assigneeId)
    const pmPerson = people.find((p) => p.id === (task.pmId || task.teamId))
    const daysDelta = dayWidth > 0 ? Math.round(dx / dayWidth) : 0
    const dragStart = snapWeekday(addDays(parseLocalDate(task.startDate), daysDelta), daysDelta >= 0)
    const dragEnd   = snapWeekday(addDays(parseLocalDate(task.endDate),   daysDelta), daysDelta >= 0)

    return (
      <div className="task-drag-overlay"
        style={{ left: barRect.left + dx, top: barRect.top + dy, width: barRect.width, height: barRect.height }}>
        {(assignee || pmPerson) && (
          <div className="task-bar__avatars" style={{ marginRight: 5 }}>
            {assignee && (
              <div className="task-bar__avatar" style={{ background: assignee.color || getAvatarColor(assignee.name), zIndex: 2 }}>
                {assignee.photo ? <img src={assignee.photo} alt="" /> : assignee.name?.charAt(0).toUpperCase()}
              </div>
            )}
            {pmPerson && (
              <div className={`task-bar__avatar${assignee ? ' task-bar__avatar--second' : ''}`}
                style={{ background: pmPerson.color || getAvatarColor(pmPerson.name), zIndex: 1, borderRadius: '5px' }}>
                {pmPerson.photo ? <img src={pmPerson.photo} alt="" /> : pmPerson.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
        <span className="task-drag-overlay__title">{task.title}</span>
        {barRect.width < 260 ? (
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

  // ── Selection box ─────────────────────────────────────────────────────────
  const renderSelectionBox = () => {
    if (!selectionBox) return null
    const left   = Math.min(selectionBox.startX, selectionBox.curX)
    const top    = Math.min(selectionBox.startY, selectionBox.curY)
    const width  = Math.abs(selectionBox.curX - selectionBox.startX)
    const height = Math.abs(selectionBox.curY - selectionBox.startY)
    return (
      <div className="timeline__selection-box"
        style={{ position: 'fixed', left, top, width, height, pointerEvents: 'none' }} />
    )
  }

  // ── Bulk action bar ───────────────────────────────────────────────────────
  const renderBulkBar = () => {
    if (selectedTaskIds.size === 0) return null
    const count = selectedTaskIds.size
    return (
      <div className="timeline__bulk-bar" onClick={(e) => e.stopPropagation()}>
        <span className="timeline__bulk-count">{count} task{count > 1 ? 's' : ''} selected</span>

        <div className="timeline__bulk-action-wrap">
          <button className="timeline__bulk-btn" onClick={() => setBulkAssignOpen(bulkAssignOpen === 'person' ? null : 'person')}>
            Assign person
          </button>
          {bulkAssignOpen === 'person' && (
            <div className="timeline__bulk-dropdown">
              {people.map((p) => (
                <div key={p.id} className="timeline__bulk-dropdown-item" onClick={() => handleBulkAssignPerson(p.id)}>
                  <div className="timeline__bulk-dropdown-avatar" style={{ background: p.color || getAvatarColor(p.name) }}>
                    {p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name?.charAt(0).toUpperCase()}
                  </div>
                  {p.name} <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>{p.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="timeline__bulk-action-wrap">
          <button className="timeline__bulk-btn" onClick={() => setBulkAssignOpen(bulkAssignOpen === 'pm' ? null : 'pm')}>
            Assign PM
          </button>
          {bulkAssignOpen === 'pm' && (
            <div className="timeline__bulk-dropdown">
              {people.filter((p) => p.role === 'PM').concat(people.filter((p) => p.role !== 'PM')).map((p) => (
                <div key={p.id} className="timeline__bulk-dropdown-item" onClick={() => handleBulkAssignPM(p.id)}>
                  <div className="timeline__bulk-dropdown-avatar" style={{ background: p.color || getAvatarColor(p.name) }}>
                    {p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name?.charAt(0).toUpperCase()}
                  </div>
                  {p.name} <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>{p.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="timeline__bulk-btn timeline__bulk-btn--delete" onClick={handleBulkDelete}>Delete</button>
        <button className="timeline__bulk-close" onClick={() => { setSelectedTaskIds(new Set()); setBulkAssignOpen(null) }}>×</button>
      </div>
    )
  }

  // ── Sort tasks for no-grouping mode ───────────────────────────────────────
  const sortedFlatTasks = groupBy === 'none'
    ? [...filteredTasks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    : []

  // ── Render header label for left col ─────────────────────────────────────
  const headerColLabel = groupBy === 'none' ? '' : groupBy

  return (
    <>
      <div className="timeline" ref={containerRef}>
        <div
          className="timeline__scroll"
          ref={scrollRef}
          style={{ '--pcol': `${personColW}px` }}
          onMouseDown={handleScrollMouseDown}
        >
          <div className="timeline__inner" style={{ width: personColW + totalW }}>

            {/* ── Sticky header ─────────────────────────────────── */}
            <div className="timeline__header">
              {groupBy !== 'none' && (
                <div className="timeline__header-person-col">{headerColLabel}</div>
              )}
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

            {/* ── Body ────────────────────────────────────────── */}
            <div className="timeline__body">
              {/* Weekend shading */}
              {allDays.map((d, i) => isWeekend(d) ? (
                <div key={`we-${i}`} className="timeline__weekend-col"
                  style={{ left: personColW + i * dayWidth, width: dayWidth }} />
              ) : null)}

              {/* Month lines */}
              {monthGroups.map((mg, i) => {
                const x = allDays.findIndex((d) => d.getMonth() === mg.month && d.getFullYear() === mg.year) * dayWidth
                const isQB = mg.month === 0 || mg.month === 3 || mg.month === 6 || mg.month === 9
                return (
                  <div key={`ml-${i}`}
                    className={`timeline__month-line${isQB ? ' timeline__month-line--quarter' : ''}`}
                    style={{ left: personColW + x - 1 }} />
                )
              })}

              {/* Today line */}
              {todayX !== null && (
                <div className="timeline__today-line" style={{ left: todayX }}>
                  <div className="timeline__today-label">TODAY</div>
                </div>
              )}

              {/* ── No-grouping: flat task rows ─────────────── */}
              {groupBy === 'none' && (
                <>
                  {sortedFlatTasks.map((task) => renderTaskRow(task))}
                  {sortedFlatTasks.length === 0 && (
                    <div
                      className="timeline__empty-drop"
                      style={{ minHeight: '100%' }}
                      onDoubleClick={(e) => handleGridDoubleClick(null, e)}
                    >
                      Double-click to add a task
                    </div>
                  )}
                </>
              )}

              {/* ── Grouped: person rows ────────────────────── */}
              {groupBy !== 'none' && (
                <>
                  {/* Full-height person column backdrop */}
                  <div className="timeline__person-col-fill" style={{ width: PERSON_COL_W }} />

                  {groupedPeople.map((person) => {
                    // PM grouping: match by pmId; all others: match by assigneeId
                    const rowTasks = groupBy === 'PM'
                      ? filteredTasks.filter((t) => (t.pmId || t.teamId) === person.id)
                      : filteredTasks.filter((t) => t.assigneeId === person.id)
                    return renderPersonRow(person, rowTasks)
                  })}

                  {unassignedTasks.length > 0 && renderPersonRow(null, unassignedTasks, true)}

                  {groupedPeople.length === 0 && unassignedTasks.length === 0 && (
                    <div className="timeline__empty">
                      No {groupBy}s added yet. Go to Settings to add people.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {renderDragOverlay()}
      {renderSelectionBox()}
      {renderBulkBar()}
    </>
  )
})

export default Timeline
