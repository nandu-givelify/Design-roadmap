import { useRef, useState, useLayoutEffect } from 'react'
import { startOfDay, addDays, diffDays, formatDateWithDay, isWeekend, nextWorkday, prevWorkday, toDateString, getAvatarColor } from '../utils/dateUtils'

const BAR_H = 34

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
  // isNarrow = title is clipped >50% → move avatars + title outside
  const [isNarrow, setIsNarrow]   = useState(false)

  const barRef        = useRef(null)
  const dragRef       = useRef(null)
  const hiddenTitleRef = useRef(null)  // used only to measure natural text width

  const snapWorkday = (date, forward = true) =>
    !isWeekend(date) ? date : forward ? nextWorkday(date) : prevWorkday(date)

  const dateToX = (date) =>
    diffDays(startOfDay(totalStart), startOfDay(new Date(date))) * dayWidth

  // ── Clipping detection: move outside when >50% of title is hidden ──────────
  const assignee  = people.find((p) => p.id === task.assigneeId)
  const pmTeam    = teams.find((t)  => t.id === task.teamId)
  const assigneeColor = assignee ? (assignee.color || getAvatarColor(assignee.name)) : '#9ca3af'

  const dispStart = visual ? visual.startDate : new Date(task.startDate)
  const dispEnd   = visual ? visual.endDate   : new Date(task.endDate)
  const x = dateToX(dispStart)
  const w = Math.max(dayWidth, (diffDays(startOfDay(dispStart), startOfDay(dispEnd)) + 1) * dayWidth)
  const y = rowPaddingTop + laneIndex * (laneHeight + laneGap)

  useLayoutEffect(() => {
    if (!hiddenTitleRef.current) return
    const naturalW = hiddenTitleRef.current.offsetWidth
    // Available width inside bar: total width minus 8px padding each side minus avatar stack
    const avatarW = (assignee ? 22 : 0) + (pmTeam ? 14 : 0) + ((assignee || pmTeam) ? 9 : 0) // 22px + 8px overlap + 5px margin
    const availW = w - 16 - avatarW
    // Move outside when less than 50% of text is visible
    setIsNarrow(availW < naturalW / 2)
  }, [task.title, w, assignee, pmTeam]) // eslint-disable-line

  // ── Resize drag (left/right handles) ──────────────────────────────────────
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
      {/* Hidden span for measuring natural text width */}
      <span ref={hiddenTitleRef} className="task-bar__title-measure">{task.title}</span>

      {/* Left resize handle */}
      {!readOnly && !isGhost && (
        <div className="task-bar__handle task-bar__handle--left" onMouseDown={(e) => startResize(e, 'left')}>
          <div className="task-bar__handle-grip" />
        </div>
      )}

      {/* Main bar — white background, avatars+title inside only when wide enough */}
      <div
        className="task-bar__inner"
        onMouseDown={handleMoveDown}
        onContextMenu={(e) => { e.preventDefault(); !readOnly && !isGhost && setShowMenu(true) }}
      >
        {!isNarrow && (assignee || pmTeam) && (
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
        {!isNarrow && (
          <span className="task-bar__title">{task.title}</span>
        )}
      </div>

      {/* Avatars + title outside bar when >50% clipped */}
      {isNarrow && (
        <div className="task-bar__outside-content" style={{ left: w + 5 }}>
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
          <span className="task-bar__outside-title">{task.title}</span>
        </div>
      )}

      {/* Right resize handle */}
      {!readOnly && !isGhost && (
        <div className="task-bar__handle task-bar__handle--right" onMouseDown={(e) => startResize(e, 'right')}>
          <div className="task-bar__handle-grip" />
        </div>
      )}

      {/* Date tooltips during resize — combined when bar is narrow to avoid overlap */}
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
                {formatDateWithDay(new Date(task.startDate))} → {formatDateWithDay(new Date(task.endDate))}
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
