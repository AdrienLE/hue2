import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
// @ts-expect-error -- the installed renderer has no TypeScript declarations.
import TestRenderer, { act } from 'react-test-renderer';
import { QuickAddHabit } from '@/components/habits/QuickAddHabit';
import { HabitService } from '@/lib/services/habitService';

jest.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'web' },
  StyleSheet: { create: (styles: object) => styles },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/ThemedText', () => ({ ThemedText: 'ThemedText' }));
jest.mock('@/components/ThemedTextInput', () => ({ ThemedTextInput: 'ThemedTextInput' }));
jest.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ token: 'test-token' }) }));
jest.mock('@/hooks/useThemeColor', () => ({ useThemeColor: () => '#111111' }));
jest.mock('@/lib/services/habitService', () => ({ HabitService: { createHabit: jest.fn() } }));

describe('QuickAddHabit', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('adds a trimmed habit with the button and ignores duplicate submissions while saving', async () => {
    let resolveRequest: (value: any) => void = () => {};
    (HabitService.createHabit as jest.Mock).mockImplementation(
      () =>
        new Promise(resolve => {
          resolveRequest = resolve;
        })
    );
    const onHabitAdded = jest.fn();
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<QuickAddHabit onHabitAdded={onHabitAdded} />);
    });
    const input = () => renderer.root.findByProps({ accessibilityLabel: 'New habit name' });
    expect(renderer.root.findByProps({ accessibilityLabel: 'Add habit' }).props.disabled).toBe(
      true
    );
    await act(async () => {
      input().props.onChangeText('  Read  ');
    });
    await act(async () => {
      void renderer.root.findByProps({ accessibilityLabel: 'Add habit' }).props.onPress();
      void input().props.onSubmitEditing();
    });
    expect(HabitService.createHabit).toHaveBeenCalledTimes(1);
    expect(HabitService.createHabit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Read' }),
      'test-token'
    );
    await act(async () => {
      resolveRequest({ data: { id: 1 } });
    });
    expect(input().props.value).toBe('');
    expect(onHabitAdded).toHaveBeenCalledTimes(1);
    await act(async () => renderer.unmount());
  });

  it('keeps the name and shows a retryable error when saving fails', async () => {
    (HabitService.createHabit as jest.Mock<any>).mockResolvedValue({ error: 'Offline', status: 0 });
    const onHabitAdded = jest.fn();
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(<QuickAddHabit onHabitAdded={onHabitAdded} />);
    });
    await act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: 'New habit name' })
        .props.onChangeText('Read');
    });
    await act(async () => {
      await renderer.root.findByProps({ accessibilityLabel: 'Add habit' }).props.onPress();
    });
    expect(renderer.root.findByProps({ accessibilityLabel: 'New habit name' }).props.value).toBe(
      'Read'
    );
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
      'Could not add'
    );
    expect(onHabitAdded).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ accessibilityLabel: 'Add habit' }).props.disabled).toBe(
      false
    );
    await act(async () => renderer.unmount());
  });
});
