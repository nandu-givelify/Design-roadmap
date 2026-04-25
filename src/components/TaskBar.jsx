import { useRef, useState, useLayoutEffect } from 'react'
import { startOfDay, addDays, diffDays, formatDateWithDay, isWeekend, nextWorkday, prevWorkday, toDateString, getAvatarColor, parseLocalDate } from '../utils/dateUtils'

const BAR_H = 34

export default function TaskBar({
  task, totalStart, dayWidth, laneIndex,
  rowPaddingTop, laneHeight, laneGap,
  people,
  onDelete, onResizeDone, onMoveDragStart, onEdit,
  isGhost, isSelected,
  readOnly,
}) {
  const [resizing, setResizing] = useState(false)
  const [visual,   setVisual]   = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)

  const barRef         = useRef(null)
  const dragRef        = useRef(null)
  const hiddenTitleRef = useRef(null)

  const snapWorkday = (date, forward = true) =>
    !isWeekend(date) ? date : forward ? nextWorkday(date) : prevWorkday(date)

  const dateToX = (date) =>
    diffDays(startOfDay(totalStart), startOfDay(new Date(date))) * dayWidth

  // Unified people lookup
  const assignee = people.find((p) => p.id === task.assigneeId)
  // PM: look up by pmId; fall back to legacy teamId for migrated tasks
  const pmPerson = people.find((p) => p.id === (task.pmId || task.teamId))
  const assigneeColor = assignee ? (assignee.color || getAvatarColor(assignee.name)) : '#9ca3af'
  const pmColor       = pmPerson ? (pmPerson.color || getAvatarColor(pmPerson.name)) : '#6366f1'

  const dispStart = visual ? visual.startDate : parseLocalDate(task.startDate)
  const dispEnd   = visual ? visual.endDate   : parseLocalDate(task.endDate)
  const x = dateToX(dispStart)
  const w = Math.max(dayWidth, (diffDays(startOfDay(dispStart), startOfDay(dispEnd)) + 1) * dayWidth)
  const y = rowPaddingTop + laneIndex * (laneHeight + laneGap)

  // Clipping detection: move outside when >40% clipped
  useLayoutEffect(() => {
    if (!hiddenTitleRef.current) return
    const naturalW = hiddenTitleRef.current.offsetWidth
    const avatarW  = (assignee ? 24 : 0) + (pmPerson ? 16 : 0) + ((assignee || pmPerson) ? 6 : 0)
    const availW   = w - 8 - avatarW
    setIsNarrow(availW < naturalW * 0.6)
  }, [task.title, w, assignee, pmPerson]) // eslint-disable-line

  // ── Resize drag ────────────────────────────────────────────────────────────
  const startResize = (e, type) => {
    if (readOnly) return
    e.preventDefault(); e.stopPropagation()
    const origStart = parseLocalDate(task.startDate)
    const origEnd   = parseLocalDate(task.endDate)
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
      } else {
        ne = snapWorkday(addDays(origEnd, daysDelta), false)
        if (ne <= origStart) ne = snapWorkday(addDays(origStart, 1), true)
      }
      dragRef.current.curStart = ns
      dragRef.current.curEnd   = ne
      setVisual({ startDate: ns, endDate: ne })
    }

    const onUp = () => {
      const ds = dragRef.current
      if (ds) onResizeDone?.({ startDate: toDateString(ds.curStart), endDate: toDateString(ds.curEnd) })
      setResizing(false); setVisual(null); dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Move drag ─────────────────────────────────────────────────────────────
  const handleMoveDown = (e) => {
    if (readOnly || isGhost) return
    e.preventDefault(); e.stopPropagation()
    if (onMoveDragStart && barRef.current) {
      onMoveDragStart(task, e, barRef.current.getBoundingClientRect())
    }
  }

  const renderAvatars = (outside) => {
    if (!assignee && !pmPerson) return null
    return (
      <div className="task-bar__avatars" style={outside ? {} : {}}>
        {assignee && (
          <div className="task-bar__avatar" style={{ background: assigneeColor, zIndex: 2 }}>
            {assignee.photo ? <img src={assignee.photo} alt="" /> : assignee.name?.charAt(0).toUpperCase()}
          </div>
        )}
        {pmPerson && (
          <div
            className={`task-bar__avatar${assignee ? ' task-bar__avatar--second' : ''}`}
            style={{ background: pmColor, zIndex: 1, borderRadius: '5px' }}
          >
            {pmPerson.photo ? <img src={pmPerson.photo} alt="" /> : pmPerson.name?.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={barRef}
      className={['task-bar', resizing ? 'task-bar--dragging' : '', isGhost ? 'task-bar--ghost' : ''].filter(Boolean).join(' ')}
      style={{ left: x, top: y, width: w, height: BAR_H }}
    >
      {/* Measure natural title width (off-screen) */}
      <span ref={hiddenTitleRef} className="task-bar__title-measure">{task.title}</span>

      {/* Left resize handle */}
      {!readOnly && !isGhost && (
        <div className="task-bar__handle task-bar__handle--left" onMouseDown={(e) => startResize(e, 'left')}>
          <div className="task-bar__handle-grip" />
        </div>
      )}

      {/* Main inner bar */}
      <div
        className={['task-bar__inner', isSelected ? 'task-bar__inner--selected' : ''].filter(Boolean).join(' ')}
        data-task-id={task.id}
        onMouseDown={handleMoveDown}
        onContextMenu={(e) => { e.preventDefault(); !readOnly && !isGhost && setShowMenu(true) }}
      >
        {!isNarrow && renderAvatars(false)}
        {!isNarrow && <span className="task-bar__title">{task.title}</span>}
      </div>

      {/* Outside content when bar is too narrow */}
      {isNarrow && (
        <div className="task-bar__outside-content" style={{ left: w + 5 }}>
          {renderAvatars(true)}
          <span className="task-bar__outside-title">{task.title}</span>
        </div>
      )}

      {/* Right resize handle */}
      {!readOnly && !isGhost && (
        <div className="task-bar__handle task-bar__handle--right" onMouseDown={(e) => startResize(e, 'right')}>
          <div className="task-bar__handle-grip" />
        </div>
      )}

      {/* Resize tooltips */}
      {resizing && (
        w < 260 ? (
          <div className="task-bar__tooltip task-bar__tooltip--center">
            {formatDateWithDay(dispStart)} → {formatDateWithDay(dispEnd)}
          </div>
        ) : (
          <>
            <div className="task-bar__tooltip task-bar__tooltip--left">{formatDateWithDay(dispStart)}</div>
            <div className="task-bar__tooltip task-bar__tooltip--right">{formatDateWithDay(dispEnd)}</div>
          </>
        )
      )}

      {/* Context menu */}
      {showMenu && (
        <div className="task-bar__menu-overlay" onClick={() => setShowMenu(false)}>
          <div className="task-bar__menu" style={{ top: BAR_H + 4, left: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="task-bar__menu-info">
              <div className="task-bar__menu-task-title">{task.title}</div>
              <div className="task-bar__menu-dates">
                {formatDateWithDay(parseLocalDate(task.startDate))} → {formatDateWithDay(parseLocalDate(task.endDate))}
              </div>
            </div>
            {!readOnly && onEdit && (
              <button className="task-bar__menu-item" onClick={() => { setShowMenu(false); onEdit() }}>Edit task</button>
            )}
            {!readOnly && (
              <button className="task-bar__menu-item task-bar__menu-item--delete"
                onClick={() => { onDelete(); setShowMenu(false) }}>Delete task</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
