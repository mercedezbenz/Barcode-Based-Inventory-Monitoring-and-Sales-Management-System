/**
 * Utility functions for calculating weekly changes from Firestore data
 */

/**
 * Parse a date value from Firestore (handles various formats)
 */
export function parseFirestoreDate(date: any): Date | null {
  if (!date) return null
  if (date instanceof Date) return date
  if (typeof date === "string") {
    const parsed = new Date(date)
    return isNaN(parsed.getTime()) ? null : parsed
  }
  if (date && typeof date.toDate === "function") return date.toDate()
  if (date && typeof date.seconds === "number") return new Date(date.seconds * 1000)
  if (date && typeof date._seconds === "number") return new Date(date._seconds * 1000)
  return null
}

/**
 * Check if a date falls within a specific week range
 */
function isInWeekRange(date: Date | null, startDate: Date, endDate: Date): boolean {
  if (!date) return false
  const time = date.getTime()
  return time >= startDate.getTime() && time < endDate.getTime()
}

/**
 * Calculate weekly change for a numeric value based on date filtering
 */
export function calculateWeeklyChange<T>({
  items,
  getValue,
  getDate,
  currentWeekValue: _currentWeekValue, // Not used, calculated internally
}: {
  items: T[]
  getValue: (item: T) => number
  getDate: (item: T) => Date | null
  currentWeekValue?: number // Optional, calculated internally
}): number {
  const now = new Date()
  const currentWeekStart = new Date(now)
  currentWeekStart.setDate(now.getDate() - 7)
  currentWeekStart.setHours(0, 0, 0, 0)

  const previousWeekStart = new Date(currentWeekStart)
  previousWeekStart.setDate(previousWeekStart.getDate() - 7)
  const previousWeekEnd = new Date(currentWeekStart)

  // Calculate current week total (last 7 days)
  const currentWeekTotal = items.reduce((sum, item) => {
    const itemDate = getDate(item)
    if (isInWeekRange(itemDate, currentWeekStart, now)) {
      return sum + getValue(item)
    }
    return sum
  }, 0)

  // Calculate previous week total (7-14 days ago)
  const previousWeekTotal = items.reduce((sum, item) => {
    const itemDate = getDate(item)
    if (isInWeekRange(itemDate, previousWeekStart, previousWeekEnd)) {
      return sum + getValue(item)
    }
    return sum
  }, 0)

  // Weekly change = current week - previous week
  return currentWeekTotal - previousWeekTotal
}

/**
 * Calculate weekly change for a count based on date filtering
 */
export function calculateWeeklyCountChange<T>({
  items,
  getDate,
  currentWeekCount: _currentWeekCount, // Not used, calculated internally
  filter,
}: {
  items: T[]
  getDate: (item: T) => Date | null
  currentWeekCount?: number // Optional, calculated internally
  filter?: (item: T) => boolean
}): number {
  const now = new Date()
  const currentWeekStart = new Date(now)
  currentWeekStart.setDate(now.getDate() - 7)
  currentWeekStart.setHours(0, 0, 0, 0)

  const previousWeekStart = new Date(currentWeekStart)
  previousWeekStart.setDate(previousWeekStart.getDate() - 7)
  const previousWeekEnd = new Date(currentWeekStart)

  // Count items in current week (last 7 days)
  const currentWeekTotal = items.filter((item) => {
    if (filter && !filter(item)) return false
    const itemDate = getDate(item)
    return isInWeekRange(itemDate, currentWeekStart, now)
  }).length

  // Count items in previous week (7-14 days ago)
  const previousWeekTotal = items.filter((item) => {
    if (filter && !filter(item)) return false
    const itemDate = getDate(item)
    return isInWeekRange(itemDate, previousWeekStart, previousWeekEnd)
  }).length

  // Weekly change = current week - previous week
  return currentWeekTotal - previousWeekTotal
}

/**
 * Format weekly change text for display
 */
export function formatWeeklyChange(change: number): string {
  if (change > 0) {
    return `+${change} increase this week`
  } else if (change < 0) {
    return `${change} decrease this week`
  } else {
    return `0 change this week`
  }
}

