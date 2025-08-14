import { getLogicalDate, getLogicalDateTimestamp, getLogicalDateRange } from '@/contexts/DevDateContext';

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
      const { startDate, endDate } = getLogicalDateRange(3, testDate);
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Should start at 3am on logical date (Jan 14th)
      expect(start.toISOString()).toContain('2024-01-14T03:00:00');
      
      // Should end at 2:59:59 on next day (Jan 15th)
      expect(end.toISOString()).toContain('2024-01-15T02:59:59');
    });
  });
});