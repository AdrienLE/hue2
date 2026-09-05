import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
// The installed renderer package does not include TypeScript declarations.
// @ts-expect-error -- runtime dependency is present and used only by this test.
import TestRenderer, { act } from 'react-test-renderer';

import { HabitCard } from '@/components/habits/HabitCard';
import { HabitService } from '@/lib/services/habitService';
import type { Habit } from '@/lib/types/habits';

const mockAddReward = jest.fn();
const mockSubtractReward = jest.fn();

jest.mock('react-native', () => ({
  View: 'View',
  TouchableOpacity: 'TouchableOpacity',
  Pressable: 'Pressable',
  Modal: 'Modal',
  TextInput: 'TextInput',
  Platform: { OS: 'web' },
  StyleSheet: { create: (styles: object) => styles },
}));

jest.mock('react-native-draggable-flatlist', () => ({
  __esModule: true,
  default: 'DraggableFlatList',
  ScaleDecorator: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/ThemedView', () => ({ ThemedView: 'ThemedView' }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: 'ThemedText' }));
jest.mock('@/components/ThemedTextInput', () => ({ ThemedTextInput: 'ThemedTextInput' }));
jest.mock('@/components/habits/HabitActionSheet', () => ({ HabitActionSheet: 'HabitActionSheet' }));
jest.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ token: 'test-token' }) }));
jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    addReward: mockAddReward,
    subtractReward: mockSubtractReward,
    userSettings: {
      day_rollover_hour: 3,
      reward_unit: '$',
      reward_unit_position: 'before',
      color_brightness: 65,
      color_saturation: 15,
    },
  }),
}));
jest.mock('@/hooks/useThemeColor', () => ({ useThemeColor: () => '#111111' }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/constants/Colors', () => ({ getHabitColorByIndex: () => '#0099aa' }));
jest.mock('@/contexts/DevDateContext', () => ({
  getCurrentDate: () => new Date('2026-08-24T12:00:00'),
}));
jest.mock('@/lib/services/habitService', () => ({
  HabitService: {
    getSubHabits: jest.fn(),
    getWeightUpdates: jest.fn(),
    createWeightUpdate: jest.fn(),
    getCounts: jest.fn(),
    createCount: jest.fn(),
    getChecks: jest.fn(),
    createCheck: jest.fn(),
    deleteCheck: jest.fn(),
    uncheckHabitToday: jest.fn(),
  },
}));

const weightHabit: Habit = {
  id: 6,
  user_id: 'test-user',
  name: 'Weight trend',
  has_counts: false,
  is_weight: true,
  weight_settings: {
    target_weight: 180,
    starting_weight: 184.4,
    unit: 'lb',
    step_size: 0.5,
  },
  schedule_settings: { weekdays: [0, 1, 2, 3, 4, 5, 6] },
  reward_settings: {},
  display_settings: { order: 0 },
  created_at: '2026-08-24T12:00:00',
};

describe('HabitCard controls', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (HabitService.getSubHabits as jest.Mock<any>).mockImplementation(async () => ({ data: [] }));
    (HabitService.getWeightUpdates as jest.Mock<any>).mockImplementation(async () => ({
      data: [{ id: 1, habit_id: 6, weight: 184.4, update_date: '2026-08-24T12:00:00' }],
    }));
    (HabitService.createWeightUpdate as jest.Mock<any>).mockImplementation(async () => ({
      data: { id: 2, habit_id: 6, weight: 184.5, update_date: '2026-08-24T12:01:00' },
    }));
    (HabitService.getCounts as jest.Mock<any>).mockResolvedValue({ data: [{ value: 15 }] });
    (HabitService.createCount as jest.Mock<any>).mockResolvedValue({ data: { id: 1 } });
    (HabitService.getChecks as jest.Mock<any>).mockResolvedValue({ data: [] });
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('updates the weight without checking off the habit', async () => {
    const onChecked = jest.fn();
    let renderer: any;

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(HabitCard, {
          habit: weightHabit,
          onUpdate: jest.fn(),
          onDelete: jest.fn(),
          onChecked,
          isCheckedToday: false,
        })
      );
    });

    const increaseButton = renderer!.root.findByProps({
      accessibilityLabel: 'Increase Weight trend weight',
    });

    await act(async () => {
      await increaseButton.props.onPress();
    });

    expect(HabitService.createWeightUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ habit_id: 6, weight: 184.5 }),
      'test-token'
    );
    expect(onChecked).not.toHaveBeenCalled();
    await act(async () => renderer.unmount());
  });

  it.each([
    ['Increase', 5],
    ['Decrease', -5],
  ])('%s persists the count without completing the habit', async (direction, change) => {
    const onChecked = jest.fn();
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(HabitCard, {
          habit: {
            ...weightHabit,
            name: 'Pushups',
            is_weight: false,
            has_counts: true,
            count_settings: { target: 40, step_size: 5, unit: 'reps', count_is_good: true },
          },
          onUpdate: jest.fn(),
          onDelete: jest.fn(),
          onChecked,
          isCheckedToday: false,
        })
      );
    });
    await act(async () => {
      await renderer.root
        .findByProps({ accessibilityLabel: `${direction} Pushups count` })
        .props.onPress();
    });
    expect(HabitService.createCount).toHaveBeenCalledWith(
      expect.objectContaining({ value: change }),
      'test-token'
    );
    expect(onChecked).not.toHaveBeenCalled();
    await act(async () => renderer.unmount());
  });

  it('does not change completion or rewards when unchecking fails', async () => {
    (HabitService.uncheckHabitToday as jest.Mock<any>).mockRejectedValue(new Error('Offline'));
    const onUnchecked = jest.fn();
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(HabitCard, {
          habit: { ...weightHabit, reward_settings: { success_points: 3 } },
          onUpdate: jest.fn(),
          onDelete: jest.fn(),
          onUnchecked,
          isCheckedToday: true,
        })
      );
    });
    await act(async () => {
      await renderer.root.findByProps({ accessibilityRole: 'checkbox' }).props.onPress();
    });
    expect(onUnchecked).not.toHaveBeenCalled();
    expect(mockSubtractReward).not.toHaveBeenCalled();
    expect(mockAddReward).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
      'Could not save'
    );
    await act(async () => renderer.unmount());
  });

  it.each([false, true])(
    'rolls back a failed sub-habit toggle (was checked: %s)',
    async wasChecked => {
      (HabitService.getSubHabits as jest.Mock<any>).mockResolvedValue({
        data: [{ id: 10, name: 'Water' }],
      });
      (HabitService.getChecks as jest.Mock<any>).mockResolvedValue({
        data: wasChecked
          ? [
              {
                id: 20,
                sub_habit_id: 10,
                checked: true,
                check_date: '2026-08-24T12:00:00',
              },
            ]
          : [],
      });
      (HabitService.createCheck as jest.Mock<any>).mockResolvedValue({
        error: 'Offline',
        status: 0,
      });
      (HabitService.deleteCheck as jest.Mock<any>).mockResolvedValue({
        error: 'Offline',
        status: 0,
      });
      let renderer: any;
      await act(async () => {
        renderer = TestRenderer.create(
          React.createElement(HabitCard, {
            habit: { ...weightHabit, is_weight: false, reward_settings: { sub_habit_points: 2 } },
            onUpdate: jest.fn(),
            onDelete: jest.fn(),
            isCheckedToday: false,
          })
        );
      });
      const label = `Water, ${wasChecked ? 'completed' : 'not completed'}`;
      await act(async () => {
        await renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
      });
      expect(
        renderer.root.findByProps({ accessibilityLabel: label }).props.accessibilityState.checked
      ).toBe(wasChecked);
      expect(mockAddReward).not.toHaveBeenCalled();
      expect(mockSubtractReward).not.toHaveBeenCalled();
      expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
        'Could not save'
      );
      await act(async () => renderer.unmount());
    }
  );
});
