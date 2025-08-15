import { HabitService } from '@/lib/services/habitService';
import { api } from '@/lib/api';
import type { HabitCreate, CountCreate, WeightUpdateCreate } from '@/lib/types/habits';

// Mock the API module
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));
const mockApi = api as any;

describe('HabitService', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Management', () => {
    it('should get current user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.get.mockResolvedValue({ data: mockUser, status: 200 });

      const result = await HabitService.getCurrentUser(mockToken);

      expect(mockApi.get).toHaveBeenCalledWith('/api/users/me', mockToken);
      expect(result.data).toEqual(mockUser);
    });

    it('should update current user', async () => {
      const updateData = { name: 'Updated Name' };
      const mockUpdatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Updated Name',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.put.mockResolvedValue({ data: mockUpdatedUser, status: 200 });

      const result = await HabitService.updateCurrentUser(updateData, mockToken);

      expect(mockApi.put).toHaveBeenCalledWith('/api/users/me', updateData, mockToken);
      expect(result.data).toEqual(mockUpdatedUser);
    });
  });

  describe('Habit Management', () => {
    it('should get habits', async () => {
      const mockHabits = [
        {
          id: 1,
          user_id: 'user-123',
          name: 'Test Habit',
          has_counts: false,
          is_weight: false,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          user_id: 'user-123',
          name: 'Count Habit',
          has_counts: true,
          is_weight: false,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockApi.get.mockResolvedValue({ data: mockHabits, status: 200 });

      const result = await HabitService.getHabits(mockToken);

      expect(mockApi.get).toHaveBeenCalledWith('/api/habits?include_deleted=false', mockToken);
      expect(result.data).toEqual(mockHabits);
    });

    it('should get habits including deleted', async () => {
      mockApi.get.mockResolvedValue({ data: [], status: 200 });

      await HabitService.getHabits(mockToken, true);

      expect(mockApi.get).toHaveBeenCalledWith('/api/habits?include_deleted=true', mockToken);
    });

    it('should get single habit', async () => {
      const mockHabit = {
        id: 1,
        user_id: 'user-123',
        name: 'Test Habit',
        has_counts: false,
        is_weight: false,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.get.mockResolvedValue({ data: mockHabit, status: 200 });

      const result = await HabitService.getHabit(1, mockToken);

      expect(mockApi.get).toHaveBeenCalledWith('/api/habits/1', mockToken);
      expect(result.data).toEqual(mockHabit);
    });

    it('should create habit', async () => {
      const habitData: HabitCreate = {
        name: 'New Habit',
        description: 'A new habit',
        has_counts: false,
        is_weight: false,
        reward_settings: { success_points: 10 },
      };

      const mockCreatedHabit = {
        id: 1,
        user_id: 'user-123',
        ...habitData,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.post.mockResolvedValue({ data: mockCreatedHabit, status: 200 });

      const result = await HabitService.createHabit(habitData, mockToken);

      expect(mockApi.post).toHaveBeenCalledWith('/api/habits', habitData, mockToken);
      expect(result.data).toEqual(mockCreatedHabit);
    });

    it('should update habit', async () => {
      const updateData = { name: 'Updated Habit Name' };
      const mockUpdatedHabit = {
        id: 1,
        user_id: 'user-123',
        name: 'Updated Habit Name',
        has_counts: false,
        is_weight: false,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.put.mockResolvedValue({ data: mockUpdatedHabit, status: 200 });

      const result = await HabitService.updateHabit(1, updateData, mockToken);

      expect(mockApi.put).toHaveBeenCalledWith('/api/habits/1', updateData, mockToken);
      expect(result.data).toEqual(mockUpdatedHabit);
    });

    it('should delete habit with soft delete', async () => {
      mockApi.delete.mockResolvedValue({ status: 200 });

      const result = await HabitService.deleteHabit(1, mockToken);

      expect(mockApi.delete).toHaveBeenCalledWith('/api/habits/1?hard_delete=false', mockToken);
      expect(result.status).toBe(200);
    });

    it('should delete habit with hard delete', async () => {
      mockApi.delete.mockResolvedValue({ status: 200 });

      const result = await HabitService.deleteHabit(1, mockToken, true);

      expect(mockApi.delete).toHaveBeenCalledWith('/api/habits/1?hard_delete=true', mockToken);
      expect(result.status).toBe(200);
    });
  });

  describe('Sub-habit Management', () => {
    it('should get sub-habits', async () => {
      const mockSubHabits = [
        {
          id: 1,
          parent_habit_id: 1,
          user_id: 'user-123',
          name: 'Sub-habit 1',
          order_index: 0,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockApi.get.mockResolvedValue({ data: mockSubHabits, status: 200 });

      const result = await HabitService.getSubHabits(1, mockToken);

      expect(mockApi.get).toHaveBeenCalledWith('/api/habits/1/sub-habits', mockToken);
      expect(result.data).toEqual(mockSubHabits);
    });

    it('should create sub-habit', async () => {
      const subHabitData = {
        parent_habit_id: 1,
        name: 'New Sub-habit',
        order_index: 0,
      };

      const mockCreatedSubHabit = {
        id: 1,
        user_id: 'user-123',
        ...subHabitData,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.post.mockResolvedValue({ data: mockCreatedSubHabit, status: 200 });

      const result = await HabitService.createSubHabit(subHabitData, mockToken);

      expect(mockApi.post).toHaveBeenCalledWith('/api/sub-habits', subHabitData, mockToken);
      expect(result.data).toEqual(mockCreatedSubHabit);
    });
  });

  describe('Check Management', () => {
    it('should get checks with filters', async () => {
      const mockChecks = [
        {
          id: 1,
          user_id: 'user-123',
          habit_id: 1,
          checked: true,
          check_date: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockApi.get.mockResolvedValue({ data: mockChecks, status: 200 });

      const filters = {
        habitId: 1,
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-02T00:00:00Z',
      };

      const result = await HabitService.getChecks(mockToken, filters);

      expect(mockApi.get).toHaveBeenCalledWith(
        '/api/checks?habitId=1&startDate=2024-01-01T00%3A00%3A00Z&endDate=2024-01-02T00%3A00%3A00Z',
        mockToken
      );
      expect(result.data).toEqual(mockChecks);
    });

    it('should create check', async () => {
      const checkData = {
        habit_id: 1,
        checked: true,
        check_date: '2024-01-01T00:00:00Z',
      };

      const mockCreatedCheck = {
        id: 1,
        user_id: 'user-123',
        ...checkData,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.post.mockResolvedValue({ data: mockCreatedCheck, status: 200 });

      const result = await HabitService.createCheck(checkData, mockToken);

      expect(mockApi.post).toHaveBeenCalledWith('/api/checks', checkData, mockToken);
      expect(result.data).toEqual(mockCreatedCheck);
    });
  });

  describe('Count Management', () => {
    it('should get counts with filters', async () => {
      const mockCounts = [
        {
          id: 1,
          user_id: 'user-123',
          habit_id: 1,
          value: 25,
          count_date: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockApi.get.mockResolvedValue({ data: mockCounts, status: 200 });

      const filters = { habitId: 1 };
      const result = await HabitService.getCounts(mockToken, filters);

      expect(mockApi.get).toHaveBeenCalledWith('/api/counts?habitId=1', mockToken);
      expect(result.data).toEqual(mockCounts);
    });

    it('should create count', async () => {
      const countData: CountCreate = {
        habit_id: 1,
        value: 50,
        count_date: '2024-01-01T00:00:00Z',
      };

      const mockCreatedCount = {
        id: 1,
        user_id: 'user-123',
        ...countData,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.post.mockResolvedValue({ data: mockCreatedCount, status: 200 });

      const result = await HabitService.createCount(countData, mockToken);

      expect(mockApi.post).toHaveBeenCalledWith('/api/counts', countData, mockToken);
      expect(result.data).toEqual(mockCreatedCount);
    });
  });

  describe('Weight Management', () => {
    it('should get weight updates', async () => {
      const mockWeightUpdates = [
        {
          id: 1,
          user_id: 'user-123',
          habit_id: 1,
          weight: 70.5,
          update_date: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockApi.get.mockResolvedValue({ data: mockWeightUpdates, status: 200 });

      const result = await HabitService.getWeightUpdates(mockToken, { habitId: 1 });

      expect(mockApi.get).toHaveBeenCalledWith('/api/weight-updates?habitId=1', mockToken);
      expect(result.data).toEqual(mockWeightUpdates);
    });

    it('should create weight update', async () => {
      const weightData: WeightUpdateCreate = {
        habit_id: 1,
        weight: 68.5,
        update_date: '2024-01-01T00:00:00Z',
      };

      const mockCreatedUpdate = {
        id: 1,
        user_id: 'user-123',
        ...weightData,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.post.mockResolvedValue({ data: mockCreatedUpdate, status: 200 });

      const result = await HabitService.createWeightUpdate(weightData, mockToken);

      expect(mockApi.post).toHaveBeenCalledWith('/api/weight-updates', weightData, mockToken);
      expect(result.data).toEqual(mockCreatedUpdate);
    });
  });

  describe('Active Day Management', () => {
    it('should get active days', async () => {
      const mockActiveDays = [
        {
          id: 1,
          user_id: 'user-123',
          date: '2024-01-01T00:00:00Z',
          validated: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockApi.get.mockResolvedValue({ data: mockActiveDays, status: 200 });

      const result = await HabitService.getActiveDays(mockToken);

      expect(mockApi.get).toHaveBeenCalledWith('/api/active-days?', mockToken);
      expect(result.data).toEqual(mockActiveDays);
    });

    it('should create active day', async () => {
      const dayData = {
        date: '2024-01-01T00:00:00Z',
        validated: false,
        summary_data: { total_habits: 3, completed: 2 },
      };

      const mockCreatedDay = {
        id: 1,
        user_id: 'user-123',
        ...dayData,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.post.mockResolvedValue({ data: mockCreatedDay, status: 200 });

      const result = await HabitService.createActiveDay(dayData, mockToken);

      expect(mockApi.post).toHaveBeenCalledWith('/api/active-days', dayData, mockToken);
      expect(result.data).toEqual(mockCreatedDay);
    });

    it('should update active day', async () => {
      const updates = { validated: true };
      const mockUpdatedDay = {
        id: 1,
        user_id: 'user-123',
        date: '2024-01-01T00:00:00Z',
        validated: true,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.put.mockResolvedValue({ data: mockUpdatedDay, status: 200 });

      const result = await HabitService.updateActiveDay(1, updates, mockToken);

      expect(mockApi.put).toHaveBeenCalledWith('/api/active-days/1', updates, mockToken);
      expect(result.data).toEqual(mockUpdatedDay);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      const errorResponse = {
        status: 404,
        error: 'Habit not found',
      };

      mockApi.get.mockResolvedValue(errorResponse);

      const result = await HabitService.getHabit(999, mockToken);

      expect(result.status).toBe(404);
      expect(result.error).toBe('Habit not found');
    });

    it('should handle network errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));

      await expect(HabitService.getHabit(1, mockToken)).rejects.toThrow('Network error');
    });
  });

  describe('Additional Coverage Tests', () => {
    it('should handle updateCurrentUser', async () => {
      const userData = { name: 'Updated Name' };
      const mockUpdatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Updated Name',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.put.mockResolvedValue({ data: mockUpdatedUser, status: 200 });

      const result = await HabitService.updateCurrentUser(userData, mockToken);

      expect(mockApi.put).toHaveBeenCalledWith('/api/users/me', userData, mockToken);
      expect(result.data).toEqual(mockUpdatedUser);
    });

    it('should handle updateSubHabit', async () => {
      const subHabitId = 1;
      const updates = { name: 'Updated Sub Habit' };
      const mockUpdatedSubHabit = {
        id: 1,
        parent_habit_id: 1,
        user_id: 'user-123',
        name: 'Updated Sub Habit',
        order_index: 0,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockApi.put.mockResolvedValue({ data: mockUpdatedSubHabit, status: 200 });

      const result = await HabitService.updateSubHabit(subHabitId, updates, mockToken);

      expect(mockApi.put).toHaveBeenCalledWith('/api/sub-habits/1', updates, mockToken);
      expect(result.data).toEqual(mockUpdatedSubHabit);
    });

    it('should handle getHabits with includeDeleted flag', async () => {
      const mockHabits = [
        {
          id: 1,
          user_id: 'user-123',
          name: 'Test Habit',
          has_counts: false,
          is_weight: false,
          deleted_at: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockApi.get.mockResolvedValue({ data: mockHabits, status: 200 });

      const result = await HabitService.getHabits(mockToken, true);

      expect(mockApi.get).toHaveBeenCalledWith('/api/habits?include_deleted=true', mockToken);
      expect(result.data).toEqual(mockHabits);
    });

    it('should handle deleteHabit with hardDelete flag', async () => {
      mockApi.delete.mockResolvedValue({ status: 200 });

      const result = await HabitService.deleteHabit(1, mockToken, true);

      expect(mockApi.delete).toHaveBeenCalledWith('/api/habits/1?hard_delete=true', mockToken);
      expect(result.status).toBe(200);
    });
  });
});
