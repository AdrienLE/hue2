/**
 * Utilities for computing logical dates based on a user-configurable rollover hour.
 * All helpers operate in the caller's local timezone and return ISO 8601 strings
 * so the backend can store and compare consistently in UTC.
 */

const MS_IN_DAY = 24 * 60 * 60 * 1000;

export function getLogicalDayStartDate(
  rolloverHour: number = 3,
  currentDate: Date = new Date()
): Date {
  const date = new Date(currentDate.getTime());
  const start = new Date(date.getTime());
  start.setHours(rolloverHour, 0, 0, 0);

  if (date.getTime() < start.getTime()) {
    start.setTime(start.getTime() - MS_IN_DAY);
  }

  return start;
}

export function getLogicalDayEndDate(
  rolloverHour: number = 3,
  currentDate: Date = new Date()
): Date {
  const start = getLogicalDayStartDate(rolloverHour, currentDate);
  const end = new Date(start.getTime() + MS_IN_DAY - 1);
  return end;
}

export function getLogicalDayStartISO(
  rolloverHour: number = 3,
  currentDate: Date = new Date()
): string {
  return getLogicalDayStartDate(rolloverHour, currentDate).toISOString();
}

export function getLogicalDayEndISO(
  rolloverHour: number = 3,
  currentDate: Date = new Date()
): string {
  return getLogicalDayEndDate(rolloverHour, currentDate).toISOString();
}

export function getLogicalDate(rolloverHour: number = 3, currentDate: Date = new Date()): string {
  const start = getLogicalDayStartDate(rolloverHour, currentDate);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLogicalDateRange(
  rolloverHour: number = 3,
  currentDate: Date = new Date()
): { startDate: string; endDate: string } {
  return {
    startDate: getLogicalDayStartISO(rolloverHour, currentDate),
    endDate: getLogicalDayEndISO(rolloverHour, currentDate),
  };
}

export function getLogicalDateTimestamp(
  rolloverHour: number = 3,
  currentDate: Date = new Date()
): string {
  const date = new Date(currentDate.getTime());
  const rawStart = new Date(currentDate.getTime());
  rawStart.setHours(rolloverHour, 0, 0, 0);

  if (date.getTime() < rawStart.getTime()) {
    date.setTime(date.getTime() - MS_IN_DAY);
  }

  return date.toISOString();
}

export function getLocalTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

export function isTimestampOnLogicalDay(
  timestamp: string | Date,
  rolloverHour: number,
  baseDate: Date
): boolean {
  const checkDate = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return getLogicalDate(rolloverHour, checkDate) === getLogicalDate(rolloverHour, baseDate);
}
