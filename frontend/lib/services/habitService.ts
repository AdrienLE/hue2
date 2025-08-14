import { api } from '../api';
import type {
  Habit,
  HabitCreate,
  HabitUpdate,
  SubHabit,
  SubHabitCreate,
  Check,
  CheckCreate,
  Count,
  CountCreate,
  WeightUpdate,
  WeightUpdateCreate,
  ActiveDay,
  User,
} from '../types/habits';

export class HabitService {
  // User management
  static async getCurrentUser(token: string) {
    return api.get<User>('/api/users/me', token);
  }

  static async updateCurrentUser(userData: Partial<User>, token: string) {
    return api.put<User>('/api/users/me', userData, token);
  }

  // Habit management
  static async getHabits(token: string, includeDeleted = false) {
    const endpoint = `/api/habits?include_deleted=${includeDeleted}`;
    return api.get<Habit[]>(endpoint, token);
  }

  static async getHabit(habitId: number, token: string) {
    return api.get<Habit>(`/api/habits/${habitId}`, token);
  }

  static async createHabit(habitData: HabitCreate, token: string) {
    return api.post<Habit>('/api/habits', habitData, token);
  }

  static async updateHabit(habitId: number, habitData: HabitUpdate, token: string) {
    return api.put<Habit>(`/api/habits/${habitId}`, habitData, token);
  }

  static async deleteHabit(habitId: number, token: string, hardDelete = false) {
    const endpoint = `/api/habits/${habitId}?hard_delete=${hardDelete}`;
    return api.delete(endpoint, token);
  }

  // Sub-habit management
  static async getSubHabits(habitId: number, token: string) {
    return api.get<SubHabit[]>(`/api/habits/${habitId}/sub-habits`, token);
  }

  static async createSubHabit(subHabitData: SubHabitCreate, token: string) {
    return api.post<SubHabit>('/api/sub-habits', subHabitData, token);
  }

  static async updateSubHabit(
    subHabitId: number,
    subHabitData: Partial<SubHabitCreate>,
    token: string
  ) {
    return api.put<SubHabit>(`/api/sub-habits/${subHabitId}`, subHabitData, token);
  }

  static async deleteSubHabit(subHabitId: number, token: string) {
    return api.delete(`/api/sub-habits/${subHabitId}`, token);
  }

  // Check/uncheck habits
  static async getChecks(
    token: string,
    filters: {
      habitId?: number;
      subHabitId?: number;
      startDate?: string;
      endDate?: string;
      skip?: number;
      limit?: number;
    } = {}
  ) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });
    const endpoint = `/api/checks?${params.toString()}`;
    return api.get<Check[]>(endpoint, token);
  }

  static async createCheck(checkData: CheckCreate, token: string) {
    return api.post<Check>('/api/checks', checkData, token);
  }

  static async deleteCheck(checkId: number, token: string) {
    return api.delete(`/api/checks/${checkId}`, token);
  }

  static async uncheckHabitToday(habitId: number, token: string) {
    // Get today's checks for this habit
    // TODO: Get rollover hour from user settings
    const today = new Date().toISOString().split('T')[0];
    const checks = await this.getChecks(token, {
      habitId,
      startDate: today,
      endDate: today + 'T23:59:59.999Z',
    });

    // Delete all checks for today
    if (checks.data && checks.data.length > 0) {
      const deletePromises = checks.data.map(check => this.deleteCheck(check.id, token));
      return Promise.all(deletePromises);
    }

    return [];
  }

  // Count tracking
  static async getCounts(
    token: string,
    filters: {
      habitId?: number;
      startDate?: string;
      endDate?: string;
      skip?: number;
      limit?: number;
    } = {}
  ) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });
    const endpoint = `/api/counts?${params.toString()}`;
    return api.get<Count[]>(endpoint, token);
  }

  static async createCount(countData: CountCreate, token: string) {
    return api.post<Count>('/api/counts', countData, token);
  }

  // Weight tracking
  static async getWeightUpdates(
    token: string,
    filters: {
      habitId?: number;
      startDate?: string;
      endDate?: string;
      skip?: number;
      limit?: number;
    } = {}
  ) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });
    const endpoint = `/api/weight-updates?${params.toString()}`;
    return api.get<WeightUpdate[]>(endpoint, token);
  }

  static async createWeightUpdate(weightData: WeightUpdateCreate, token: string) {
    return api.post<WeightUpdate>('/api/weight-updates', weightData, token);
  }

  // Active day tracking
  static async getActiveDays(
    token: string,
    filters: {
      startDate?: string;
      endDate?: string;
      skip?: number;
      limit?: number;
    } = {}
  ) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });
    const endpoint = `/api/active-days?${params.toString()}`;
    return api.get<ActiveDay[]>(endpoint, token);
  }

  static async createActiveDay(
    activeDayData: { date: string; validated?: boolean; summary_data?: Record<string, any> },
    token: string
  ) {
    return api.post<ActiveDay>('/api/active-days', activeDayData, token);
  }

  static async updateActiveDay(
    activeDayId: number,
    updates: { validated?: boolean; summary_data?: Record<string, any> },
    token: string
  ) {
    return api.put<ActiveDay>(`/api/active-days/${activeDayId}`, updates, token);
  }
}
