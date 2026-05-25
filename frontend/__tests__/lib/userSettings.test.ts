import {
  DEFAULT_USER_SETTINGS,
  mergeUserSettingsUpdate,
  normalizeUserSettings,
} from '@/lib/userSettings';

describe('user settings helpers', () => {
  it('normalizes missing settings with daily review defaults', () => {
    expect(normalizeUserSettings({})).toEqual({
      ...DEFAULT_USER_SETTINGS,
      last_session_date: undefined,
      pending_daily_review: null,
    });
  });

  it('preserves sequential daily review updates when each update starts from latest settings', () => {
    const pendingReview = {
      review_date: '2026-05-24T07:00:00.000Z',
      created_at: '2026-05-25T14:00:00.000Z',
    };
    const initialSettings = normalizeUserSettings({
      total_rewards: 20,
      last_session_date: '2026-05-24',
      pending_daily_review: pendingReview,
    });

    const afterPenalty = mergeUserSettingsUpdate(initialSettings, { total_rewards: 10 });
    const afterLastSessionUpdate = mergeUserSettingsUpdate(afterPenalty, {
      last_session_date: '2026-05-25',
    });
    const afterReviewClear = mergeUserSettingsUpdate(afterLastSessionUpdate, {
      pending_daily_review: null,
    });

    expect(afterReviewClear.total_rewards).toBe(10);
    expect(afterReviewClear.last_session_date).toBe('2026-05-25');
    expect(afterReviewClear.pending_daily_review).toBeNull();
  });
});
