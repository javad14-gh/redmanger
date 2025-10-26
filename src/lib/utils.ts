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


/**
 * Calculates the distance between two geographical points in meters.
 * @param lat1 Latitude of the first point.
 * @param lon1 Longitude of the first point.
 * @param lat2 Latitude of the second point.
 * @param lon2 Longitude of the second point.
 * @returns The distance in meters.
 */
export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radius of the Earth in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
