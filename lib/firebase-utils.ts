/**
 * Sanitizes a string for use in Firebase Realtime Database paths.
 * Firebase paths cannot contain: ".", "#", "$", "[", "]", "@"
 * 
 * @param pathSegment - The path segment to sanitize (e.g., driverId, email)
 * @returns Sanitized path segment safe for Firebase paths
 * 
 * @example
 * sanitizeFirebasePath("user@example.com") // Returns "user-example-com"
 * sanitizeFirebasePath("user.name") // Returns "user-name"
 * sanitizeFirebasePath("user#123") // Returns "user-123"
 */
export function sanitizeFirebasePath(pathSegment: string): string {
  if (!pathSegment || typeof pathSegment !== "string") {
    return ""
  }

  // Replace all Firebase-restricted characters with hyphens
  // Restricted chars: ".", "#", "$", "[", "]", "@"
  return pathSegment.replace(/[.#$\[\]@]/g, "-")
}

/**
 * Sanitizes a driverId (typically an email) for use in Firebase paths.
 * This is a convenience function that specifically handles email addresses.
 * 
 * @param driverId - The driver ID (usually an email address)
 * @returns Sanitized driver ID safe for Firebase paths
 * 
 * @example
 * sanitizeDriverId("deliveryy@decktago.com") // Returns "deliveryy-decktago-com"
 */
export function sanitizeDriverId(driverId: string | null | undefined): string {
  if (!driverId) {
    return ""
  }
  return sanitizeFirebasePath(driverId)
}
