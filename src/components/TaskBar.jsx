import { useRef, useState } from 'react'
import { startOfDay, addDays, diffDays, formatDateShort, isWeekend, nextWorkday, prevWorkday, toDateString, getAvatarColor } from '../utils/dateUtils'

const BAR_H = 34
const NARROW_W = 68 // below this, show text outside the bar

export default function TaskBar({
  task, totalStart, dayWidth, laneIndex,
  rowPaddingTop, laneHeight, laneGap,
  people, teams,
  onDelete, onResizeDone, onMoveDragStart, onEdit,
  isGhost,
  readOnly,
}) {
  const [resizing, setResizing]   = useState(false)
  const [visual,   setVisual]     = useState(null)
  const [showMenu, setShowMenu]   = useState(false)
  const barRef  = useRef(null)
  const dragRef = useRef(null)

  const snapWorkday = (date, forward = true) =>
    !isWeekend(date) ? date : forward ? nextWorkday(date) : prevWorkday(date)

  const dateToX = (date) =>
    diffDays(startOfDay(totalStart), startOfDay(new Date(date))) * dayWidth

  // ── Resize drag (left/right handles) — stays internal ─────────────────────
  const startResize = (e, type) => {
    if (readOnly) return
    e.preventDefault(); e.stopPropagation()
    const origStart = new Date(task.startDate)
    const origEnd   = new Date(task.endDate)
    const startX    = e.clientX
    dragRef.current = { type, startX, origStart, origEnd, curStart: origStart, curEnd: origEnd }
    setResizing(true)
    setVisual({ startDate: origStart, endDate: origEnd })

    const onMove = (me) => {
      const daysDelta = Math.round((me.clientX - startX) / dayWidth)
      let ns = origStart, ne = origEnd
      if (type === 'left') {
        ns = snapWorkday(addDays(origStart, daysDelta), true)
        if (ns >= origEnd) ns = snapWorkday(addDays(origEnd, -1), false)
        ne = origEnd
      } else {
        ne = snapWorkday(addDays(origEnd, daysDelta), false)
        if (ne <= origStart) ne = snapWorkday(addDays(origStart, 1), true)
        ns = origStart
      }
      dragRef.current.curStart = ns
      dragRef.current.curEnd   = ne
      setVisual({ startDate: ns, endDate: ne })
    }

    const onUp = () => {
      const ds = dragRef.current
      if (ds) {
        const updates = {
          startDate: toDateString(ds.curStart),
          endDate:   toDateString(ds.curEnd),
        }
        if (onResizeDone) onResizeDone(updates)
      }
      setResizing(false); setVisual(null); dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Move drag — report to parent (Timeline handles overlay) ───────────────
  const handleMoveDown = (e) => {
    if (readOnly || isGhost) return
    e.preventDefault(); e.stopPropagation()
    if (onMoveDragStart && barRef.current) {
      onMoveDragStart(task, e, barRef.current.getBoundingClientRect())
    }
  }

  const dispStart = visual ? visual.startDate : new Date(task.startDate)
  const dispEnd   = visual ? visual.endDate   : new Date(task.endDate)
  const x = dateToX(dispStart)
  const w = Math.max(dayWidth, (diffDays(startOfDay(dispStart), startOfDay(dispEnd)) + 1) * dayWidth)
  const y = rowPaddingTop + laneIndex * (laneHeight + laneGap)

  const taskColor  = task.color || '#6366f1'
  const assignee   = people.find((p) => p.id === task.assigneeId)
  const pmTeam     = teams.find((t)  => t.id === task.teamId)
  const assigneeColor = assignee ? (assignee.color || getAvatarColor(assignee.name)) : '#9ca3af'
  const isNarrow   = w < NARROW_W

  return (
    <div
      ref={barRef}
      className={[
        'task-bar',
        resizing ? 'task-bar--dragging' : '',
        isGhost  ? 'task-bar--ghost'    : '',
      ].filter(Boolean).join(' ')}
      style={{ left: x, top: y, width: w, height: BAR_H }}
    >
      {/* Left resize handle */}
      {!readOnly && !isGhost && (
        <div className="task-bar__handle task-bar__handle--left" onMouseDown={(e) => startResize(e, 'left')}>
          <div className="task-bar__handle-grip" />
        </div>
      )}

      {/* Main bar */}
      <div
        className="task-bar__inner"
        style={{ background: taskColor }}
        onMouseDown={handleMoveDown}
        onContextMenu={(e) => { e.preventDefault(); !readOnly && !isGhost && setShowMenu(true) }}
      >
        {/* Avatar stack */}
        {(assignee || pmTeam) && (
          <div className="task-bar__avatars">
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
        {/* Title inside bar (hidden when narrow) */}
        {!isNarrow && (
          <span className="task-bar__title">{task.title}</span>
        )}
      </div>

      {/* Title outside bar (when too narrow) */}
      {isNarrow && (
        <div
          className="task-bar__outside-title"
          style={{ left: w + 5, color: taskColor }}
        >
          {task.title}
        </div>
      )}

      {/* Right resize handle */}
      {!readOnly && !isGhost && (
        <div className="task-bar__handle task-bar__handle--right" onMouseDown={(e) => startResize(e, 'right')}>
          <div className="task-bar__handle-grip" />
        </div>
      )}

      {/* Date tooltips during resize */}
      {resizing && (
        <>
          <div className="task-bar__tooltip task-bar__tooltip--left">{formatDateShort(dispStart)}</div>
          <div className="task-bar__tooltip task-bar__tooltip--right">{formatDateShort(dispEnd)}</div>
        </>
      )}

      {/* Context menu */}
      {showMenu && (
        <div className="task-bar__menu-overlay" onClick={() => setShowMenu(false)}>
          <div className="task-bar__menu" style={{ top: BAR_H + 4, left: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="task-bar__menu-info">
              <div className="task-bar__menu-task-title">{task.title}</div>
              <div className="task-bar__menu-dates">
                {formatDateShort(new Date(task.startDate))} → {formatDateShort(new Date(task.endDate))}
              </div>
            </div>
            {!readOnly && onEdit && (
              <button className="task-bar__menu-item" onClick={() => { setShowMenu(false); onEdit() }}>
                Edit task
              </button>
            )}
            {!readOnly && (
              <button className="task-bar__menu-item task-bar__menu-item--delete" onClick={() => { onDelete(); setShowMenu(false) }}>
                Delete task
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
