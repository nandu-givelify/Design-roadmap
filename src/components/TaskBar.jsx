import { useRef, useState } from 'react'
import { startOfDay, addDays, diffDays, formatDateShort, isWeekend, nextWorkday, prevWorkday, toDateString, getAvatarColor } from '../utils/dateUtils'

const BAR_H = 32

export default function TaskBar({
  task, totalStart, dayWidth, laneIndex,
  rowPaddingTop, laneHeight, laneGap,
  people, teams,
  onDelete, onDragEnd,
  readOnly,
}) {
  const [dragging, setDragging] = useState(false)
  const [visual, setVisual] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const dragRef = useRef(null)

  const snapWorkday = (date, forward = true) =>
    !isWeekend(date) ? date : forward ? nextWorkday(date) : prevWorkday(date)

  const dateToX = (date) =>
    diffDays(startOfDay(totalStart), startOfDay(new Date(date))) * dayWidth

  const startDrag = (e, type) => {
    if (readOnly) return
    e.preventDefault(); e.stopPropagation()
    const origStart = new Date(task.startDate)
    const origEnd   = new Date(task.endDate)
    const startX = e.clientX
    dragRef.current = { type, startX, origStart, origEnd, curStart: origStart, curEnd: origEnd }
    setDragging(true)
    setVisual({ startDate: origStart, endDate: origEnd })

    const onMove = (me) => {
      const daysDelta = Math.round((me.clientX - startX) / dayWidth)
      const { type, origStart, origEnd } = dragRef.current
      let ns = dragRef.current.curStart
      let ne = dragRef.current.curEnd
      if (type === 'move') {
        ns = snapWorkday(addDays(origStart, daysDelta), daysDelta >= 0)
        ne = snapWorkday(addDays(origEnd,   daysDelta), daysDelta >= 0)
      } else if (type === 'left') {
        ns = snapWorkday(addDays(origStart, daysDelta), true)
        if (ns >= origEnd) ns = snapWorkday(addDays(origEnd, -1), false)
        ne = origEnd
      } else if (type === 'right') {
        ne = snapWorkday(addDays(origEnd, daysDelta), false)
        if (ne <= origStart) ne = snapWorkday(addDays(origStart, 1), true)
        ns = origStart
      }
      dragRef.current.curStart = ns
      dragRef.current.curEnd   = ne
      setVisual({ startDate: new Date(ns), endDate: new Date(ne) })
    }

    const onUp = (ue) => {
      const ds = dragRef.current
      if (ds) {
        const updates = {}
        if (ds.type === 'move' || ds.type === 'left')  updates.startDate = toDateString(ds.curStart)
        if (ds.type === 'move' || ds.type === 'right') updates.endDate   = toDateString(ds.curEnd)
        onDragEnd(updates, ue.clientY)
      }
      setDragging(false); setVisual(null); dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const dispStart = visual ? visual.startDate : new Date(task.startDate)
  const dispEnd   = visual ? visual.endDate   : new Date(task.endDate)
  const x = dateToX(dispStart)
  const w = Math.max(dayWidth, (diffDays(startOfDay(dispStart), startOfDay(dispEnd)) + 1) * dayWidth)
  const y = rowPaddingTop + laneIndex * (laneHeight + laneGap)

  const taskColor     = task.color || '#6366f1'
  const assignee      = people.find((p) => p.id === task.assigneeId)
  const team          = teams.find((t)  => t.id === task.teamId)
  const assigneeColor = assignee ? (assignee.color || getAvatarColor(assignee.name)) : '#9ca3af'

  return (
    <div
      className={`task-bar${dragging ? ' task-bar--dragging' : ''}`}
      style={{ left: x, top: y, width: w, height: BAR_H }}
    >
      {!readOnly && (
        <div className="task-bar__handle task-bar__handle--left" onMouseDown={(e) => startDrag(e, 'left')}>
          <div className="task-bar__handle-grip" />
        </div>
      )}

      <div
        className="task-bar__inner"
        style={{ background: taskColor }}
        onMouseDown={(e) => startDrag(e, 'move')}
        onDoubleClick={() => !readOnly && setShowMenu(true)}
        onContextMenu={(e) => { e.preventDefault(); !readOnly && setShowMenu(true) }}
      >
        {assignee && (
          <div className="task-bar__assignee-avatar" style={{ background: assigneeColor }}>
            {assignee.photo ? <img src={assignee.photo} alt="" /> : assignee.name?.charAt(0).toUpperCase()}
          </div>
        )}
        {team && (
          <div className="task-bar__team-avatar">
            {team.photo ? <img src={team.photo} alt="" /> : team.name?.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="task-bar__title">{task.title}</span>
      </div>

      {!readOnly && (
        <div className="task-bar__handle task-bar__handle--right" onMouseDown={(e) => startDrag(e, 'right')}>
          <div className="task-bar__handle-grip" />
        </div>
      )}

      {dragging && (
        <>
          <div className="task-bar__tooltip task-bar__tooltip--left">{formatDateShort(dispStart)}</div>
          <div className="task-bar__tooltip task-bar__tooltip--right">{formatDateShort(dispEnd)}</div>
        </>
      )}

      {showMenu && (
        <div className="task-bar__menu-overlay" onClick={() => setShowMenu(false)}>
          <div className="task-bar__menu" style={{ top: BAR_H + 4, left: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="task-bar__menu-info">
              <div className="task-bar__menu-task-title">{task.title}</div>
              <div className="task-bar__menu-dates">
                {formatDateShort(new Date(task.startDate))} → {formatDateShort(new Date(task.endDate))}
              </div>
            </div>
            <button
              className="task-bar__menu-item task-bar__menu-item--delete"
              onClick={() => { onDelete(); setShowMenu(false) }}
            >
              Delete task
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
