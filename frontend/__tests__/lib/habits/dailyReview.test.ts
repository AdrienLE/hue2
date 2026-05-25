import {
  getReviewActivityWindow,
  getReviewBaseDate,
  getReviewCompletionSessionDate,
  getUncheckedReviewHabits,
  shouldDismissCompletedDailyReview,
} from '@/lib/habits/dailyReview';
import type { Check, Count, Habit, WeightUpdate } from '@/lib/types/habits';

const habit = (id: number, name: string, weekdays = [0, 1, 2, 3, 4, 5, 6]): Habit => ({
  id,
  user_id: 'user-1',
  name,
  has_counts: false,
  is_weight: false,
  schedule_settings: { weekdays },
  reward_settings: { penalty_points: 2 },
  created_at: '2026-05-01T12:00:00.000Z',
});

const check = (overrides: Partial<Check>): Check => ({
  id: overrides.id ?? 1,
  user_id: 'user-1',
  habit_id: overrides.habit_id,
  sub_habit_id: overrides.sub_habit_id,
  checked: overrides.checked ?? true,
  check_date: overrides.check_date ?? '2026-05-24T12:00:00.000Z',
  created_at: '2026-05-24T12:00:00.000Z',
});

const count = (overrides: Partial<Count>): Count => ({
  id: overrides.id ?? 1,
  user_id: 'user-1',
  habit_id: overrides.habit_id ?? 1,
  value: overrides.value ?? 1,
  count_date: overrides.count_date ?? '2026-05-24T12:00:00.000Z',
  created_at: '2026-05-24T12:00:00.000Z',
});

const weight = (overrides: Partial<WeightUpdate>): WeightUpdate => ({
  id: overrides.id ?? 1,
  user_id: 'user-1',
  habit_id: overrides.habit_id ?? 1,
  weight: overrides.weight ?? 180,
  update_date: overrides.update_date ?? '2026-05-24T12:00:00.000Z',
  created_at: '2026-05-24T12:00:00.000Z',
});

describe('daily review helpers', () => {
  const rolloverHour = 3;

  it('builds a bounded activity window for the reviewed logical day', () => {
    const reviewDate = new Date(2026, 4, 24, 22, 0, 0);
    const window = getReviewActivityWindow(reviewDate, rolloverHour);

    expect(window.baseDate).toEqual(new Date(2026, 4, 24, 3, 0, 0));
    expect(new Date(window.startDate)).toEqual(window.baseDate);
    expect(new Date(window.endDate).getTime() - new Date(window.startDate).getTime()).toBe(
      24 * 60 * 60 * 1000 - 1
    );
    expect(window.limit).toBe(500);
  });

  it('keeps a previous-day missing habit visible after the tab crosses rollover', () => {
    const reviewBaseDate = getReviewBaseDate(new Date(2026, 4, 24, 22, 0, 0), rolloverHour);
    const habits = [
      habit(1, 'Checked Sunday', [0]),
      habit(2, 'Missing Sunday', [0]),
      { ...habit(3, 'Count Sunday', [0]), has_counts: true },
      { ...habit(4, 'Weight Sunday', [0]), is_weight: true },
      habit(5, 'Monday only', [1]),
      habit(6, 'Parent with only subhabit checked', [0]),
    ];

    const result = getUncheckedReviewHabits({
      habits,
      checks: [
        check({ id: 10, habit_id: 1, check_date: '2026-05-24T12:00:00.000Z' }),
        check({
          id: 11,
          habit_id: 6,
          sub_habit_id: 601,
          check_date: '2026-05-24T12:00:00.000Z',
        }),
        check({ id: 12, habit_id: 2, check_date: '2026-05-25T12:00:00.000Z' }),
      ],
      counts: [count({ habit_id: 3, count_date: '2026-05-24T15:00:00.000Z' })],
      weights: [weight({ habit_id: 4, update_date: '2026-05-24T16:00:00.000Z' })],
      rolloverHour,
      reviewBaseDate,
    });

    expect(result.map(item => item.id)).toEqual([2, 6]);
  });

  it('uses the current logical day after review completion instead of skipping tomorrow', () => {
    expect(getReviewCompletionSessionDate(rolloverHour, new Date(2026, 4, 25, 4, 0, 0))).toBe(
      '2026-05-25'
    );
    expect(getReviewCompletionSessionDate(rolloverHour, new Date(2026, 4, 25, 2, 0, 0))).toBe(
      '2026-05-24'
    );
  });

  it('dismisses a stale open modal when another surface has completed the review', () => {
    expect(
      shouldDismissCompletedDailyReview({
        isVisible: true,
        pendingDailyReview: null,
        lastSessionDate: '2026-05-25',
        reviewDate: new Date(2026, 4, 24, 0, 0, 0),
        rolloverHour,
        currentDate: new Date(2026, 4, 25, 4, 0, 0),
      })
    ).toBe(true);
  });

  it('keeps an intentionally opened current-day review visible', () => {
    expect(
      shouldDismissCompletedDailyReview({
        isVisible: true,
        pendingDailyReview: null,
        lastSessionDate: '2026-05-25',
        reviewDate: new Date(2026, 4, 25, 0, 0, 0),
        rolloverHour,
        currentDate: new Date(2026, 4, 25, 4, 0, 0),
      })
    ).toBe(false);
  });

  it('keeps a stale-day review open while the server still has pending work', () => {
    expect(
      shouldDismissCompletedDailyReview({
        isVisible: true,
        pendingDailyReview: {
          review_date: '2026-05-24T07:00:00.000Z',
          created_at: '2026-05-25T11:00:00.000Z',
        },
        lastSessionDate: '2026-05-24',
        reviewDate: new Date(2026, 4, 24, 0, 0, 0),
        rolloverHour,
        currentDate: new Date(2026, 4, 25, 4, 0, 0),
      })
    ).toBe(false);
  });
});
