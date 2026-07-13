import type { Habit } from '@/lib/types/habits';
import type { HabitVisibilityMode } from '@/contexts/HabitVisibilityContext';

export interface HabitDayState {
  scheduledIds: Set<number>;
  completedIds: Set<number>;
  unscheduledIds: Set<number>;
}

export function getHabitDayState(
  habits: Habit[],
  completedIds: Set<number>,
  dayOfWeek: number
): HabitDayState {
  const scheduledIds = new Set<number>();
  const unscheduledIds = new Set<number>();

  habits.forEach(habit => {
    const weekdays = habit.schedule_settings?.weekdays ?? [0, 1, 2, 3, 4, 5, 6];
    (weekdays.includes(dayOfWeek) ? scheduledIds : unscheduledIds).add(habit.id);
  });

  return { scheduledIds, completedIds, unscheduledIds };
}

export function filterHabitsForMode(
  habits: Habit[],
  mode: HabitVisibilityMode,
  state: HabitDayState
): Habit[] {
  if (mode === 'all') return habits;
  if (mode === 'done') return habits.filter(habit => state.completedIds.has(habit.id));
  return habits.filter(
    habit => state.scheduledIds.has(habit.id) && !state.completedIds.has(habit.id)
  );
}

export function getEmptyHabitMessage(mode: HabitVisibilityMode, hasHabits: boolean): string {
  if (!hasHabits) return 'No habits yet';
  if (mode === 'done') return 'Nothing completed yet';
  if (mode === 'all') return 'No habits to show';
  return 'Everything scheduled is complete';
}
