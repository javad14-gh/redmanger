import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { subDays, set } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns the "business date" for operations that span past midnight.
 * If the current time is before the cut-off hour (e.g., 6 AM),
 * it returns the previous day's date.
 * @param date The date to check. Defaults to now.
 * @param cutoffHour The hour (0-23) to use as the cut-off. Defaults to 6.
 * @returns {Date} The calculated business date.
 */
export function getBusinessDate(date: Date = new Date(), cutoffHour: number = 6): Date {
  const now = new Date(date);
  
  if (now.getHours() < cutoffHour) {
    return subDays(now, 1);
  }
  
  return now;
}
