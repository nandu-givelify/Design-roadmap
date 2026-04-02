import { useRef, useEffect, useState, useCallback, forwardRef } from 'react'
import {
  getDaysInRange, groupDaysByMonth, isWeekend, startOfDay, diffDays,
  addDays, formatDateShort, MONTHS_SHORT, getQuarterForMonth,
  isTaskInRange, toDateString, nextWorkday, prevWorkday
} from '../utils/dateUtils'
import TaskBar from './TaskBar'

const ROW_HEIGHT = 56
const HEADER_MONTH_H = 28
const HEADER_DAY_H = 24
const PERSON_COL_W = 180
const LEFT_OFFSET = PERSON_COL_W

const Timeline = forwardRef(function Timeline({
  viewMode, year, quarter, rangeStart, rangeEnd,
  people, teams, tasks,
  filterPersonIds, filterTeamIds,
  onUpdateTask, onDeleteTask, onAddTaskForPerson,
  readOnly,
}) {
  const containerRef = useRef(null)
  const scrollRef = useRef(null)
  const [dayWidth, setDayWidth] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const todayRef = useRef(null)

  const days = getDaysInRange(rangeStart, rangeEnd)
  const monthGroups = groupDaysByMonth(days)
  const totalDays = days.length

  // Responsive day width
  useEffect(() => {
    const updateWidth = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth - LEFT_OFFSET
      setContainerWidth(containerRef.current.clientWidth)
      const minDayW = viewMode === 'year' ? 22 : 36
      setDayWidth(Math.max(minDayW, Math.floor(w / totalDays)))
    }
    updateWidth()
    const ro = new ResizeObserver(updateWidth)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [totalDays, viewMode])

  const totalW = dayWidth * totalDays

  // Scroll to today
  const scrollToToday = useCallback(() => {
    if (!scrollRef.current || !dayWidth) return
    const today = startOfDay(new Date())
    const rs = startOfDay(rangeStart)
    const diff = diffDays(rs, today)
    if (diff < 0 || diff > totalDays) return
    const x = diff * dayWidth - containerWidth / 2 + LEFT_OFFSET + dayWidth / 2
    scrollRef.current.scrollLeft = Math.max(0, x)
  }, [dayWidth, rangeStart, totalDays, containerWidth])

  useEffect(() => {
    if (dayWidth > 0) setTimeout(scrollToToday, 50)
  }, [dayWidth, scrollToToday])

  // Expose scrollToToday via ref on container
  useEffect(() => {
    if (containerRef.current) containerRef.current.__scrollToToday = scrollToToday
  }, [scrollToToday])

  // Today marker position
  const today = startOfDay(new Date())
  const todayDiff = diffDays(startOfDay(rangeStart), today)
  const todayX = todayDiff >= 0 && todayDiff <= totalDays
    ? LEFT_OFFSET + todayDiff * dayWidth + dayWidth / 2
    : null

  // Filter people
  const visiblePeople = people.filter((p) => {
    if (filterPersonIds.length > 0 && !filterPersonIds.includes(p.id)) return false
    if (filterTeamIds.length > 0 && !filterTeamIds.includes(p.teamId)) return false
    return true
  })

  // Sort tasks for a person: active in range first, inactive at bottom
  const getPersonTasks = (personId) => {
    const mine = tasks.filter((t) => t.assigneeId === personId)
    const active = mine.filter((t) => isTaskInRange(t, rangeStart, rangeEnd))
    const inactive = mine.filter((t) => !isTaskInRange(t, rangeStart, rangeEnd))
    return { active, inactive }
  }

  const taskXOffset = (task) => {
    const ts = startOfDay(new Date(task.startDate))
    const rs = startOfDay(rangeStart)
    const d = diffDays(rs, ts)
    return LEFT_OFFSET + Math.max(0, d) * dayWidth
  }

  const taskWidth = (task) => {
    const ts = startOfDay(new Date(task.startDate))
    const te = startOfDay(new Date(task.endDate))
    const rs = startOfDay(rangeStart)
    const re = startOfDay(rangeEnd)
    const clampedStart = ts < rs ? rs : ts
    const clampedEnd = te > re ? re : te
    return (diffDays(clampedStart, clampedEnd) + 1) * dayWidth
  }

  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Scrollable area */}
      <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }}>
        <div style={{ minWidth: LEFT_OFFSET + totalW, position: 'relative' }}>

          {/* ── Sticky Header ─────────────────────────────────────────── */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 30,
            background: '#fff', borderBottom: '1px solid #e5e7eb'
          }}>
            {/* Year view: Quarter bar */}
            {viewMode === 'year' && (
              <div style={{ display: 'flex', marginLeft: LEFT_OFFSET, height: 22 }}>
                {[1,2,3,4].map((q) => {
                  const qDays = days.filter((d) => getQuarterForMonth(d.getMonth()) === q)
                  if (!qDays.length) return null
                  return (
                    <div key={q} style={{
                      width: qDays.length * dayWidth,
                      borderRight: '1px solid #d1d5db',
                      background: q % 2 === 0 ? '#f9fafb' : '#fff',
                      display: 'flex', alignItems: 'center',
                      paddingLeft: 6, fontSize: 11, fontWeight: 600,
                      color: '#6b7280', flexShrink: 0
                    }}>
                      Q{q}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Month row */}
            <div style={{ display: 'flex', marginLeft: LEFT_OFFSET, height: HEADER_MONTH_H }}>
              {monthGroups.map((mg, i) => (
                <div key={i} style={{
                  width: mg.days.length * dayWidth,
                  borderRight: '1px solid #e5e7eb',
                  display: 'flex', alignItems: 'center',
                  paddingLeft: 8, fontSize: 12, fontWeight: 600,
                  color: '#374151', flexShrink: 0,
                  background: '#fff'
                }}>
                  {MONTHS_SHORT[mg.month]}{viewMode === 'year' ? '' : ` ${mg.year}`}
                </div>
              ))}
            </div>

            {/* Day row */}
            {viewMode === 'quarter' && (
              <div style={{ display: 'flex', marginLeft: LEFT_OFFSET, height: HEADER_DAY_H }}>
                {days.map((d, i) => {
                  const weekend = isWeekend(d)
                  return (
                    <div key={i} style={{
                      width: dayWidth, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: weekend ? '#d1d5db' : '#6b7280',
                      background: weekend ? '#fafafa' : '#fff',
                      borderRight: '1px solid #f3f4f6',
                    }}>
                      {d.getDate()}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Person col header */}
            <div style={{
              position: 'absolute', left: 0, top: 0,
              width: LEFT_OFFSET,
              height: '100%',
              background: '#fff',
              borderRight: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'flex-end',
              padding: '0 12px 4px',
              fontSize: 11, fontWeight: 600, color: '#9ca3af',
              letterSpacing: '0.05em', textTransform: 'uppercase',
              zIndex: 31
            }}>
              Team
            </div>
          </div>

          {/* ── Body ───────────────────────────────────────────────────── */}
          <div style={{ position: 'relative' }}>
            {/* Weekend column shading */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
              {days.map((d, i) => isWeekend(d) ? (
                <div key={i} style={{
                  position: 'absolute',
                  left: LEFT_OFFSET + i * dayWidth,
                  top: 0, bottom: 0,
                  width: dayWidth,
                  background: 'rgba(243,244,246,0.7)',
                }}/>
              ) : null)}
            </div>

            {/* Day grid lines */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
              {days.map((d, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  left: LEFT_OFFSET + (i + 1) * dayWidth - 1,
                  top: 0, bottom: 0,
                  width: 1,
                  background: '#f3f4f6',
                }} />
              ))}
            </div>

            {/* Today line */}
            {todayX !== null && (
              <div ref={todayRef} style={{
                position: 'absolute',
                left: todayX,
                top: 0, bottom: 0,
                width: 2,
                background: '#ef4444',
                zIndex: 20,
                pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute', top: 0,
                  left: '50%', transform: 'translateX(-50%)',
                  background: '#ef4444', color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  padding: '1px 4px', borderRadius: 2,
                  whiteSpace: 'nowrap',
                }}>TODAY</div>
              </div>
            )}

            {/* Person rows */}
            {visiblePeople.map((person) => {
              const { active, inactive } = getPersonTasks(person.id)
              const team = teams.find((t) => t.id === person.teamId)
              const allTasks = [...active, ...inactive]
              const rowCount = Math.max(1, active.length) // inactive shown as mini badges below

              return (
                <div key={person.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {/* Person label */}
                  <div style={{
                    position: 'relative',
                    minHeight: ROW_HEIGHT + (inactive.length > 0 ? 28 : 0),
                  }}>
                    {/* Sticky person info */}
                    <div style={{
                      position: 'sticky', left: 0,
                      width: LEFT_OFFSET, zIndex: 10,
                      background: '#fff',
                      borderRight: '1px solid #e5e7eb',
                      display: 'flex', alignItems: 'flex-start',
                      padding: '10px 10px',
                      gap: 8,
                      minHeight: ROW_HEIGHT + (inactive.length > 0 ? 28 : 0),
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: person.color || '#6366f1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: '#fff',
                        flexShrink: 0, overflow: 'hidden',
                      }}>
                        {person.photo
                          ? <img src={person.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                          : person.name?.charAt(0).toUpperCase()
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.2 }}>
                          {person.name}
                        </div>
                        {team && (
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{team.name}</div>
                        )}
                        {!readOnly && (
                          <button
                            onClick={() => onAddTaskForPerson(person.id)}
                            style={{
                              marginTop: 4, background: 'none', border: '1px dashed #d1d5db',
                              borderRadius: 4, padding: '1px 6px', fontSize: 10,
                              color: '#6b7280', cursor: 'pointer',
                            }}
                            onMouseEnter={e => e.target.style.borderColor = '#6366f1'}
                            onMouseLeave={e => e.target.style.borderColor = '#d1d5db'}
                          >+ task</button>
                        )}
                      </div>
                    </div>

                    {/* Active task bars */}
                    {active.map((task, ti) => (
                      <TaskBar
                        key={task.id}
                        task={task}
                        xOffset={taskXOffset(task)}
                        width={taskWidth(task)}
                        yOffset={8 + ti * (ROW_HEIGHT - 16)}
                        dayWidth={dayWidth}
                        rangeStart={rangeStart}
                        rangeEnd={rangeEnd}
                        days={days}
                        onUpdate={(updates) => !readOnly && onUpdateTask(task.id, updates)}
                        onDelete={() => !readOnly && onDeleteTask(task.id)}
                        readOnly={readOnly}
                        viewMode={viewMode}
                      />
                    ))}

                    {/* Inactive tasks — bottom strip */}
                    {inactive.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        left: LEFT_OFFSET + 8, bottom: 4,
                        display: 'flex', gap: 4, flexWrap: 'wrap',
                      }}>
                        <span style={{ fontSize: 10, color: '#9ca3af', alignSelf: 'center' }}>Outside range:</span>
                        {inactive.map((task) => (
                          <div key={task.id} style={{
                            background: task.color || '#e5e7eb',
                            color: '#fff', fontSize: 10, padding: '1px 6px',
                            borderRadius: 10, opacity: 0.6,
                          }}>
                            {task.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {visiblePeople.length === 0 && (
              <div style={{
                padding: '60px 0', textAlign: 'center',
                color: '#9ca3af', fontSize: 14,
              }}>
                No people to display. Add people to get started.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

export default Timeline
