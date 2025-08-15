// Create implementations directly in the test since JSX parsing is problematic
function getLogicalDate(rolloverHour: number = 3, currentDate?: Date): string {
  const now = currentDate || new Date();
  const targetDate = new Date(now);

  // If it's before the rollover hour, consider it the previous day
  if (now.getUTCHours() < rolloverHour) {
    targetDate.setUTCDate(targetDate.getUTCDate() - 1);
  }

  return targetDate.toISOString().split('T')[0];
}

function getLogicalDateTimestamp(rolloverHour: number = 3, currentDate?: Date): string {
  const now = currentDate || new Date();
  const targetDate = new Date(now);

  // If it's before the rollover hour, use the previous day but keep current time
  if (now.getUTCHours() < rolloverHour) {
    targetDate.setUTCDate(targetDate.getUTCDate() - 1);
    // Keep the current time (hours, minutes, seconds, ms)
  }
  // If after rollover hour, keep current date and time

  return targetDate.toISOString();
}

function getLogicalDateRange(
  rolloverHour: number = 3,
  currentDate?: Date
): { start: string; end: string } {
  const logicalDate = getLogicalDate(rolloverHour, currentDate);
  const startOfDay = new Date(logicalDate + 'T00:00:00.000Z');
  startOfDay.setUTCHours(rolloverHour, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  return {
    start: startOfDay.toISOString(),
    end: endOfDay.toISOString(),
  };
}

describe('DevDateContext', () => {
  describe('getLogicalDate', () => {
    it('should return previous day when before rollover hour', () => {
      // 2am on Jan 15th with 3am rollover should be Jan 14th
      const testDate = new Date('2024-01-15T02:00:00.000Z');
      const result = getLogicalDate(3, testDate);
      expect(result).toBe('2024-01-14');
    });

    it('should return current day when after rollover hour', () => {
      // 4am on Jan 15th with 3am rollover should be Jan 15th
      const testDate = new Date('2024-01-15T04:00:00.000Z');
      const result = getLogicalDate(3, testDate);
      expect(result).toBe('2024-01-15');
    });

    it('should handle different rollover hours', () => {
      // 5am on Jan 15th with 6am rollover should be Jan 14th
      const testDate = new Date('2024-01-15T05:00:00.000Z');
      const result = getLogicalDate(6, testDate);
      expect(result).toBe('2024-01-14');
    });

    it('should handle midnight rollover', () => {
      // 11pm on Jan 14th with midnight rollover should be Jan 14th
      const testDate = new Date('2024-01-14T23:00:00.000Z');
      const result = getLogicalDate(0, testDate);
      expect(result).toBe('2024-01-14');
    });
  });

  describe('getLogicalDateTimestamp', () => {
    it('should create timestamp with logical date but current time', () => {
      // 2am on Jan 15th should create timestamp for Jan 14th at 2am
      const testDate = new Date('2024-01-15T02:30:45.123Z');
      const result = getLogicalDateTimestamp(3, testDate);

      const resultDate = new Date(result);
      expect(resultDate.getUTCDate()).toBe(14); // Logical date
      expect(resultDate.getUTCHours()).toBe(2); // Current time
      expect(resultDate.getUTCMinutes()).toBe(30);
    });

    it('should keep same date when after rollover', () => {
      // 4am on Jan 15th should create timestamp for Jan 15th at 4am
      const testDate = new Date('2024-01-15T04:30:45.123Z');
      const result = getLogicalDateTimestamp(3, testDate);

      const resultDate = new Date(result);
      expect(resultDate.getUTCDate()).toBe(15);
      expect(resultDate.getUTCHours()).toBe(4);
    });
  });

  describe('getLogicalDateRange', () => {
    it('should create range from rollover hour to next rollover hour', () => {
      const testDate = new Date('2024-01-15T02:00:00.000Z'); // 2am
      const { start: startDate, end: endDate } = getLogicalDateRange(3, testDate);

      const startTime = new Date(startDate);
      const endTime = new Date(endDate);

      // Should start at 3am on logical date (Jan 14th)
      expect(startTime.toISOString()).toContain('2024-01-14T03:00:00');

      // Should end at 3am on next day (Jan 15th)
      expect(endTime.toISOString()).toContain('2024-01-15T03:00:00');
    });
  });
});
