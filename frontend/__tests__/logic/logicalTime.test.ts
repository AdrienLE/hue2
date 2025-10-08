import {
  getLogicalDate,
  getLogicalDateRange,
  getLogicalDateTimestamp,
  isTimestampOnLogicalDay,
} from '@/lib/logicalTime';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

describe('logical time utilities', () => {
  describe('getLogicalDate', () => {
    it('returns previous day when before the rollover hour', () => {
      const date = new Date(2024, 5, 1, 2, 15, 0, 0);
      const expected = new Date(date);
      expected.setDate(expected.getDate() - 1);

      expect(getLogicalDate(3, date)).toBe(formatLocalDate(expected));
    });

    it('keeps the same day when on or after the rollover hour', () => {
      const date = new Date(2024, 5, 1, 10, 15, 0, 0);
      expect(getLogicalDate(3, date)).toBe(formatLocalDate(date));
    });
  });

  describe('getLogicalDateTimestamp', () => {
    it('returns an ISO string with timezone information', () => {
      const date = new Date(2024, 5, 1, 12, 34, 56, 789);
      const timestamp = getLogicalDateTimestamp(3, date);
      expect(timestamp.endsWith('Z')).toBe(true);
    });

    it('aligns timestamp with the logical day when before the rollover hour', () => {
      const date = new Date(2024, 5, 1, 2, 15, 30, 0);
      const expected = new Date(date);
      expected.setDate(expected.getDate() - 1);
      const timestamp = getLogicalDateTimestamp(3, date);

      expect(timestamp.startsWith(formatLocalDate(expected))).toBe(true);
    });

    it('keeps timestamp on the same day when after the rollover hour', () => {
      const date = new Date(2024, 5, 1, 10, 15, 30, 0);
      const timestamp = getLogicalDateTimestamp(3, date);
      expect(timestamp.startsWith(formatLocalDate(date))).toBe(true);
    });
  });

  describe('getLogicalDateRange', () => {
    it('produces boundaries that span exactly one logical day', () => {
      const date = new Date(2024, 5, 1, 2, 15, 0, 0);
      const { startDate, endDate } = getLogicalDateRange(3, date);
      const start = new Date(startDate);
      const end = new Date(endDate);

      const expectedStart = new Date(date);
      expectedStart.setHours(3, 0, 0, 0);
      if (date.getHours() < 3) {
        expectedStart.setDate(expectedStart.getDate() - 1);
      }

      expect(startDate.startsWith(expectedStart.toISOString().split('T')[0])).toBe(true);
      expect(end.getTime() - start.getTime()).toBe(DAY_IN_MS - 1);
    });

    it('advances the window when already past the rollover hour', () => {
      const date = new Date(2024, 5, 1, 15, 0, 0, 0);
      const { startDate, endDate } = getLogicalDateRange(3, date);
      const start = new Date(startDate);
      const end = new Date(endDate);

      const expectedStart = new Date(date);
      expectedStart.setHours(3, 0, 0, 0);
      if (date.getHours() < 3) {
        expectedStart.setDate(expectedStart.getDate() - 1);
      }

      expect(startDate.startsWith(expectedStart.toISOString().split('T')[0])).toBe(true);
      expect(end.getTime() - start.getTime()).toBe(DAY_IN_MS - 1);
    });
  });

  describe('isTimestampOnLogicalDay', () => {
    it('returns true when timestamp falls within the logical day window', () => {
      const baseDate = new Date(Date.UTC(2024, 5, 1, 12, 0, 0));
      const timestamp = '2024-06-01T14:00:00.000Z';

      expect(isTimestampOnLogicalDay(timestamp, 3, baseDate)).toBe(true);
    });

    it('returns false when timestamp lies outside the logical day window', () => {
      const baseDate = new Date(Date.UTC(2024, 5, 1, 12, 0, 0));
      const timestamp = '2024-06-01T02:00:00.000Z';

      expect(isTimestampOnLogicalDay(timestamp, 3, baseDate)).toBe(false);
    });
  });
});
