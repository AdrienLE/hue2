import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
// @ts-expect-error -- the installed renderer has no TypeScript declarations.
import TestRenderer, { act } from 'react-test-renderer';
import { HabitList } from '@/components/habits/HabitList';
import { HabitService } from '@/lib/services/habitService';

jest.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
  Platform: { OS: 'web' },
  StyleSheet: { create: (styles: object) => styles },
}));
jest.mock('react-native-draggable-flatlist', () => ({
  __esModule: true,
  default: 'FlatList',
  ScaleDecorator: 'ScaleDecorator',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/ThemedText', () => ({ ThemedText: 'ThemedText' }));
jest.mock('@/components/ThemedView', () => ({ ThemedView: 'ThemedView' }));
jest.mock('@/components/habits/DndKitHabitList', () => ({ DndKitHabitList: 'DndKitHabitList' }));
jest.mock('@/components/habits/HabitItem', () => ({ HabitItem: 'HabitItem' }));
jest.mock('@/components/habits/QuickAddHabit', () => ({ QuickAddHabit: 'QuickAddHabit' }));
jest.mock('@/components/habits/HabitFilterBar', () => ({ HabitFilterBar: 'HabitFilterBar' }));
jest.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ token: 'test-token' }) }));
jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ userSettings: { day_rollover_hour: 3 } }),
}));
jest.mock('@/contexts/HabitVisibilityContext', () => ({
  useHabitVisibility: () => ({ mode: 'all', setMode: jest.fn() }),
}));
jest.mock('@/contexts/DevDateContext', () => ({
  ...jest.requireActual<typeof import('@/lib/logicalTime')>('@/lib/logicalTime'),
  getCurrentDate: () => new Date('2026-09-05T12:00:00'),
  useDevDate: () => ({ customDateOverride: null }),
}));
jest.mock('@/hooks/useThemeColor', () => ({ useThemeColor: () => '#111111' }));
jest.mock('@/hooks/useRefetchOnFocus', () => ({ useRefetchOnFocus: jest.fn() }));
jest.mock('@/lib/services/habitService', () => ({
  HabitService: { getHabits: jest.fn(), getChecks: jest.fn(), updateHabit: jest.fn() },
}));

describe('HabitList reorder persistence', () => {
  const habits = [1, 2, 3].map((id, order) => ({
    id,
    name: `Habit ${id}`,
    created_at: '2026-09-05',
    display_settings: { order },
  }));
  beforeEach(() => {
    jest.clearAllMocks();
    (HabitService.getHabits as jest.Mock<any>).mockResolvedValue({ data: habits, status: 200 });
    (HabitService.getChecks as jest.Mock<any>).mockResolvedValue({ data: [], status: 200 });
    (HabitService.updateHabit as jest.Mock<any>).mockResolvedValue({ data: {}, status: 200 });
  });

  it('persists a second reorder back to the original positions', async () => {
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<HabitList />);
    });
    const list = () => renderer.root.findByType('DndKitHabitList');
    await act(async () => {
      await list().props.onReorder([habits[1], habits[0], habits[2]]);
    });
    const firstOrder = list().props.habits;
    (HabitService.updateHabit as jest.Mock).mockClear();
    await act(async () => {
      await list().props.onReorder([firstOrder[1], firstOrder[0], firstOrder[2]]);
    });
    expect(HabitService.updateHabit).toHaveBeenCalledWith(
      1,
      { display_settings: { order: 0 } },
      'test-token'
    );
    expect(HabitService.updateHabit).toHaveBeenCalledWith(
      2,
      { display_settings: { order: 1 } },
      'test-token'
    );
    expect(list().props.habits.map((habit: any) => habit.id)).toEqual([1, 2, 3]);
    await act(async () => renderer.unmount());
  });

  it('reloads the saved order and shows an error when an API response fails', async () => {
    (HabitService.updateHabit as jest.Mock<any>).mockResolvedValue({ error: 'Offline', status: 0 });
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<HabitList />);
    });
    await act(async () => {
      await renderer.root
        .findByType('DndKitHabitList')
        .props.onReorder([habits[1], habits[0], habits[2]]);
    });
    expect(HabitService.getHabits).toHaveBeenCalledTimes(2);
    expect(
      renderer.root.findByType('DndKitHabitList').props.habits.map((habit: any) => habit.id)
    ).toEqual([1, 2, 3]);
    expect(renderer.root.findByProps({ accessibilityLabel: 'Retry loading habits' })).toBeTruthy();
    await act(async () => renderer.unmount());
  });
});
