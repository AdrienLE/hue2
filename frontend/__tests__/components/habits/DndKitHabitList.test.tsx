import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
// @ts-expect-error -- the installed renderer has no TypeScript declarations.
import TestRenderer, { act } from 'react-test-renderer';
import { DndKitHabitList } from '@/components/habits/DndKitHabitList';

jest.mock('react-native', () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  RefreshControl: 'RefreshControl',
  Platform: { OS: 'web' },
  StyleSheet: { create: (styles: object) => styles },
}));
jest.mock('@dnd-kit/core', () => ({
  ...jest.requireActual<typeof import('@dnd-kit/core')>('@dnd-kit/core'),
  DndContext: 'DndContext',
  useSensor: jest.fn(),
  useSensors: jest.fn(),
}));
jest.mock('@dnd-kit/sortable', () => ({
  ...jest.requireActual<typeof import('@dnd-kit/sortable')>('@dnd-kit/sortable'),
  SortableContext: 'SortableContext',
  useSortable: () => ({ setNodeRef: jest.fn(), attributes: {}, listeners: {} }),
}));
jest.mock('@/components/habits/HabitItem', () => ({ HabitItem: 'HabitItem' }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: 'IconSymbol' }));
jest.mock('@/hooks/useThemeColor', () => ({ useThemeColor: () => '#111111' }));

describe('DndKitHabitList drop targets', () => {
  it('ignores drops outside the list or onto missing items, and accepts a valid move', async () => {
    const onReorder = jest.fn<(habits: { id: number }[]) => void>();
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(
        <DndKitHabitList
          {...({
            habits: [1, 2, 3].map(id => ({ id })),
            onReorder,
            checkedHabitsToday: new Set(),
            getColorIndex: () => 0,
            colorTotal: 3,
          } as any)}
        />
      );
    });
    const drop = renderer.root.findByType('DndContext').props.onDragEnd;
    drop({ active: { id: 1 }, over: null });
    drop({ active: { id: 1 }, over: { id: 99 } });
    drop({ active: { id: 99 }, over: { id: 1 } });
    expect(onReorder).not.toHaveBeenCalled();
    drop({ active: { id: 1 }, over: { id: 3 } });
    expect(onReorder.mock.calls[0][0].map((habit: any) => habit.id)).toEqual([2, 3, 1]);
    await act(async () => renderer.unmount());
  });
});
