import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import {
  getDaysInRange, groupDaysByMonth, isWeekend, startOfDay, diffDays,
  getTotalRange, getYearRange, getQuarterRange,
  MONTHS_SHORT, getQuarterForMonth,
  assignLanes, getLaneCount,
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

// dayWidth = containerWidth / VIEW_DAYS (fits exactly in screen)
const VIEW_DAYS_YEAR    = 365
const VIEW_DAYS_QUARTER = 91

const Timeline = forwardRef(function Timeline({
  viewMode, year, quarter,
  people, teams, tasks,
  filterPersonIds, filterTeamIds,
  onUpdateTask, onDeleteTask, onAddTaskForPerson,
  readOnly,
  onViewChange, // (year, quarter) — called when today btn needs to update parent
}, ref) {
  const scrollRef    = useRef(null)
  const containerRef = useRef(null)
  const rowRefsMap   = useRef({}) // personId → DOM element

  const [containerW, setContainerW] = useState(0)

  // Total fixed range: currentYear-2 to currentYear+2
  const totalRange  = getTotalRange(year)
  const totalStart  = totalRange.start
  const totalEnd    = totalRange.end
  const totalDays   = getDaysInRange(totalStart, totalEnd)
  const allDays     = totalDays // array

  // dayWidth: how many px per day so that the current view fills the container
  const viewDays  = viewMode === 'year' ? VIEW_DAYS_YEAR : VIEW_DAYS_QUARTER
  const dayWidth  = containerW > 0 ? (containerW - PERSON_COL_W) / viewDays : 0
  const totalW    = dayWidth * allDays.length

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

  // Expose scrollToToday + scrollToDate to parent via ref
  useImperativeHandle(ref, () => ({ scrollToToday, scrollToDate }), [scrollToToday, scrollToDate])

  // On dayWidth change or view change → scroll to start of current view
  useEffect(() => {
    if (dayWidth <= 0) return
    const { start } = viewMode === 'year'
      ? getYearRange(year)
      : getQuarterRange(year, quarter)
    scrollToDate(start)
  }, [dayWidth, viewMode, year, quarter]) // eslint-disable-line

  // ── Today position ────────────────────────────────────────────────────────
  const today      = startOfDay(new Date())
  const todayIdx   = diffDays(startOfDay(totalStart), today)
  const todayX     = todayIdx >= 0 && todayIdx < allDays.length
    ? PERSON_COL_W + todayIdx * dayWidth + dayWidth / 2
    : null

  // ── Filtered people ───────────────────────────────────────────────────────
  const visiblePeople = people.filter((p) => {
    if (filterPersonIds.length > 0 && !filterPersonIds.includes(p.id)) return false
    if (filterTeamIds.length  > 0 && !filterTeamIds.includes(p.teamId))  return false
    return true
  })

  // Include "Unassigned" pseudo-row if any tasks have no assignee
  const unassignedTasks = tasks.filter((t) => !t.assigneeId || !people.find((p) => p.id === t.assigneeId))

  // ── Drag-between-assignees: resolve new assigneeId from clientY ───────────
  const resolveAssigneeFromY = (clientY) => {
    for (const [personId, el] of Object.entries(rowRefsMap.current)) {
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientY >= rect.top && clientY <= rect.bottom) return personId
    }
    return null
  }

  const handleDragEnd = (taskId, currentAssigneeId, updates, clientY) => {
    const newAssigneeId = resolveAssigneeFromY(clientY)
    const finalUpdates = { ...updates }
    if (newAssigneeId && newAssigneeId !== currentAssigneeId) {
      finalUpdates.assigneeId = newAssigneeId === '__unassigned__' ? null : newAssigneeId
    }
    onUpdateTask(taskId, finalUpdates)
  }

  // ── Month groups (for header rendering) ──────────────────────────────────
  const monthGroups = groupDaysByMonth(allDays)

  // ── Render a person's task row ────────────────────────────────────────────
  const renderPersonRow = (person, rowTasks, isUnassigned = false) => {
    const personId    = person ? person.id : '__unassigned__'
    const personName  = person ? person.name : 'Unassigned'
    const personColor = person ? (person.color || getAvatarColor(person.name)) : '#9ca3af'
    const team        = person ? teams.find((t) => t.id === person.teamId) : null

    const laned    = assignLanes(rowTasks)
    const numLanes = getLaneCount(rowTasks)
    const rowH     = ROW_PAD_TOP + numLanes * LANE_H + (numLanes - 1) * LANE_GAP + ROW_PAD_BOT

    return (
      <div
        key={personId}
        className={`timeline__person-row${isUnassigned ? ' timeline__person-row--unassigned' : ''}`}
        ref={(el) => { rowRefsMap.current[personId] = el }}
        data-person-id={personId}
        style={{ minHeight: rowH }}
      >
        {/* Sticky left column */}
        <div className="timeline__person-col" style={{ minHeight: rowH }}>
          <div
            className={`timeline__avatar${isUnassigned ? '' : ''}`}
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
          {laned.map((task) => (
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
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="timeline" ref={containerRef}>
      <div
        className="timeline__scroll"
        ref={scrollRef}
        style={{ '--person-col-w': `${PERSON_COL_W}px` }}
      >
        <div className="timeline__inner" style={{ width: PERSON_COL_W + totalW }}>

          {/* ── Sticky header ──────────────────────────────────────────── */}
          <div className="timeline__header">
            <div className="timeline__header-rows">

              {/* Year view: quarter bar */}
              {viewMode === 'year' && (
                <div className="timeline__quarter-row">
                  {[1,2,3,4].map((q) => {
                    const qDays = allDays.filter((d) => getQuarterForMonth(d.getMonth()) === q && d.getFullYear() === year)
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
                {monthGroups.map((mg, i) => (
                  <div key={i} className="timeline__month-cell" style={{ width: mg.days.length * dayWidth }}>
                    {MONTHS_SHORT[mg.month]} {mg.year}
                  </div>
                ))}
              </div>

              {/* Day row — quarter view only */}
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

            {/* Sticky left column header */}
            <div className="timeline__col-header">Team</div>
          </div>

          {/* ── Body ───────────────────────────────────────────────────── */}
          <div className="timeline__body">

            {/* Weekend shading */}
            <div className="timeline__weekends" style={{ left: PERSON_COL_W }}>
              {allDays.map((d, i) => isWeekend(d) ? (
                <div key={i} className="timeline__weekend-col" style={{ left: i * dayWidth, width: dayWidth }} />
              ) : null)}
            </div>

            {/* Month boundary lines */}
            <div className="timeline__gridlines" style={{ left: PERSON_COL_W }}>
              {monthGroups.map((mg, i) => {
                const x = allDays.findIndex((d) => d.getMonth() === mg.month && d.getFullYear() === mg.year) * dayWidth
                return <div key={i} className="timeline__gridline timeline__month-line" style={{ left: x }} />
              })}
            </div>

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
              <div className="timeline__empty">No people added yet. Use the Add button to get started.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

export default Timeline
