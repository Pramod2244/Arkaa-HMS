import { format, parseISO } from "date-fns";

/**
 * Format a date consistently to avoid SSR hydration issues.
 * Uses date-fns for consistent formatting across server/client.
 * 
 * @param date - Date string, Date object, or null/undefined
 * @param formatStr - date-fns format string (default: "PP" = "Apr 29, 2024")
 * @returns Formatted date string or "-" if invalid
 */
export function formatDate(date: string | Date | null | undefined, formatStr: string = "PP"): string {
  if (!date) return "-";
  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;
    return format(dateObj, formatStr);
  } catch {
    return "-";
  }
}

/**
 * Format date with time
 * @param date - Date string or Date object
 * @returns Formatted date/time string (e.g., "Apr 29, 2024 at 3:45 PM")
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  return formatDate(date, "PPp");
}

/**
 * Format date in short format (e.g., "04/29/2024")
 */
export function formatDateShort(date: string | Date | null | undefined): string {
  return formatDate(date, "MM/dd/yyyy");
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}