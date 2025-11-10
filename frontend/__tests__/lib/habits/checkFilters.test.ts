import { getCheckedHabitIdsToday, getCheckedSubHabitIdsToday } from '@/lib/habits/checkFilters';
import type { Check } from '@/lib/types/habits';

const createCheck = (overrides: Partial<Check>): Check => ({
  id: overrides.id ?? Math.floor(Math.random() * 1000),
  user_id: overrides.user_id ?? 'user-1',
  habit_id: overrides.habit_id,
  sub_habit_id: overrides.sub_habit_id,
  checked: overrides.checked ?? true,
  check_date: overrides.check_date ?? new Date().toISOString(),
  metadata_json: overrides.metadata_json,
  created_at: overrides.created_at ?? new Date().toISOString(),
  updated_at: overrides.updated_at,
});

describe('checkFilters', () => {
  const rolloverHour = 3; // mirrors production default

  describe('getCheckedHabitIdsToday', () => {
    it('includes only parent habit checks that fall within the logical day window', () => {
      const baseDate = new Date('2024-06-01T12:00:00.000Z');
      const checks: Check[] = [
        createCheck({
          id: 1,
          habit_id: 11,
          check_date: '2024-06-01T12:00:00.000Z',
        }),
        createCheck({
          id: 2,
          habit_id: 11,
          sub_habit_id: 111,
          check_date: '2024-06-01T04:05:00.000Z',
        }),
        createCheck({
          id: 3,
          habit_id: 22,
          check_date: '2024-06-02T12:00:00.000Z',
        }),
      ];

      const result = getCheckedHabitIdsToday(checks, rolloverHour, baseDate);

      expect(result.has(11)).toBe(true);
      expect(result.has(22)).toBe(false); // outside current logical day
      // Sub-habit check should not complete its parent automatically
      expect(result.size).toBe(1);
    });
  });

  describe('getCheckedSubHabitIdsToday', () => {
    it('returns matching sub-habit ids using logical-time comparisons', () => {
      const baseDate = new Date('2024-06-01T12:00:00.000Z');
      const checks: Check[] = [
        createCheck({
          id: 5,
          habit_id: 44,
          sub_habit_id: 444,
          check_date: '2024-06-01T12:00:00.000Z',
        }),
        createCheck({
          id: 6,
          habit_id: 44,
          sub_habit_id: 445,
          check_date: '2024-06-02T12:00:00.000Z',
        }),
      ];

      const withoutFilter = getCheckedSubHabitIdsToday(checks, rolloverHour, baseDate);
      expect(withoutFilter.has(444)).toBe(true); // inside logical window
      expect(withoutFilter.has(445)).toBe(false); // outside the logical window

      const filtered = getCheckedSubHabitIdsToday(checks, rolloverHour, baseDate, [445]);
      expect(filtered.size).toBe(0); // filter excludes 444 even though it was checked
    });
  });
});
