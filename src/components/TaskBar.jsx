import { useRef, useState, useLayoutEffect } from 'react'
import { startOfDay, addDays, diffDays, formatDateWithDay, isWeekend, nextWorkday, prevWorkday, toDateString, getAvatarColor, parseLocalDate } from '../utils/dateUtils'

const BAR_H         = 46
const PHASE_STRIP_H = 10   // 4px strip + 4px bottom gap + 2px above = 10. Gives ~6px gap above strip.

export default function TaskBar({
  task, totalStart, dayWidth, laneIndex,
  rowPaddingTop, laneHeight, laneGap,
  people,
  boardPhases,
  onDelete, onResizeDone, onMoveDragStart, onEdit, onPhaseDragDone,
  isGhost, isSelected,
  readOnly,
}) {
  const [resizing,     setResizing]     = useState(false)
  const [visual,       setVisual]       = useState(null)
  const [visualPhases, setVisualPhases] = useState(null)
  const [showMenu,     setShowMenu]     = useState(false)
  const [isNarrow,     setIsNarrow]     = useState(false)

  const barRef       = useRef(null)
  const dragRef      = useRef(null)
  const phaseDragRef = useRef(null)
  const hiddenTitleRef = useRef(null)

  const snapWorkday = (date, forward = true) =>
    !isWeekend(date) ? date : forward ? nextWorkday(date) : prevWorkday(date)

  const dateToX = (date) =>
    diffDays(startOfDay(totalStart), startOfDay(new Date(date))) * dayWidth

  const assignee     = people.find((p) => p.id === task.assigneeId)
  const pmPerson     = people.find((p) => p.id === (task.pmId || task.teamId))
  const assigneeColor = assignee ? (assignee.color || getAvatarColor(assignee.name)) : '#9ca3af'
  const pmColor       = pmPerson ? (pmPerson.color  || getAvatarColor(pmPerson.name)) : '#6366f1'

  const dispStart = visual ? visual.startDate : parseLocalDate(task.startDate)
  const dispEnd   = visual ? visual.endDate   : parseLocalDate(task.endDate)
  const x = dateToX(dispStart)
  const w = Math.max(dayWidth, (diffDays(startOfDay(dispStart), startOfDay(dispEnd)) + 1) * dayWidth)
  const y = rowPaddingTop + laneIndex * (laneHeight + laneGap)

  const totalDays  = Math.max(1, diffDays(startOfDay(dispStart), startOfDay(dispEnd)) + 1)

  // Default phases: Discovery & Handoff get 1 week (or proportional); UX+UI split remaining
  const computeDefaultPhases = () => {
    if (!boardPhases || boardPhases.length === 0) return []
    const n = boardPhases.length
    const ids = boardPhases.map(p => p.id)
    if (ids.includes('discovery') && ids.includes('handoff') && ids.includes('ux') && ids.includes('ui')) {
      const discovery = Math.max(1, Math.min(7, Math.round(totalDays * 0.25)))
      const handoff   = Math.max(1, Math.min(3, Math.round(totalDays * 0.1)))
      const remaining = Math.max(2, totalDays - discovery - handoff)
      const ux = Math.max(1, Math.floor(remaining / 2))
      const ui = Math.max(1, remaining - ux)
      return boardPhases.map(bp => ({
        id: bp.id,
        days: bp.id === 'discovery' ? discovery
            : bp.id === 'handoff'   ? handoff
            : bp.id === 'ux'        ? ux
            : bp.id === 'ui'        ? ui
            : Math.max(1, Math.floor(totalDays / n)),
      }))
    }
    // General: equal distribution
    const eq = Math.max(1, Math.floor(totalDays / n))
    return boardPhases.map((bp, i) => ({
      id: bp.id,
      days: i === n - 1 ? Math.max(1, totalDays - eq * (n - 1)) : eq,
    }))
  }

  const rawPhases  = visualPhases || (task.phases && task.phases.length > 0 ? task.phases : computeDefaultPhases())
  const taskPhases = rawPhases.filter(p => (boardPhases || []).some(bp => bp.id === p.id))
  const hasPhases  = taskPhases.length > 0

  useLayoutEffect(() => {
    if (!hiddenTitleRef.current) return
    const naturalW = hiddenTitleRef.current.offsetWidth
    const avatarW  = (assignee ? 24 : 0) + (pmPerson ? 16 : 0) + ((assignee || pmPerson) ? 6 : 0)
    const availW   = w - 8 - avatarW
    setIsNarrow(availW < naturalW * 0.6)
  }, [task.title, w, assignee, pmPerson]) // eslint-disable-line

  // ── Resize drag ──────────────────────────────────────────────────────────
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
      if (ds) {
        const update = { startDate: toDateString(ds.curStart), endDate: toDateString(ds.curEnd) }
        if (taskPhases.length > 0) {
          const origTotalDays = diffDays(startOfDay(ds.origStart), startOfDay(ds.origEnd)) + 1
          const newTotalDays  = diffDays(startOfDay(ds.curStart),  startOfDay(ds.curEnd))  + 1
          const ratio = newTotalDays / origTotalDays
          let scaled = taskPhases.map(p => ({ ...p, days: Math.max(1, Math.round(p.days * ratio)) }))
          const scaledSum = scaled.reduce((s, p) => s + p.days, 0)
          scaled[scaled.length - 1] = {
            ...scaled[scaled.length - 1],
            days: Math.max(1, scaled[scaled.length - 1].days + (newTotalDays - scaledSum))
          }
          update.phases = scaled
        }
        onResizeDone?.(update)
      }
      setResizing(false); setVisual(null); dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Move drag ────────────────────────────────────────────────────────────
  const handleMoveDown = (e) => {
    if (readOnly || isGhost) return
    e.preventDefault(); e.stopPropagation()
    if (onMoveDragStart && barRef.current) {
      onMoveDragStart(task, e, barRef.current.getBoundingClientRect())
    }
  }

  // ── Phase divider drag ───────────────────────────────────────────────────
  const startPhaseDrag = (e, dividerIdx) => {
    if (readOnly) return
    e.preventDefault(); e.stopPropagation()
    const startX     = e.clientX
    const origPhases = taskPhases.map(p => ({ ...p }))
    phaseDragRef.current = { startX, origPhases, dividerIdx, latestPhases: origPhases }
    setVisualPhases(origPhases)

    const onMove = (me) => {
      const daysDelta = Math.round((me.clientX - startX) / dayWidth)
      const newPhases = origPhases.map(p => ({ ...p }))
      const combined  = origPhases[dividerIdx].days + origPhases[dividerIdx + 1].days
      const newLeft   = Math.max(1, Math.min(combined - 1, origPhases[dividerIdx].days + daysDelta))
      newPhases[dividerIdx]     = { ...newPhases[dividerIdx],     days: newLeft }
      newPhases[dividerIdx + 1] = { ...newPhases[dividerIdx + 1], days: combined - newLeft }
      phaseDragRef.current.latestPhases = newPhases
      setVisualPhases(newPhases)
    }

    const onUp = () => {
      const latest = phaseDragRef.current?.latestPhases
      if (latest) onPhaseDragDone?.(latest)
      setVisualPhases(null)
      phaseDragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const renderAvatars = () => {
    if (!assignee && !pmPerson) return null
    return (
      <div className="task-bar__avatars">
        {assignee && (
          <div className="task-bar__avatar" style={{ background: assigneeColor, zIndex: 2 }}>
            {assignee.photo ? <img src={assignee.photo} alt="" /> : assignee.name?.charAt(0).toUpperCase()}
          </div>
        )}
        {pmPerson && (
          <div className={`task-bar__avatar${assignee ? ' task-bar__avatar--second' : ''}`}
            style={{ background: pmColor, zIndex: 1, borderRadius: '5px' }}>
            {pmPerson.photo ? <img src={pmPerson.photo} alt="" /> : pmPerson.name?.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    )
  }

  const barBg = task.taskColor === 'gray' ? '#eeeeee' : '#fff'

  return (
    <div
      ref={barRef}
      className={['task-bar', resizing ? 'task-bar--dragging' : '', isGhost ? 'task-bar--ghost' : '', isSelected ? 'task-bar--selected' : ''].filter(Boolean).join(' ')}
      style={{ left: x, top: y, width: w, height: BAR_H, background: barBg }}
    >
      <span ref={hiddenTitleRef} className="task-bar__title-measure">{task.title}</span>

      {!readOnly && !isGhost && (
        <div className="task-bar__handle task-bar__handle--left" onMouseDown={(e) => startResize(e, 'left')}>
          <div className="task-bar__handle-grip" />
        </div>
      )}

      <div
        className={['task-bar__inner', isSelected ? 'task-bar__inner--selected' : ''].filter(Boolean).join(' ')}
        style={{ bottom: hasPhases ? PHASE_STRIP_H : 0 }}
        data-task-id={task.id}
        onMouseDown={handleMoveDown}
        onContextMenu={(e) => { e.preventDefault(); !readOnly && !isGhost && setShowMenu(true) }}
      >
        {!isNarrow && renderAvatars()}
        {!isNarrow && <span className="task-bar__title">{task.title}</span>}
      </div>

      {hasPhases && (
        <div className="task-bar__phase-strip">
          {taskPhases.map((phase, i) => {
            const def = (boardPhases || []).find(bp => bp.id === phase.id)
            return (
              <div key={phase.id} className="task-bar__phase-seg"
                style={{ flex: phase.days, background: def?.color || '#9ca3af' }}
                title={def?.name || phase.id}>
                {i < taskPhases.length - 1 && !readOnly && (
                  <div className="task-bar__phase-divider" onMouseDown={(e) => startPhaseDrag(e, i)} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {isNarrow && (
        <div className="task-bar__outside-content" style={{ left: w + 5 }}>
          {renderAvatars()}
          <span className="task-bar__outside-title">{task.title}</span>
        </div>
      )}

      {!readOnly && !isGhost && (
        <div className="task-bar__handle task-bar__handle--right" onMouseDown={(e) => startResize(e, 'right')}>
          <div className="task-bar__handle-grip" />
        </div>
      )}

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
