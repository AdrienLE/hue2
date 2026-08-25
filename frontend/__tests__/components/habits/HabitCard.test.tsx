import React from 'react';
// The installed renderer package does not include TypeScript declarations.
// @ts-expect-error -- runtime dependency is present and used only by this test.
import TestRenderer, { act } from 'react-test-renderer';

import { HabitCard } from '@/components/habits/HabitCard';
import { HabitService } from '@/lib/services/habitService';
import type { Habit } from '@/lib/types/habits';

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
    addReward: jest.fn(),
    subtractReward: jest.fn(),
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

describe('HabitCard weight controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (HabitService.getSubHabits as jest.Mock<any>).mockImplementation(async () => ({ data: [] }));
    (HabitService.getWeightUpdates as jest.Mock<any>).mockImplementation(async () => ({
      data: [{ id: 1, habit_id: 6, weight: 184.4, update_date: '2026-08-24T12:00:00' }],
    }));
    (HabitService.createWeightUpdate as jest.Mock<any>).mockImplementation(async () => ({
      data: { id: 2, habit_id: 6, weight: 184.5, update_date: '2026-08-24T12:01:00' },
    }));
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
  });
});
