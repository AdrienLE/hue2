import React from 'react';
import { HabitCard } from './HabitCard';
import type { Habit } from '@/lib/types/habits';

interface HabitItemProps {
  habit: Habit;
  onUpdate: (habit: Habit) => void;
  onDelete: (habitId: number) => void;
  onChecked?: (habitId: number) => void;
  onUnchecked?: (habitId: number) => void;
  isCheckedToday?: boolean;
  isDraggable?: boolean;
  onDrag?: () => void;
  isActive?: boolean;
  isEditing?: boolean;
  onStartEditing?: () => void;
  onCancelEditing?: () => void;
}

export function HabitItem({ habit, onUpdate, onDelete, onChecked, onUnchecked, isCheckedToday, isDraggable, onDrag, isActive, isEditing, onStartEditing, onCancelEditing }: HabitItemProps) {
  return (
    <HabitCard
      habit={habit}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onEdit={onStartEditing}
      onCancelEdit={onCancelEditing}
      isEditing={isEditing || false}
      onChecked={onChecked}
      onUnchecked={onUnchecked}
      isCheckedToday={isCheckedToday}
      isDraggable={isDraggable}
      onDrag={onDrag}
      isActive={isActive}
    />
  );
}