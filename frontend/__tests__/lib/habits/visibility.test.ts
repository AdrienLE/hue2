import {
  filterHabitsForMode,
  getEmptyHabitMessage,
  getHabitDayState,
} from '@/lib/habits/visibility';
import type { Habit } from '@/lib/types/habits';

const habit = (id: number, weekdays?: number[]): Habit => ({
  id,
  user_id: 'user',
  name: `Habit ${id}`,
  has_counts: false,
  is_weight: false,
  schedule_settings: weekdays ? { weekdays } : undefined,
  created_at: '2026-07-12T00:00:00Z',
});

describe('habit ledger visibility', () => {
  const habits = [habit(1, [0]), habit(2, [0]), habit(3, [1])];
  const state = getHabitDayState(habits, new Set([2, 3]), 0);

  it('shows only scheduled unfinished habits in Active', () => {
    expect(filterHabitsForMode(habits, 'active', state).map(item => item.id)).toEqual([1]);
  });

  it('shows completed habits in Done, including an unscheduled completion', () => {
    expect(filterHabitsForMode(habits, 'done', state).map(item => item.id)).toEqual([2, 3]);
  });

  it('keeps canonical order in All and uses mode-specific empty copy', () => {
    expect(filterHabitsForMode(habits, 'all', state)).toEqual(habits);
    expect(getEmptyHabitMessage('done', true)).toBe('Nothing completed yet');
    expect(getEmptyHabitMessage('active', true)).toBe('Everything scheduled is complete');
  });
});
