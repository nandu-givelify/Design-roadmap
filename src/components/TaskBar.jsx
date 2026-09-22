import { useRef, useState, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { startOfDay, addDays, diffDays, formatDateWithDay, isWeekend, nextWorkday, prevWorkday, toDateString, getAvatarColor, parseLocalDate } from '../utils/dateUtils'
import { pastelize, readableTextColor } from '../utils/colors'

const BAR_H         = 42
const PHASE_STRIP_H = 7    // 3px strip + 4px bottom gap = 7. Inner constrained to 42-7=35px, centering 24px avatar → 5.5px equal gaps.

export default function TaskBar({
  task, totalStart, dayWidth, laneIndex,
  rowPaddingTop, laneHeight, laneGap,
  people,
  boardPhases,
  projects,
  onDelete, onResizeDone, onMoveDragStart, onEdit, onPhaseDragDone, onDuplicate, onToggleSelect,
  isGhost, isSelected,
  readOnly,
}) {
  const [resizing,     setResizing]     = useState(false)
  const [visual,       setVisual]       = useState(null)
  const [visualPhases, setVisualPhases] = useState(null)
  const [showMenu,     setShowMenu]     = useState(false)
  const [menuPos,      setMenuPos]      = useState(null) // {x, y} in viewport coords
  const [isNarrow,     setIsNarrow]     = useState(false)
  const [showDates,    setShowDates]    = useState(false)

  const barRef       = useRef(null)
  const dragRef      = useRef(null)
  const phaseDragRef = useRef(null)
  const hiddenTitleRef = useRef(null)
  const hiddenBadgeRef = useRef(null)

  const snapWorkday = (date, forward = true) =>
    !isWeekend(date) ? date : forward ? nextWorkday(date) : prevWorkday(date)

  const dateToX = (date) =>
    diffDays(startOfDay(totalStart), startOfDay(new Date(date))) * dayWidth

  const assignee     = people.find((p) => p.id === task.assigneeId)
  const pmPerson     = people.find((p) => p.id === (task.pmId || task.teamId))
  const assigneeColor = assignee ? (getAvatarColor(assignee.name)) : '#9ca3af'
  const pmColor       = pmPerson ? (getAvatarColor(pmPerson.name)) : '#6366f1'
  const project       = (projects || []).find((p) => p.id === task.projectId)

  const dispStart = visual ? visual.startDate : parseLocalDate(task.startDate)
  const dispEnd   = visual ? visual.endDate   : parseLocalDate(task.endDate)
  const x = dateToX(dispStart)
  const w = Math.max(dayWidth, (diffDays(startOfDay(dispStart), startOfDay(dispEnd)) + 1) * dayWidth)
  const y = rowPaddingTop + laneIndex * (laneHeight + laneGap)

  // A task's phase display is driven entirely by its own saved `phases` field
  // — never recomputed from the board's *current* phase list on the fly. A
  // legacy task saved before the phases field existed (phases === undefined)
  // has none until App.jsx's one-time migration writes real data to it; it
  // must not, in the meantime, reactively show/hide phases just because
  // someone added, removed, or renamed a phase in Board Settings.
  const rawPhases  = visualPhases || task.phases || []
  // Disabling a phase in Board Settings hides it everywhere, including on
  // tasks that already have it — it's a soft hide, not a delete, so the
  // task's own `phases` data is untouched and re-enabling brings it right back.
  const taskPhases = rawPhases.filter(p => {
    const bp = (boardPhases || []).find(b => b.id === p.id)
    return bp && bp.enabled !== false
  })
  const hasPhases  = taskPhases.length > 0

  // No phase strip to reserve room for — shrink the bar and re-center it in
  // its lane instead of leaving the space the strip would have used empty.
  const barH = hasPhases ? BAR_H : BAR_H - PHASE_STRIP_H
  const barY = y + (BAR_H - barH) / 2

  useLayoutEffect(() => {
    if (!hiddenTitleRef.current) return
    const naturalW = hiddenTitleRef.current.offsetWidth
    const avatarW  = (assignee ? 24 : 0) + (pmPerson ? 16 : 0) + ((assignee || pmPerson) ? 6 : 0)
    // The project badge is measured the same way as the title (a hidden twin
    // sharing its real class, so max-width/ellipsis clamp it identically) —
    // without this, the badge could silently eat into the space the title
    // math assumes is free, instead of the title correctly ceding to it.
    const badgeW   = project && hiddenBadgeRef.current ? hiddenBadgeRef.current.offsetWidth + 6 : 0
    const availW   = w - 8 - avatarW - badgeW
    setIsNarrow(availW < naturalW * 0.6)
  }, [task.title, w, assignee, pmPerson, project]) // eslint-disable-line

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

  // ── Dismiss dates on Escape / outside click ──────────────────────────────
  useEffect(() => {
    if (!showDates) return
    const onKey  = (e) => { if (e.key === 'Escape') setShowDates(false) }
    const onDown = (e) => { if (barRef.current && !barRef.current.contains(e.target)) setShowDates(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [showDates])

  // ── Move drag ────────────────────────────────────────────────────────────
  const handleMoveDown = (e) => {
    // Only the primary (left) button starts a move/click-to-edit — a right-
    // click's mousedown would otherwise be picked up here too and, since it
    // releases almost instantly in the same spot, get misread as a quick
    // click that opens Edit Task before the native contextmenu event (which
    // shows the right-click menu, including Duplicate) ever gets a chance to.
    if (readOnly || isGhost || e.button !== 0) return
    // Shift+click toggles this task in/out of the multi-select instead of
    // moving or editing it — mirrors the rubber-band select's own shift
    // behavior (see Timeline's handleScrollMouseDown) so both ways of
    // building up a selection add to it rather than replacing it.
    if (e.shiftKey) {
      e.preventDefault(); e.stopPropagation()
      onToggleSelect?.()
      return
    }
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

  // A task has exactly one project — its color tints the bar's own
  // background, and its name shows as a small badge.
  const barBg = project ? pastelize(project.color) : (task.taskColor === 'gray' ? '#eeeeee' : '#fff')

  const renderProjectBadges = () => {
    if (!project) return null
    return (
      <div className="task-bar__project-badges">
        <span
          className="task-bar__project-badge"
          style={{ background: project.color, color: readableTextColor(project.color) }}
          title={project.name}
        >
          {project.name}
        </span>
      </div>
    )
  }

  return (
    <div
      ref={barRef}
      className={['task-bar', resizing ? 'task-bar--dragging' : '', isGhost ? 'task-bar--ghost' : '', isSelected ? 'task-bar--selected' : ''].filter(Boolean).join(' ')}
      style={{ left: x, top: barY, width: w, height: barH, background: barBg }}
    >
      <span ref={hiddenTitleRef} className="task-bar__title-measure">{task.title}</span>
      {project && (
        <span ref={hiddenBadgeRef} className="task-bar__project-badge task-bar__project-badge-measure">
          {project.name}
        </span>
      )}

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
        onDoubleClick={(e) => { e.stopPropagation(); if (!readOnly && !isGhost) setShowDates(v => !v) }}
        onContextMenu={(e) => {
          e.preventDefault()
          if (readOnly || isGhost) return
          setMenuPos({ x: e.clientX, y: e.clientY })
          setShowMenu(true)
        }}
      >
        {!isNarrow && renderAvatars()}
        {!isNarrow && renderProjectBadges()}
        {!isNarrow && <span className="task-bar__title">{task.title}</span>}
      </div>

      {hasPhases && (
        <div className="task-bar__phase-strip">
          {taskPhases.map((phase, i) => {
            const def = (boardPhases || []).find(bp => bp.id === phase.id)
            return (
              <div key={phase.id} className="task-bar__phase-seg"
                style={{ flex: phase.days }}
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
          {renderProjectBadges()}
          <span className="task-bar__outside-title">{task.title}</span>
        </div>
      )}

      {!readOnly && !isGhost && (
        <div className="task-bar__handle task-bar__handle--right" onMouseDown={(e) => startResize(e, 'right')}>
          <div className="task-bar__handle-grip" />
        </div>
      )}

      {(resizing || showDates) && (
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

      {showMenu && menuPos && createPortal(
        <div className="task-bar__menu-overlay" onClick={() => setShowMenu(false)}>
          <div
            className="task-bar__menu"
            style={{
              // Portaled straight to <body> and positioned from the actual
              // right-click point in viewport coordinates — this used to be
              // nested inside the task bar's own absolutely-positioned (and,
              // via a row-entrance animation, transformed) ancestor, which
              // silently hijacked "position: fixed" into being relative to
              // that ancestor instead of the viewport, so the menu rendered
              // thousands of pixels off-screen instead of near the task bar.
              top: Math.min(menuPos.y, window.innerHeight - 220),
              left: Math.min(menuPos.x, window.innerWidth - 240),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="task-bar__menu-info">
              <div className="task-bar__menu-task-title">{task.title}</div>
              <div className="task-bar__menu-dates">
                {formatDateWithDay(parseLocalDate(task.startDate))} → {formatDateWithDay(parseLocalDate(task.endDate))}
              </div>
            </div>
            {!readOnly && onEdit && (
              <button className="task-bar__menu-item" onClick={() => { setShowMenu(false); onEdit() }}>Edit task</button>
            )}
            {!readOnly && onDuplicate && (
              <button className="task-bar__menu-item" onClick={() => { setShowMenu(false); onDuplicate() }}>Duplicate task</button>
            )}
            {!readOnly && (
              <button className="task-bar__menu-item task-bar__menu-item--delete"
                onClick={() => { onDelete(); setShowMenu(false) }}>Delete task</button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
