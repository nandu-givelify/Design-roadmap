import { useRef, useEffect, useLayoutEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { flushSync } from 'react-dom'
import {
  getDaysInRange, groupDaysByMonth, isWeekend, startOfDay, diffDays,
  getTotalRange, getYearRange, getQuarterRange,
  MONTHS_SHORT, getQuarterForMonth,
  getAvatarColor, addDays, toDateString, nextWorkday, VIEW_PAD_DAYS, formatDateWithDay, parseLocalDate,
} from '../utils/dateUtils'
import TaskBar from './TaskBar'

// ── Layout constants ────────────────────────────────────────────────────────
const PERSON_COL_W = 200
const LANE_H       = 46
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
  boardPhases,
  readOnly,
  loading,
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
  const centerDayRef    = useRef(null)   // always-current center day, updated on scroll
  const dayWidthRef     = useRef(0)
  const viewportWRef    = useRef(0)      // actual current grid viewport width, updated in ResizeObserver

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
  dayWidthRef.current = dayWidth
  const viewDaysRef = useRef(viewDays)
  viewDaysRef.current = viewDays
  const totalW   = dayWidth * allDays.length

  // ── Container width ───────────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!containerRef.current) return
    viewportWRef.current = containerRef.current.clientWidth - personColWRef.current

    const ro = new ResizeObserver((entries) => {
      const newW = entries[0]?.contentRect.width ?? containerRef.current?.clientWidth ?? 0
      const newViewportW = newW - personColWRef.current

      // Compute target scrollLeft BEFORE React re-renders (el.scrollLeft and
      // viewportWRef are still at the previous step's values, so the ratio is correct
      // even across rapid successive callbacks before React has a chance to render).
      let targetSL = null
      if (scrollRef.current && viewportWRef.current > 0) {
        targetSL = Math.max(0, scrollRef.current.scrollLeft * (newViewportW / viewportWRef.current))
      }

      // Update viewportWRef BEFORE flushSync so any nested callbacks see the new width
      viewportWRef.current = newViewportW

      // Force a synchronous React commit so dayWidth/totalW update immediately.
      // This ensures el.scrollLeft and the grid content are always set together
      // before the browser paints — eliminating the jitter from an async render.
      flushSync(() => setContainerW(newW))

      // Apply scroll AFTER React committed — scrollLeft and totalW are now consistent
      if (targetSL !== null && scrollRef.current) {
        scrollRef.current.scrollLeft = targetSL
        scrollRef.current.style.setProperty('--cw', newViewportW + 'px')
        if (viewDaysRef.current > 0) {
          centerDayRef.current = (targetSL + newViewportW / 2) / (newViewportW / viewDaysRef.current)
        }
      }
    })
    ro.observe(containerRef.current)
    setContainerW(containerRef.current.clientWidth)
    return () => ro.disconnect()
  }, []) // eslint-disable-line

  // Update --cw when personColW changes (groupBy switch)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.style.setProperty('--cw', (containerW - personColW) + 'px')
  }, [personColW, containerW])

  // Scroll listener — tracks center day for use by the ResizeObserver rAF above
  useEffect(() => {
    const el = scrollRef.current; if (!el) return
    let rafId
    const handler = () => {
      el.style.setProperty('--sl', el.scrollLeft + 'px')
      if (dayWidthRef.current > 0) {
        centerDayRef.current = (el.scrollLeft + (el.clientWidth - personColWRef.current) / 2) / dayWidthRef.current
      }
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

  // Reset zoom + scroll on view/period change or groupBy switch.
  // useLayoutEffect = runs before paint so no initial-position flash.
  const hasDayWidth = dayWidth > 0
  useLayoutEffect(() => {
    if (!hasDayWidth) return
    zoomScaleRef.current = 1.0
    pendingScrollRef.current = null
    const pcw = personColWRef.current
    const resetDayW = containerW > pcw ? (containerW - pcw) / baseViewDays : 0
    if (resetDayW > 0 && scrollRef.current) {
      const { start } = viewMode === 'year' ? getYearRange(year) : getQuarterRange(year, quarter)
      const idx = diffDays(startOfDay(totalStart), startOfDay(addDays(start, -VIEW_PAD_DAYS)))
      const newSL = Math.max(0, idx * resetDayW)
      scrollRef.current.scrollLeft = newSL
      // Seed centerDayRef and viewportWRef so the first resize preserves this position
      const viewportW = containerW - pcw
      centerDayRef.current = (newSL + viewportW / 2) / resetDayW
      viewportWRef.current = viewportW
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

  // helpers for phases
  const bulkTaskDays = (task) => {
    if (!task.startDate || !task.endDate) return 28
    return Math.max(1, Math.round((new Date(task.endDate) - new Date(task.startDate)) / 86400000) + 1)
  }
  const bulkDefaultPhases = (task) => {
    if (!boardPhases || !boardPhases.length) return []
    const n   = boardPhases.length
    const d   = bulkTaskDays(task)
    const ids = boardPhases.map(p => p.id)
    if (ids.includes('discovery') && ids.includes('handoff') && ids.includes('ux') && ids.includes('ui')) {
      const discovery = Math.max(1, Math.min(7, Math.round(d * 0.25)))
      const handoff   = Math.max(1, Math.min(3, Math.round(d * 0.1)))
      const remaining = Math.max(2, d - discovery - handoff)
      const ux = Math.max(1, Math.floor(remaining / 2))
      const ui = Math.max(1, remaining - ux)
      return boardPhases.map(bp => ({
        id: bp.id,
        days: bp.id === 'discovery' ? discovery
            : bp.id === 'handoff'   ? handoff
            : bp.id === 'ux'        ? ux
            : bp.id === 'ui'        ? ui
            : Math.max(1, Math.floor(d / n)),
      }))
    }
    const eq = Math.max(1, Math.floor(d / n))
    return boardPhases.map((bp, i) => ({ id: bp.id, days: i === n-1 ? Math.max(1, d - eq*(n-1)) : eq }))
  }
  const bulkNormalize = (phases, task) => {
    const d = bulkTaskDays(task)
    const n = phases.length
    const eq = Math.max(1, Math.floor(d / n))
    return phases.map((p, i) => ({ ...p, days: i === n-1 ? Math.max(1, d - eq*(n-1)) : eq }))
  }

  const handleBulkTogglePhase = (phaseId) => {
    const selected = [...selectedTaskIds].map(id => tasks.find(t => t.id === id)).filter(Boolean)
    const allHave  = selected.every(t => {
      const ph = t.phases && t.phases.length > 0 ? t.phases : bulkDefaultPhases(t)
      return ph.some(p => p.id === phaseId)
    })
    selected.forEach(task => {
      const cur = task.phases && task.phases.length > 0 ? task.phases : bulkDefaultPhases(task)
      let next
      if (allHave) {
        if (cur.length <= 1) return
        next = bulkNormalize(cur.filter(p => p.id !== phaseId), task)
      } else {
        if (cur.some(p => p.id === phaseId)) return
        const added = [...cur, { id: phaseId, days: 1 }]
        const ordered = (boardPhases || [])
          .filter(bp => added.some(p => p.id === bp.id))
          .map(bp => ({ id: bp.id, days: 1 }))
        next = bulkNormalize(ordered, task)
      }
      onUpdateTask(task.id, { phases: next })
    })
    setBulkAssignOpen(null)
  }

  const handleBulkSetColor = (color) => {
    selectedTaskIds.forEach((id) => onUpdateTask(id, { taskColor: color }))
    setBulkAssignOpen(null)
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
              boardPhases={boardPhases}
              onDelete={() => onDeleteTask(task.id)}
              onResizeDone={(updates) => onUpdateTask(task.id, updates)}
              onMoveDragStart={startMoveDrag}
              onEdit={() => onEditTask && onEditTask(task)}
              onPhaseDragDone={(newPhases) => onUpdateTask(task.id, { phases: newPhases })}
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
    const personColor = person ? (getAvatarColor(person.email || person.name)) : '#9ca3af'

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
              boardPhases={boardPhases}
              onDelete={() => onDeleteTask(task.id)}
              onResizeDone={(updates) => onUpdateTask(task.id, updates)}
              onMoveDragStart={startMoveDrag}
              onEdit={() => onEditTask && onEditTask(task)}
              onPhaseDragDone={(newPhases) => onUpdateTask(task.id, { phases: newPhases })}
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
              <div className="task-bar__avatar" style={{ background: getAvatarColor(assignee.email || assignee.name), zIndex: 2 }}>
                {assignee.photo ? <img src={assignee.photo} alt="" /> : assignee.name?.charAt(0).toUpperCase()}
              </div>
            )}
            {pmPerson && (
              <div className={`task-bar__avatar${assignee ? ' task-bar__avatar--second' : ''}`}
                style={{ background: getAvatarColor(pmPerson.email || pmPerson.name), zIndex: 1, borderRadius: '5px' }}>
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
                  <div className="timeline__bulk-dropdown-avatar" style={{ background: getAvatarColor(p.email || p.name) }}>
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
                  <div className="timeline__bulk-dropdown-avatar" style={{ background: getAvatarColor(p.email || p.name) }}>
                    {p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name?.charAt(0).toUpperCase()}
                  </div>
                  {p.name} <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>{p.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Phases */}
        {boardPhases && boardPhases.length > 0 && (
          <div className="timeline__bulk-action-wrap">
            <button className="timeline__bulk-btn" onClick={() => setBulkAssignOpen(bulkAssignOpen === 'phases' ? null : 'phases')}>
              Phases
            </button>
            {bulkAssignOpen === 'phases' && (
              <div className="timeline__bulk-dropdown">
                {boardPhases.map(bp => {
                  const selected = [...selectedTaskIds].map(id => tasks.find(t => t.id === id)).filter(Boolean)
                  const allHave  = selected.every(t => {
                    const ph = t.phases && t.phases.length > 0 ? t.phases : bulkDefaultPhases(t)
                    return ph.some(p => p.id === bp.id)
                  })
                  const noneHave = selected.every(t => {
                    const ph = t.phases && t.phases.length > 0 ? t.phases : bulkDefaultPhases(t)
                    return !ph.some(p => p.id === bp.id)
                  })
                  return (
                    <div key={bp.id} className="timeline__bulk-dropdown-item" onClick={() => handleBulkTogglePhase(bp.id)}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: bp.color, display: 'inline-block', flexShrink: 0, marginRight: 6 }} />
                      {bp.name}
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: '#9ca3af', paddingLeft: 8 }}>
                        {allHave ? '✓ all' : noneHave ? '' : 'partial'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Color */}
        <div className="timeline__bulk-action-wrap">
          <button className="timeline__bulk-btn" onClick={() => setBulkAssignOpen(bulkAssignOpen === 'color' ? null : 'color')}>
            Color
          </button>
          {bulkAssignOpen === 'color' && (
            <div className="timeline__bulk-dropdown" style={{ padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#6b7280', marginRight: 4 }}>Pick color:</span>
              {[{ value: 'white', hex: '#ffffff', label: 'White' }, { value: 'gray', hex: '#eeeeee', label: 'Gray' }].map(c => (
                <button key={c.value} type="button" title={c.label}
                  style={{ width: 26, height: 26, borderRadius: '50%', background: c.hex, border: '2px solid #ddd', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                  onClick={() => handleBulkSetColor(c.value)}
                />
              ))}
            </div>
          )}
        </div>

        <button className="timeline__bulk-btn timeline__bulk-btn--delete" onClick={handleBulkDelete}>Delete</button>
        <button className="timeline__bulk-close" onClick={() => { setSelectedTaskIds(new Set()); setBulkAssignOpen(null) }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
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

                  {/* Fill remaining vertical space so the border extends to the bottom */}
                  <div className="timeline__group-fill-row">
                    <div className="timeline__person-col timeline__person-col--fill" style={{ width: PERSON_COL_W }} />
                    <div className="timeline__grid-area timeline__grid-area--fill" />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {renderDragOverlay()}
      {renderSelectionBox()}
      {renderBulkBar()}
      {loading && (
        <div className="timeline-loading">
          <div className="timeline-loading__spinner" />
          <div className="timeline-loading__text">Loading tasks…</div>
        </div>
      )}
    </>
  )
})

export default Timeline
