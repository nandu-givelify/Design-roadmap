import { useRef, useCallback } from 'react'

export function useHistory() {
  const past   = useRef([])  // [{description, undo, redo}]
  const future = useRef([])

  const push = useCallback((action) => {
    past.current = [...past.current.slice(-9), action]
    future.current = []
  }, [])

  const undo = useCallback(() => {
    if (past.current.length === 0) return null
    const action = past.current[past.current.length - 1]
    past.current = past.current.slice(0, -1)
    future.current = [...future.current, action]
    action.undo()
    return action.description
  }, [])

  const redo = useCallback(() => {
    if (future.current.length === 0) return null
    const action = future.current[future.current.length - 1]
    future.current = future.current.slice(0, -1)
    past.current = [...past.current, action]
    action.redo()
    return action.description
  }, [])

  return { push, undo, redo }
}
