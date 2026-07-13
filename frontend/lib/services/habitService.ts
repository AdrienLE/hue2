import { api } from '../api';
import { getLogicalDateRange } from '@/lib/logicalTime';
import { requestWidgetRefresh } from '@/lib/widgetBridge';
import type { ApiResponse } from '../api';
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

type FilterValue = string | number | boolean;

const QUERY_PARAM_ALIASES: Record<string, string> = {
  habitId: 'habit_id',
  subHabitId: 'sub_habit_id',
  startDate: 'start_date',
  endDate: 'end_date',
};

const buildQueryString = (filters: Record<string, FilterValue | undefined> = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    const paramKey = QUERY_PARAM_ALIASES[key] ?? key;
    params.append(paramKey, value.toString());
  });
  const query = params.toString();
  return query ? `?${query}` : '';
};

const notifyWidgetAfterSuccess = async <T>(
  responsePromise: Promise<ApiResponse<T>>
): Promise<ApiResponse<T>> => {
  const response = await responsePromise;
  if (!response.error && response.status >= 200 && response.status < 300) {
    void requestWidgetRefresh();
  }
  return response;
};

export class HabitService {
  // User management
  static async getCurrentUser(token: string) {
    return api.get<User>('/api/users/me', token);
  }

  static async updateCurrentUser(userData: Partial<User>, token: string) {
    return notifyWidgetAfterSuccess(api.put<User>('/api/users/me', userData, token));
  }

  static async adjustReward(delta: number, token: string) {
    return notifyWidgetAfterSuccess(
      api.post<{ total_rewards: number }>('/api/users/me/rewards/adjust', { delta }, token)
    );
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
    return notifyWidgetAfterSuccess(api.post<Habit>('/api/habits', habitData, token));
  }

  static async updateHabit(habitId: number, habitData: HabitUpdate, token: string) {
    return notifyWidgetAfterSuccess(api.put<Habit>(`/api/habits/${habitId}`, habitData, token));
  }

  static async deleteHabit(habitId: number, token: string, hardDelete = false) {
    const endpoint = `/api/habits/${habitId}?hard_delete=${hardDelete}`;
    return notifyWidgetAfterSuccess(api.delete(endpoint, token));
  }

  // Sub-habit management
  static async getSubHabits(habitId: number, token: string) {
    return api.get<SubHabit[]>(`/api/habits/${habitId}/sub-habits`, token);
  }

  static async createSubHabit(subHabitData: SubHabitCreate, token: string) {
    return notifyWidgetAfterSuccess(api.post<SubHabit>('/api/sub-habits', subHabitData, token));
  }

  static async updateSubHabit(
    subHabitId: number,
    subHabitData: Partial<SubHabitCreate>,
    token: string
  ) {
    return notifyWidgetAfterSuccess(
      api.put<SubHabit>(`/api/sub-habits/${subHabitId}`, subHabitData, token)
    );
  }

  static async deleteSubHabit(subHabitId: number, token: string) {
    return notifyWidgetAfterSuccess(api.delete(`/api/sub-habits/${subHabitId}`, token));
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
    const endpoint = `/api/checks${buildQueryString(filters)}`;
    return api.get<Check[]>(endpoint, token);
  }

  static async createCheck(checkData: CheckCreate, token: string) {
    return notifyWidgetAfterSuccess(api.post<Check>('/api/checks', checkData, token));
  }

  static async deleteCheck(checkId: number, token: string) {
    return notifyWidgetAfterSuccess(api.delete(`/api/checks/${checkId}`, token));
  }

  static async uncheckHabitToday(
    habitId: number,
    token: string,
    options: {
      rolloverHour?: number;
      currentDate?: Date;
    } = {}
  ) {
    const { rolloverHour = 3, currentDate = new Date() } = options;
    const { startDate, endDate } = getLogicalDateRange(rolloverHour, currentDate);

    const checks = await this.getChecks(token, {
      habitId,
      startDate,
      endDate,
    });

    // A parent uncheck must not erase independently completed sub-habits.
    if (checks.data && checks.data.length > 0) {
      const deletePromises = checks.data
        .filter(check => check.sub_habit_id == null)
        .map(check => this.deleteCheck(check.id, token));
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
    const endpoint = `/api/counts${buildQueryString(filters)}`;
    return api.get<Count[]>(endpoint, token);
  }

  static async createCount(countData: CountCreate, token: string) {
    return notifyWidgetAfterSuccess(api.post<Count>('/api/counts', countData, token));
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
    const endpoint = `/api/weight-updates${buildQueryString(filters)}`;
    return api.get<WeightUpdate[]>(endpoint, token);
  }

  static async createWeightUpdate(weightData: WeightUpdateCreate, token: string) {
    return notifyWidgetAfterSuccess(
      api.post<WeightUpdate>('/api/weight-updates', weightData, token)
    );
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
    const endpoint = `/api/active-days${buildQueryString(filters)}`;
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
