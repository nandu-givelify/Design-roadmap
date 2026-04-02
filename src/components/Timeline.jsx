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
const LANE_H       = 40
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
  const [scrollLeft, setScrollLeft] = useState(0)    // for viewport-edge badges

  const totalRange = getTotalRange(year)
  const totalStart = totalRange.start
  const totalEnd   = totalRange.end
  const allDays    = getDaysInRange(totalStart, totalEnd)

  const viewDays = viewMode === 'year' ? VIEW_DAYS_YEAR : VIEW_DAYS_QUARTER
  const dayWidth = containerW > 0 ? (containerW - PERSON_COL_W) / viewDays : 0
  const totalW   = dayWidth * allDays.length

  // ── Container width tracking ──────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => {
      const w = containerRef.current?.clientWidth || 0
      setContainerW(w)
      // keep CSS var in sync for sticky/badge positioning
      if (scrollRef.current) {
        scrollRef.current.style.setProperty('--cw', (w - PERSON_COL_W) + 'px')
      }
    })
    ro.observe(containerRef.current)
    setContainerW(containerRef.current.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Scroll listener (lightweight — updates CSS var + throttled React state)
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

  // ── Scroll helpers ────────────────────────────────────────────────────────
  const dateToGridX = useCallback((date) =>
    diffDays(startOfDay(totalStart), startOfDay(parseLocalDate(date))) * dayWidth,
  [dayWidth, totalStart])

  const scrollToDate = useCallback((date) => {
    if (!scrollRef.current || dayWidth <= 0) return
    const idx = diffDays(startOfDay(totalStart), startOfDay(date))
    scrollRef.current.scrollLeft = Math.max(0, idx * dayWidth)
  }, [dayWidth, totalStart])

  // Jump to start of current period (with left-padding buffer)
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

  // Auto-scroll when view/year/quarter changes
  useEffect(() => {
    if (dayWidth <= 0) return
    const { start } = viewMode === 'year'
      ? getYearRange(year)
      : getQuarterRange(year, quarter)
    scrollToDate(addDays(start, -VIEW_PAD_DAYS))
  }, [dayWidth, viewMode, year, quarter]) // eslint-disable-line

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
          // Treat as click → open edit modal
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

  // ── Double-click on empty grid → add task at that date for that person ──────
  const handleGridDoubleClick = useCallback((personId, e) => {
    if (readOnly || !onAddTaskForPerson) return
    // Don't trigger if click landed on an existing task bar
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

  // ── Filter logic (PM = task-based filter) ────────────────────────────────
  // PM filter: show persons who have tasks with matching PM; filter tasks in row
  // Person filter: show only selected persons; show all their tasks
  // Both: show selected persons; show only tasks with matching PM

  const getPmFilteredTasks = (personTasks) =>
    filterTeamIds.length > 0
      ? personTasks.filter((t) => filterTeamIds.includes(t.teamId))
      : personTasks

  let visiblePeople = people
  if (filterPersonIds.length > 0 && filterTeamIds.length === 0) {
    visiblePeople = people.filter((p) => filterPersonIds.includes(p.id))
  } else if (filterTeamIds.length > 0 && filterPersonIds.length === 0) {
    // PM filter only: show persons who have at least one task with that PM
    const personIdsWithMatch = new Set(
      tasks.filter((t) => filterTeamIds.includes(t.teamId)).map((t) => t.assigneeId).filter(Boolean)
    )
    visiblePeople = people.filter((p) => personIdsWithMatch.has(p.id))
  } else if (filterPersonIds.length > 0 && filterTeamIds.length > 0) {
    // Both: AND logic — selected persons AND tasks with matching PM
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

    // Sort by start date; each task = its own lane
    const sorted = [...rowTasks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))

    // Visible scroll window in date space
    const visibleStart = dayWidth > 0
      ? addDays(totalStart, Math.max(0, Math.floor(scrollLeft / dayWidth)))
      : totalStart
    const visibleEnd = dayWidth > 0
      ? addDays(totalStart, Math.ceil((scrollLeft + Math.max(containerW, 1) - PERSON_COL_W) / dayWidth))
      : totalEnd

    // Only tasks whose bars overlap the current scroll viewport AND the total range.
    // Lane indices are assigned within this visible subset so they always start at 0.
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

    // Row height = visible tasks only; shrinks/grows as you scroll
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
        {/* Sticky left column */}
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
            {!readOnly && person && (
              <button className="timeline__add-task-btn" onClick={() => onAddTaskForPerson(personId)}>
                + task
              </button>
            )}
          </div>
        </div>

        {/* Grid area — only render tasks visible in the scroll window; lanes indexed from 0 */}
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

    // Show target person's avatar when dragging to a different row
    const displayAssigneeId = targetAssigneeId || task.assigneeId
    const assignee  = people.find((p) => p.id === displayAssigneeId)
    const pmTeam    = teams.find((t)  => t.id === task.teamId)
    const taskColor = task.color || '#6366f1'
    const assigneeColor = assignee ? (assignee.color || getAvatarColor(assignee.name)) : '#9ca3af'

    // Compute drag date tooltips
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
              <div className="task-bar__avatar task-bar__avatar--second" style={{ background: '#6366f1', zIndex: 1, borderRadius: '5px' }}>
                {pmTeam.photo ? <img src={pmTeam.photo} alt="" /> : pmTeam.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
        <span className="task-drag-overlay__title">{task.title}</span>
        {/* Date tooltips — combined when bar is too narrow for both */}
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

  return (
    <>
      <div className="timeline" ref={containerRef}>
        <div
          className="timeline__scroll"
          ref={scrollRef}
          style={{ '--pcol': `${PERSON_COL_W}px` }}
        >
          <div className="timeline__inner" style={{ width: PERSON_COL_W + totalW }}>

            {/* ── Sticky header ──────────────────────────────────────── */}
            <div className="timeline__header">
              <div className="timeline__header-person-col">Designer</div>
              <div className="timeline__header-grid">
                {/* Month row */}
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
                {/* No day row — removed per user request */}
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

              {/* Month boundary lines — dashed for regular months, solid for quarter starts */}
              {monthGroups.map((mg, i) => {
                const x = allDays.findIndex(
                  (d) => d.getMonth() === mg.month && d.getFullYear() === mg.year
                ) * dayWidth
                // Quarter boundaries: Jan(0), Apr(3), Jul(6), Oct(9)
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

      {/* Floating drag clone — rendered outside scroll container so it can go anywhere */}
      {renderDragOverlay()}
    </>
  )
})

export default Timeline
