import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { View, StyleSheet, ScrollView, RefreshControl, Platform } from 'react-native';
import { HabitItem } from './HabitItem';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useThemeColor } from '@/hooks/useThemeColor';
import type { Habit } from '@/lib/types/habits';

interface SortableHabitItemProps {
  habit: Habit;
  onUpdate: (habit: Habit) => void;
  onDelete: (habitId: number) => void;
  onChecked: (habitId: number) => void;
  onUnchecked: (habitId: number) => void;
  isCheckedToday: boolean;
  editingHabitId: number | null;
  onStartEditing: (habitId: number) => void;
  onCancelEditing: () => void;
}

function SortableHabitItem({
  habit,
  onUpdate,
  onDelete,
  onChecked,
  onUnchecked,
  isCheckedToday,
  editingHabitId,
  onStartEditing,
  onCancelEditing,
}: SortableHabitItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: habit.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const borderColor = useThemeColor({ light: '#e1e5e9', dark: '#444' }, 'border');
  const textColor = useThemeColor({}, 'text');

  return (
    <View ref={setNodeRef} style={[styles.sortableItem, style]}>
      {Platform.OS === 'web' && (
        <View style={[styles.dragHandle, { borderColor }]} {...attributes} {...listeners}>
          <View style={styles.dragDots}>
            <View style={styles.dotRow}>
              <View style={[styles.dot, { backgroundColor: textColor }]} />
              <View style={[styles.dot, { backgroundColor: textColor }]} />
            </View>
            <View style={styles.dotRow}>
              <View style={[styles.dot, { backgroundColor: textColor }]} />
              <View style={[styles.dot, { backgroundColor: textColor }]} />
            </View>
            <View style={styles.dotRow}>
              <View style={[styles.dot, { backgroundColor: textColor }]} />
              <View style={[styles.dot, { backgroundColor: textColor }]} />
            </View>
          </View>
        </View>
      )}
      <View style={styles.habitItemContainer}>
        <HabitItem
          habit={habit}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onChecked={onChecked}
          onUnchecked={onUnchecked}
          isCheckedToday={isCheckedToday}
          isDraggable={false}
          isEditing={editingHabitId === habit.id}
          onStartEditing={() => onStartEditing(habit.id)}
          onCancelEditing={onCancelEditing}
        />
      </View>
    </View>
  );
}

interface DndKitHabitListProps {
  habits: Habit[];
  onReorder: (habits: Habit[]) => void;
  onHabitUpdate: (habit: Habit) => void;
  onHabitDelete: (habitId: number) => void;
  onHabitChecked: (habitId: number) => void;
  onHabitUnchecked: (habitId: number) => void;
  checkedHabitsToday: Set<number>;
  editingHabitId: number | null;
  onStartEditing: (habitId: number) => void;
  onCancelEditing: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

export function DndKitHabitList({
  habits,
  onReorder,
  onHabitUpdate,
  onHabitDelete,
  onHabitChecked,
  onHabitUnchecked,
  checkedHabitsToday,
  editingHabitId,
  onStartEditing,
  onCancelEditing,
  refreshing,
  onRefresh,
}: DndKitHabitListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const textColor = useThemeColor({}, 'text');

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = habits.findIndex(habit => habit.id === active.id);
      const newIndex = habits.findIndex(habit => habit.id === over?.id);

      const reorderedHabits = arrayMove(habits, oldIndex, newIndex);
      onReorder(reorderedHabits);
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.containerContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textColor} />
        }
      >
        <SortableContext items={habits.map(h => h.id)} strategy={verticalListSortingStrategy}>
          {habits.map(habit => (
            <SortableHabitItem
              key={habit.id}
              habit={habit}
              onUpdate={onHabitUpdate}
              onDelete={onHabitDelete}
              onChecked={onHabitChecked}
              onUnchecked={onHabitUnchecked}
              isCheckedToday={checkedHabitsToday.has(habit.id)}
              editingHabitId={editingHabitId}
              onStartEditing={onStartEditing}
              onCancelEditing={onCancelEditing}
            />
          ))}
        </SortableContext>
      </ScrollView>
    </DndContext>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  containerContent: {
    paddingVertical: 8,
  },
  sortableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dragHandle: {
    padding: 8,
    marginRight: 8,
    borderRadius: 4,
    borderWidth: 1,
    cursor: Platform.OS === 'web' ? 'grab' : 'default',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragDots: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 16,
    gap: 2,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 2,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.5,
  },
  habitItemContainer: {
    flex: 1,
  },
});
