// ── Constants ────────────────────────────────────────────────────────────────
export const DAY_MS = 86400000
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Helpers ──────────────────────────────────────────────────────────────────
export const isWeekend = (date) => {
  const d = date instanceof Date ? date : new Date(date)
  const day = d.getDay()
  return day === 0 || day === 6
}

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

export const startOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export const addDays = (date, n) => {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export const diffDays = (a, b) =>
  Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS)

export const formatDate = (date) => {
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const formatDateShort = (date) => {
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const toDateString = (date) => {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export const fromDateString = (str) => {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const getQuarterMonths = (quarter) => {
  const starts = [0, 3, 6, 9]
  const s = starts[quarter - 1]
  return [s, s + 1, s + 2]
}

export const getQuarterForMonth = (month) => Math.floor(month / 3) + 1

// ── View range builders ──────────────────────────────────────────────────────
export const getYearRange = (year) => ({
  start: new Date(year, 0, 1),
  end: new Date(year, 11, 31),
})

export const getQuarterRange = (year, quarter) => {
  const months = getQuarterMonths(quarter)
  return {
    start: new Date(year, months[0], 1),
    end: new Date(year, months[2] + 1, 0), // last day of last month
  }
}

// Returns array of Date objects for every day in [start, end] inclusive
export const getDaysInRange = (start, end) => {
  const days = []
  const cur = startOfDay(start)
  const last = startOfDay(end)
  while (cur <= last) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

// Group days by month → [{month, year, days[]}]
export const groupDaysByMonth = (days) => {
  const groups = []
  days.forEach((d) => {
    const m = d.getMonth()
    const y = d.getFullYear()
    const last = groups[groups.length - 1]
    if (!last || last.month !== m || last.year !== y) {
      groups.push({ month: m, year: y, days: [d] })
    } else {
      last.days.push(d)
    }
  })
  return groups
}

// Is a task active (overlapping) within a date range?
export const isTaskInRange = (task, rangeStart, rangeEnd) => {
  const ts = startOfDay(new Date(task.startDate))
  const te = startOfDay(new Date(task.endDate))
  const rs = startOfDay(rangeStart)
  const re = startOfDay(rangeEnd)
  return ts <= re && te >= rs
}

export const TASK_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981',
  '#3b82f6','#ef4444','#14b8a6','#f97316','#84cc16',
]
