import { isTimestampOnLogicalDay } from '@/lib/logicalTime';
import type { Check } from '@/lib/types/habits';

/**
 * Returns parent habit ids that have a check within the caller's logical day.
 * Sub-habit checks are ignored so they don't silently complete the parent.
 */
export const getCheckedHabitIdsToday = (
  checks: Check[] = [],
  rolloverHour: number,
  baseDate: Date
): Set<number> => {
  const ids = new Set<number>();
  checks.forEach(check => {
    if (
      check.sub_habit_id ||
      typeof check.habit_id !== 'number' ||
      !isTimestampOnLogicalDay(check.check_date, rolloverHour, baseDate)
    ) {
      return;
    }
    ids.add(check.habit_id);
  });
  return ids;
};

/**
 * Returns sub-habit ids that have checks within the logical day.
 * Optional filtering by known sub-habit ids mirrors the HabitCard logic.
 */
export const getCheckedSubHabitIdsToday = (
  checks: Check[] = [],
  rolloverHour: number,
  baseDate: Date,
  subHabitIds?: number[]
): Set<number> => {
  const ids = new Set<number>();
  checks.forEach(check => {
    if (
      typeof check.sub_habit_id !== 'number' ||
      !isTimestampOnLogicalDay(check.check_date, rolloverHour, baseDate)
    ) {
      return;
    }
    if (subHabitIds && !subHabitIds.includes(check.sub_habit_id)) {
      return;
    }
    ids.add(check.sub_habit_id);
  });
  return ids;
};
