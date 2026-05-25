import { getLogicalDate, getLogicalDateRange, isTimestampOnLogicalDay } from '@/lib/logicalTime';
import { getCheckedHabitIdsToday } from '@/lib/habits/checkFilters';
import type { Check, Count, Habit, WeightUpdate } from '@/lib/types/habits';

const DEFAULT_REVIEW_ACTIVITY_LIMIT = 500;

export function getReviewBaseDate(reviewDate: Date, rolloverHour: number): Date {
  const baseDate = new Date(reviewDate);
  baseDate.setHours(rolloverHour, 0, 0, 0);
  return baseDate;
}

export function getReviewActivityWindow(reviewDate: Date, rolloverHour: number) {
  const baseDate = getReviewBaseDate(reviewDate, rolloverHour);
  const { startDate, endDate } = getLogicalDateRange(rolloverHour, baseDate);

  return {
    baseDate,
    startDate,
    endDate,
    limit: DEFAULT_REVIEW_ACTIVITY_LIMIT,
  };
}

export function getReviewCompletionSessionDate(
  rolloverHour: number,
  currentDate: Date = new Date()
): string {
  return getLogicalDate(rolloverHour, currentDate);
}

export function getReviewDateKey(rolloverHour: number, reviewBaseDate: Date): string {
  return getLogicalDate(rolloverHour, reviewBaseDate);
}

export function shouldDismissCompletedDailyReview({
  isVisible,
  pendingDailyReview,
  lastSessionDate,
  reviewDate,
  rolloverHour,
  currentDate = new Date(),
}: {
  isVisible: boolean;
  pendingDailyReview?: { review_date: string; created_at: string } | null;
  lastSessionDate?: string;
  reviewDate: Date;
  rolloverHour: number;
  currentDate?: Date;
}): boolean {
  if (!isVisible || pendingDailyReview || !lastSessionDate) {
    return false;
  }

  const currentLogicalDate = getLogicalDate(rolloverHour, currentDate);
  if (lastSessionDate !== currentLogicalDate) {
    return false;
  }

  const reviewBaseDate = getReviewBaseDate(reviewDate, rolloverHour);
  const reviewDateKey = getReviewDateKey(rolloverHour, reviewBaseDate);
  return reviewDateKey !== currentLogicalDate;
}

export function getUncheckedReviewHabits({
  habits,
  checks,
  counts,
  weights,
  rolloverHour,
  reviewBaseDate,
}: {
  habits: Habit[];
  checks: Check[];
  counts: Count[];
  weights: WeightUpdate[];
  rolloverHour: number;
  reviewBaseDate: Date;
}): Habit[] {
  const trackedHabitIds = new Set<number>();

  const checkedHabitIds = getCheckedHabitIdsToday(checks, rolloverHour, reviewBaseDate);
  checkedHabitIds.forEach(habitId => trackedHabitIds.add(habitId));

  counts
    .filter(count => isTimestampOnLogicalDay(count.count_date, rolloverHour, reviewBaseDate))
    .forEach(count => trackedHabitIds.add(count.habit_id));

  weights
    .filter(weight => isTimestampOnLogicalDay(weight.update_date, rolloverHour, reviewBaseDate))
    .forEach(weight => trackedHabitIds.add(weight.habit_id));

  const reviewDayOfWeek = reviewBaseDate.getDay();

  return habits.filter(habit => {
    const weekdays = habit.schedule_settings?.weekdays || [0, 1, 2, 3, 4, 5, 6];
    return weekdays.includes(reviewDayOfWeek) && !trackedHabitIds.has(habit.id);
  });
}
