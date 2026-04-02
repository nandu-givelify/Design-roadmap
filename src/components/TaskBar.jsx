import { useRef, useState, useCallback } from 'react'
import {
  startOfDay, addDays, diffDays, formatDateShort,
  isWeekend, nextWorkday, prevWorkday, toDateString
} from '../utils/dateUtils'

const BAR_HEIGHT = 32

export default function TaskBar({
  task, xOffset, width, yOffset,
  dayWidth, rangeStart, rangeEnd, days,
  onUpdate, onDelete, readOnly, viewMode,
}) {
  const barRef = useRef(null)
  const [dragging, setDragging] = useState(null) // null | 'move' | 'left' | 'right'
  const [tooltip, setTooltip] = useState(null) // {startDate, endDate}
  const [showMenu, setShowMenu] = useState(false)
  const dragState = useRef(null)

  const snapToWorkday = (date, preferForward = true) => {
    if (!isWeekend(date)) return date
    return preferForward ? nextWorkday(date) : prevWorkday(date)
  }

  const dayFromX = (absoluteX) => {
    const idx = Math.round((absoluteX - xOffset) / dayWidth)
    const clamped = Math.max(0, Math.min(days.length - 1, idx))
    return days[clamped]
  }

  const startMouseDown = (e, type) => {
    if (readOnly) return
    e.preventDefault()
    e.stopPropagation()

    const startX = e.clientX
    const origStart = new Date(task.startDate)
    const origEnd = new Date(task.endDate)

    dragState.current = { type, startX, origStart, origEnd, currentStart: origStart, currentEnd: origEnd }
    setDragging(type)
    setTooltip({ startDate: origStart, endDate: origEnd })

    const onMove = (me) => {
      const dx = me.clientX - startX
      const daysDelta = Math.round(dx / dayWidth)
      const ds = dragState.current
      let newStart = ds.currentStart
      let newEnd = ds.currentEnd

      if (type === 'move') {
        newStart = addDays(ds.origStart, daysDelta)
        newEnd = addDays(ds.origEnd, daysDelta)
        newStart = snapToWorkday(newStart, daysDelta >= 0)
        newEnd = snapToWorkday(newEnd, daysDelta >= 0)
      } else if (type === 'left') {
        newStart = addDays(ds.origStart, daysDelta)
        newStart = snapToWorkday(newStart, true)
        if (newStart >= ds.origEnd) newStart = addDays(ds.origEnd, -1)
        newStart = snapToWorkday(newStart, false)
      } else if (type === 'right') {
        newEnd = addDays(ds.origEnd, daysDelta)
        newEnd = snapToWorkday(newEnd, false)
        if (newEnd <= ds.origStart) newEnd = addDays(ds.origStart, 1)
        newEnd = snapToWorkday(newEnd, true)
      }

      ds.currentStart = newStart
      ds.currentEnd = newEnd
      setTooltip({ startDate: newStart, endDate: newEnd })
    }

    const onUp = () => {
      const ds = dragState.current
      if (ds) {
        const updates = {}
        if (type === 'move' || type === 'left') updates.startDate = toDateString(ds.currentStart)
        if (type === 'move' || type === 'right') updates.endDate = toDateString(ds.currentEnd)
        onUpdate(updates)
      }
      setDragging(null)
      setTooltip(null)
      dragState.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const taskColor = task.color || '#6366f1'
  const isActive = dragging !== null
  const tipStart = tooltip?.startDate || new Date(task.startDate)
  const tipEnd = tooltip?.endDate || new Date(task.endDate)

  return (
    <div
      ref={barRef}
      style={{
        position: 'absolute',
        left: xOffset,
        top: yOffset,
        width: Math.max(dayWidth, width),
        height: BAR_HEIGHT,
        zIndex: isActive ? 100 : 10,
        userSelect: 'none',
      }}
    >
      {/* Left resize handle */}
      {!readOnly && (
        <div
          onMouseDown={(e) => startMouseDown(e, 'left')}
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: 8, cursor: 'ew-resize', zIndex: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{ width: 2, height: 14, background: 'rgba(255,255,255,0.6)', borderRadius: 1 }}/>
        </div>
      )}

      {/* Main bar */}
      <div
        onMouseDown={(e) => startMouseDown(e, 'move')}
        onContextMenu={(e) => { e.preventDefault(); setShowMenu(true) }}
        onDoubleClick={() => setShowMenu(true)}
        style={{
          position: 'absolute', left: 4, right: 4, top: 0, bottom: 0,
          background: taskColor,
          borderRadius: 6,
          cursor: readOnly ? 'default' : 'grab',
          display: 'flex', alignItems: 'center',
          paddingLeft: 8,
          overflow: 'hidden',
          boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.12)',
          transition: isActive ? 'none' : 'box-shadow 0.15s',
          opacity: isActive ? 0.9 : 1,
        }}
      >
        <span style={{
          fontSize: 12, fontWeight: 600, color: '#fff',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          pointerEvents: 'none',
        }}>
          {task.title}
        </span>
        {task.project && (
          <span style={{
            fontSize: 10, color: 'rgba(255,255,255,0.75)',
            marginLeft: 6, flexShrink: 0, pointerEvents: 'none',
          }}>
            · {task.project}
          </span>
        )}
      </div>

      {/* Right resize handle */}
      {!readOnly && (
        <div
          onMouseDown={(e) => startMouseDown(e, 'right')}
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: 8, cursor: 'ew-resize', zIndex: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{ width: 2, height: 14, background: 'rgba(255,255,255,0.6)', borderRadius: 1 }}/>
        </div>
      )}

      {/* Drag tooltip */}
      {tooltip && (
        <>
          {/* Left date label */}
          <div style={{
            position: 'absolute', bottom: '100%', left: 4,
            marginBottom: 4,
            background: '#111827', color: '#fff',
            fontSize: 11, padding: '2px 6px', borderRadius: 4,
            whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 200,
          }}>
            {formatDateShort(tipStart)}
          </div>
          {/* Right date label */}
          <div style={{
            position: 'absolute', bottom: '100%', right: 4,
            marginBottom: 4,
            background: '#111827', color: '#fff',
            fontSize: 11, padding: '2px 6px', borderRadius: 4,
            whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 200,
          }}>
            {formatDateShort(tipEnd)}
          </div>
        </>
      )}

      {/* Context menu */}
      {showMenu && !readOnly && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
          }}
          onClick={() => setShowMenu(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: xOffset, top: yOffset + BAR_HEIGHT + 4,
              background: '#fff', borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              border: '1px solid #e5e7eb',
              minWidth: 160, zIndex: 1000,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{task.title}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                {formatDateShort(new Date(task.startDate))} → {formatDateShort(new Date(task.endDate))}
              </div>
            </div>
            <button
              onClick={() => { onDelete(); setShowMenu(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 14px', border: 'none', background: 'none',
                fontSize: 13, color: '#ef4444', cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              Delete task
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
