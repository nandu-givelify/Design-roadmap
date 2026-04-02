export const DAY_MS = 86400000
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export const isWeekend = (date) => { const d = new Date(date); return d.getDay() === 0 || d.getDay() === 6 }

export const nextWorkday = (date) => {
  const d = new Date(date)
  while (isWeekend(d)) d.setDate(d.getDate() + 1)
  return d
}
export const prevWorkday = (date) => {
  const d = new Date(date)
  while (isWeekend(d)) d.setDate(d.getDate() - 1)
  return d
}

export const startOfDay = (date) => { const d = new Date(date); d.setHours(0,0,0,0); return d }
export const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d }
export const addMonths = (date, n) => { const d = new Date(date); d.setMonth(d.getMonth() + n); return d }
export const diffDays = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS)

// Parse a "YYYY-MM-DD" string as LOCAL midnight (not UTC).
// JavaScript's new Date("YYYY-MM-DD") parses as UTC, which shifts the date
// by the timezone offset and produces wrong results in non-UTC timezones.
export const parseLocalDate = (date) => {
  if (!date) return new Date()
  if (date instanceof Date) return date
  const [y, m, d] = String(date).split('-').map(Number)
  return new Date(y, m - 1, d) // month is 0-indexed; this is LOCAL midnight
}

export const formatDateShort = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// e.g. "Apr 2, Thu"
export const formatDateWithDay = (date) => {
  const d = new Date(date)
  const month   = d.toLocaleDateString('en-US', { month: 'short' })
  const day     = d.getDate()
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
  return `${month} ${day}, ${weekday}`
}

export const toDateString = (date) => {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export const getQuarterForMonth = (month) => Math.floor(month / 3) + 1
export const getQuarterMonths = (q) => { const s = (q-1)*3; return [s, s+1, s+2] }
export const getYearRange = (year) => ({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) })
export const getQuarterRange = (year, quarter) => {
  const months = getQuarterMonths(quarter)
  return { start: new Date(year, months[0], 1), end: new Date(year, months[2]+1, 0) }
}

// Days of padding shown before/after each view period
export const VIEW_PAD_DAYS = 7

// Total scrollable range: 2 years back, 2 years forward + 7-day buffer on each side
export const getTotalRange = (referenceYear) => ({
  start: addDays(new Date(referenceYear - 2, 0, 1), -VIEW_PAD_DAYS),
  end:   addDays(new Date(referenceYear + 2, 11, 31), VIEW_PAD_DAYS),
})

export const getDaysInRange = (start, end) => {
  const days = []
  const cur = startOfDay(start)
  const last = startOfDay(end)
  while (cur <= last) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
  return days
}

export const groupDaysByMonth = (days) => {
  const groups = []
  days.forEach((d) => {
    const m = d.getMonth(), y = d.getFullYear()
    const last = groups[groups.length - 1]
    if (!last || last.month !== m || last.year !== y) groups.push({ month: m, year: y, days: [d] })
    else last.days.push(d)
  })
  return groups
}

export const isTaskInRange = (task, rs, re) => {
  const ts = startOfDay(new Date(task.startDate))
  const te = startOfDay(new Date(task.endDate))
  return ts <= startOfDay(re) && te >= startOfDay(rs)
}

// Assign non-overlapping swim lanes to tasks. Returns tasks with ._lane added.
export const assignLanes = (tasks) => {
  const sorted = [...tasks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
  const laneEnds = []
  return sorted.map((task) => {
    const ts = startOfDay(new Date(task.startDate))
    let lane = laneEnds.findIndex((end) => ts > end)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(startOfDay(new Date(task.endDate))) }
    else laneEnds[lane] = startOfDay(new Date(task.endDate))
    return { ...task, _lane: lane }
  })
}

export const getLaneCount = (tasks) => {
  if (!tasks.length) return 1
  const withLanes = assignLanes(tasks)
  return Math.max(...withLanes.map((t) => t._lane)) + 1
}

// Deterministic avatar color from name string
export const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6','#f97316','#84cc16']
export const getAvatarColor = (name = '') => {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export const TASK_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6','#f97316','#84cc16']
