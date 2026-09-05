import { useEffect, useState } from 'react'

// Keeps a dialog mounted for `exitMs` after `open` goes false, so MUI's own
// exit transition (Slide/Fade) has time to play instead of being cut short
// by the parent unmounting the component synchronously.
export function useMountWhileOpen(open, exitMs = 260) {
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) { setMounted(true); return }
    const t = setTimeout(() => setMounted(false), exitMs)
    return () => clearTimeout(t)
  }, [open, exitMs])

  return mounted
}
