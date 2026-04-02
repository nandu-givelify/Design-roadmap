import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import {
  getDaysInRange, groupDaysByMonth, isWeekend, startOfDay, diffDays,
  getTotalRange, getYearRange, getQuarterRange,
  MONTHS_SHORT, getQuarterForMonth,
  getAvatarColor,
} from '../utils/dateUtils'
import TaskBar from './TaskBar'

// ── Layout constants ────────────────────────────────────────────────────────
const PERSON_COL_W = 200
const LANE_H       = 34
const LANE_GAP     = 6
const ROW_PAD_TOP  = 10
const ROW_PAD_BOT  = 10
const MIN_ROW_H    = ROW_PAD_TOP + LANE_H + ROW_PAD_BOT

const VIEW_DAYS_YEAR    = 365
const VIEW_DAYS_QUARTER = 91

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
  const [dropTarget, setDropTarget] = useState(null)

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
      setContainerW(containerRef.current?.clientWidth || 0)
    })
    ro.observe(containerRef.current)
    setContainerW(containerRef.current.clientWidth)
    return () => ro.disconnect()
  }, [])

  // ── Scroll helpers ────────────────────────────────────────────────────────
  const scrollToDate = useCallback((date) => {
    if (!scrollRef.current || dayWidth <= 0) return
    const idx = diffDays(startOfDay(totalStart), startOfDay(date))
    scrollRef.current.scrollLeft = Math.max(0, idx * dayWidth)
  }, [dayWidth, totalStart])

  const scrollToToday = useCallback(() => {
    scrollToDate(new Date())
  }, [scrollToDate])

  useImperativeHandle(ref, () => ({ scrollToToday, scrollToDate }), [scrollToToday, scrollToDate])

  // Scroll to start of view whenever dayWidth or view changes
  useEffect(() => {
    if (dayWidth <= 0) return
    const { start } = viewMode === 'year'
      ? getYearRange(year)
      : getQuarterRange(year, quarter)
    scrollToDate(start)
  }, [dayWidth, viewMode, year, quarter]) // eslint-disable-line

  // ── Today position ────────────────────────────────────────────────────────
  const today    = startOfDay(new Date())
  const todayIdx = diffDays(startOfDay(totalStart), today)
  const todayX   = todayIdx >= 0 && todayIdx < allDays.length
    ? PERSON_COL_W + todayIdx * dayWidth + dayWidth / 2
    : null

  // ── Filtered people (OR logic when both person + team filters active) ─────
  const visiblePeople = people.filter((p) => {
    const noFilter = filterPersonIds.length === 0 && filterTeamIds.length === 0
    if (noFilter) return true
    if (filterPersonIds.length > 0 && filterTeamIds.length > 0) {
      // OR: show person if they match either filter
      return filterPersonIds.includes(p.id) || filterTeamIds.includes(p.teamId)
    }
    if (filterPersonIds.length > 0) return filterPersonIds.includes(p.id)
    if (filterTeamIds.length > 0)   return filterTeamIds.includes(p.teamId)
    return true
  })

  // Tasks with no valid assignee
  const unassignedTasks = tasks.filter(
    (t) => !t.assigneeId || !people.find((p) => p.id === t.assigneeId)
  )

  // ── Drag helpers ──────────────────────────────────────────────────────────
  const resolveAssigneeFromY = (clientY) => {
    for (const [personId, el] of Object.entries(rowRefsMap.current)) {
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientY >= rect.top && clientY <= rect.bottom) return personId
    }
    return null
  }

  const handleDragMove = useCallback((clientY) => {
    setDropTarget(resolveAssigneeFromY(clientY))
  }, []) // eslint-disable-line

  const handleDragEnd = (taskId, currentAssigneeId, updates, clientY) => {
    const newAssigneeId = resolveAssigneeFromY(clientY)
    const finalUpdates = { ...updates }
    if (newAssigneeId && newAssigneeId !== currentAssigneeId) {
      finalUpdates.assigneeId = newAssigneeId === '__unassigned__' ? null : newAssigneeId
    }
    onUpdateTask(taskId, finalUpdates)
    setDropTarget(null)
  }

  // ── Month groups ──────────────────────────────────────────────────────────
  const monthGroups = groupDaysByMonth(allDays)

  // ── Render a person's task row ────────────────────────────────────────────
  const renderPersonRow = (person, rowTasks, isUnassigned = false) => {
    const personId    = person ? person.id : '__unassigned__'
    const personName  = person ? person.name : 'Unassigned'
    const personColor = person ? (person.color || getAvatarColor(person.name)) : '#9ca3af'
    const team        = person ? teams.find((t) => t.id === person.teamId) : null

    // Sort by start date; each task gets its own row (no overlap packing)
    const sorted = [...rowTasks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))

    // Separate tasks outside the renderable range
    const pastTasks    = sorted.filter((t) => new Date(t.endDate)   < totalStart)
    const futureTasks  = sorted.filter((t) => new Date(t.startDate) > totalEnd)
    const inRangeTasks = sorted.filter(
      (t) => !(new Date(t.endDate) < totalStart) && !(new Date(t.startDate) > totalEnd)
    )

    // Assign a lane index to each in-range task
    const lanedTasks = inRangeTasks.map((t, i) => ({ ...t, _lane: i }))

    const numVisible = inRangeTasks.length
    const rowH = numVisible > 0
      ? ROW_PAD_TOP + numVisible * LANE_H + (numVisible - 1) * LANE_GAP + ROW_PAD_BOT
      : MIN_ROW_H

    const isDropTgt = dropTarget === personId

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
            {team && <div className="timeline__person-team">{team.name}</div>}
            {!readOnly && person && (
              <button className="timeline__add-task-btn" onClick={() => onAddTaskForPerson(personId)}>
                + task
              </button>
            )}
          </div>
        </div>

        {/* Grid area with task bars */}
        <div className="timeline__grid-area" style={{ minHeight: rowH }}>
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
              teams={teams}
              onDelete={() => onDeleteTask(task.id)}
              onDragEnd={(updates, clientY) => handleDragEnd(task.id, task.assigneeId, updates, clientY)}
              onDragMove={handleDragMove}
              onEdit={() => onEditTask && onEditTask(task)}
              readOnly={readOnly}
            />
          ))}

          {/* Outside-range indicator chips */}
          {(pastTasks.length > 0 || futureTasks.length > 0) && (
            <div className="timeline__out-chips">
              {pastTasks.length > 0 && (
                <div
                  className="timeline__out-chip timeline__out-chip--past"
                  style={{ background: pastTasks[0].color || '#6366f1' }}
                  title={pastTasks.map((t) => t.title).join(', ')}
                >
                  ← {pastTasks.length}
                </div>
              )}
              {futureTasks.length > 0 && (
                <div
                  className="timeline__out-chip timeline__out-chip--future"
                  style={{ background: futureTasks[0].color || '#6366f1' }}
                  title={futureTasks.map((t) => t.title).join(', ')}
                >
                  {futureTasks.length} →
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="timeline" ref={containerRef}>
      <div
        className="timeline__scroll"
        ref={scrollRef}
        style={{ '--pcol': `${PERSON_COL_W}px` }}
      >
        <div className="timeline__inner" style={{ width: PERSON_COL_W + totalW }}>

          {/* ── Sticky header ────────────────────────────────────────────── */}
          <div className="timeline__header">
            {/* Person col header — sticky left */}
            <div className="timeline__header-person-col">Team</div>

            {/* Date rows — scrolls with content */}
            <div className="timeline__header-grid">
              {/* Quarter row (year view only) */}
              {viewMode === 'year' && (
                <div className="timeline__quarter-row">
                  {[1, 2, 3, 4].map((q) => {
                    const qDays = allDays.filter(
                      (d) => getQuarterForMonth(d.getMonth()) === q && d.getFullYear() === year
                    )
                    if (!qDays.length) return null
                    return (
                      <div
                        key={q}
                        className={`timeline__quarter-cell${q % 2 === 0 ? ' timeline__quarter-cell--even' : ''}`}
                        style={{ width: qDays.length * dayWidth }}
                      >
                        Q{q} {year}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Month row */}
              <div className="timeline__month-row">
                {monthGroups.map((mg, i) => {
                  // Year view: only show year on January; other views show month + year
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

              {/* Day row (quarter view only) */}
              {viewMode === 'quarter' && (
                <div className="timeline__day-row">
                  {allDays.map((d, i) => (
                    <div
                      key={i}
                      className={`timeline__day-cell${isWeekend(d) ? ' timeline__day-cell--weekend' : ''}`}
                      style={{ width: dayWidth }}
                    >
                      {dayWidth >= 18 ? d.getDate() : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Body ─────────────────────────────────────────────────────── */}
          <div className="timeline__body">

            {/* Weekend shading — behind tasks (z-index: 0 in CSS) */}
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
              return (
                <div key={`ml-${i}`} className="timeline__month-line" style={{ left: PERSON_COL_W + x }} />
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
              const rowTasks = tasks.filter((t) => t.assigneeId === person.id)
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
  )
})

export default Timeline
