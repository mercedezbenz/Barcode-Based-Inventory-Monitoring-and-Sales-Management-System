import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
})

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
})

/**
 * Normalizes different timestamp inputs (Firestore Timestamp, number, string, Date)
 * and returns a formatted date string. Falls back to "No timestamp" when invalid.
 */
export function formatTimestamp(ts: any): string {
  if (!ts && ts !== 0) return "No timestamp"

  let date: Date | null = null

  if (typeof ts === "number") {
    // Handle timestamp (milliseconds or seconds)
    date = ts > 1000000000000 ? new Date(ts) : new Date(ts * 1000)
  } else if (typeof ts === "string") {
    date = new Date(ts)
  } else if (ts instanceof Date) {
    date = ts
  } else if (typeof ts === "object" && ts !== null) {
    // Handle Firestore Timestamp objects
    if (typeof ts.toDate === "function") {
      date = ts.toDate()
    } else if (typeof ts.seconds === "number") {
      date = new Date(ts.seconds * 1000)
    } else if (typeof ts._seconds === "number") {
      date = new Date(ts._seconds * 1000)
    }
  }

  if (!date || isNaN(date.getTime())) {
    return "No timestamp"
  }

  const datePart = DATE_FORMATTER.format(date)
  const timePart = TIME_FORMATTER.format(date)

  return `${datePart} – ${timePart}`
}

/**
 * Formats a timestamp in milliseconds to "MMM DD, YYYY – hh:mm A" format
 * Example: "Nov 21, 2025 – 09:35 PM"
 */
export function formatDeliveryTime(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).replace(",", " –")
}

/**
 * Formats an expiration date from Firestore to "MM - DD - YYYY" format
 * Handles Firestore Timestamp objects, Date objects, strings, and numbers
 * Returns "No expiration" only if the field is truly missing/null/undefined
 * Example: "11 - 26 - 2025"
 */
export function formatExpirationDate(date: any): string {
  // Only return "No expiration" if the value is truly missing/null/undefined
  if (!date && date !== 0) {
    return "No expiration"
  }

  let dateObj: Date | null = null

  // Handle Firestore Timestamp objects
  if (typeof date === "object" && date !== null) {
    if (typeof date.toDate === "function") {
      // Firestore Timestamp object
      dateObj = date.toDate()
    } else if (typeof date.seconds === "number") {
      // Firestore Timestamp with seconds property
      dateObj = new Date(date.seconds * 1000)
    } else if (typeof date._seconds === "number") {
      // Firestore Timestamp with _seconds property
      dateObj = new Date(date._seconds * 1000)
    } else if (date instanceof Date) {
      dateObj = date
    } else if (typeof date === "string") {
      // Try parsing string date
      dateObj = new Date(date)
    }
  } else if (typeof date === "number") {
    // Handle timestamp (milliseconds or seconds)
    dateObj = date > 1000000000000 ? new Date(date) : new Date(date * 1000)
  } else if (typeof date === "string") {
    dateObj = new Date(date)
  }

  // Validate date
  if (!dateObj || isNaN(dateObj.getTime())) {
    return "No expiration"
  }

  // Format as MM - DD - YYYY
  const month = String(dateObj.getMonth() + 1).padStart(2, "0")
  const day = String(dateObj.getDate()).padStart(2, "0")
  const year = dateObj.getFullYear()

  return `${month} - ${day} - ${year}`
}
