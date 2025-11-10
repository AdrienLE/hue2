import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  View,
} from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemedView } from '../ThemedView';
import { ThemedText } from '../ThemedText';
import { DndKitHabitList } from './DndKitHabitList';
import { HabitService } from '@/lib/services/habitService';
import { useAuth } from '@/auth/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useHabitVisibility } from '@/contexts/HabitVisibilityContext';
import {
  getLogicalDate,
  getLogicalDateRange,
  getCurrentDate,
  useDevDate,
} from '@/contexts/DevDateContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { isTimestampOnLogicalDay } from '@/lib/logicalTime';
import type { Habit } from '@/lib/types/habits';
import { HabitItem } from './HabitItem';
import { QuickAddHabit } from './QuickAddHabit';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';

export function HabitList() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkedHabitsToday, setCheckedHabitsToday] = useState<Set<number>>(new Set());
  const [editingHabitId, setEditingHabitId] = useState<number | null>(null);
  const { token } = useAuth();
  const { userSettings } = useUser();
  const { showCheckedHabits } = useHabitVisibility();
  const { customDateOverride } = useDevDate();
  const textColor = useThemeColor({}, 'text');

  console.log('🔍 HabitList render - token:', token ? 'EXISTS' : 'MISSING', 'loading:', loading);

  const loadHabits = async (isRefresh = false) => {
    console.log('🚀 loadHabits called - token:', token ? 'EXISTS' : 'MISSING');
    if (!token) {
      console.log('❌ No token, exiting loadHabits');
      setLoading(false); // Important: stop loading state when no token
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await HabitService.getHabits(token);
      if (response.data) {
        // Sort habits by display order, then by creation date
        const sortedHabits = response.data.sort((a, b) => {
          const orderA = a.display_settings?.order ?? 999;
          const orderB = b.display_settings?.order ?? 999;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        setHabits(sortedHabits);
        // Load today's checks to determine which habits are completed
        await loadTodaysChecks();
      } else {
        console.error('Failed to load habits:', response.error);
      }
    } catch (error) {
      console.error('Error loading habits:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadTodaysChecks = async () => {
    if (!token) return;

    try {
      const rolloverHour = userSettings.day_rollover_hour ?? 3;
      const currentDate = getCurrentDate(); // This will use custom date if set
      const { startDate, endDate } = getLogicalDateRange(rolloverHour, currentDate);
      const response = await HabitService.getChecks(token, { startDate, endDate });
      if (response.data) {
        const todaysChecks = response.data.filter(
          check =>
            !check.sub_habit_id &&
            isTimestampOnLogicalDay(check.check_date, rolloverHour, currentDate)
        );
        const checkedHabitIds = new Set(
          todaysChecks
            .map(check => check.habit_id)
            .filter((habitId): habitId is number => typeof habitId === 'number')
        );
        setCheckedHabitsToday(checkedHabitIds);
      }
    } catch (error) {
      console.error("Error loading today's checks:", error);
    }
  };

  const handleHabitUpdate = (updatedHabit: Habit) => {
    setHabits(prev => prev.map(habit => (habit.id === updatedHabit.id ? updatedHabit : habit)));
  };

  const handleHabitDelete = (habitId: number) => {
    setHabits(prev => prev.filter(habit => habit.id !== habitId));
  };

  const handleHabitChecked = (habitId: number) => {
    setCheckedHabitsToday(prev => new Set([...prev, habitId]));
  };

  const handleHabitUnchecked = (habitId: number) => {
    setCheckedHabitsToday(prev => {
      const newSet = new Set(prev);
      newSet.delete(habitId);
      return newSet;
    });
  };

  const handleStartEditing = (habitId: number) => {
    setEditingHabitId(habitId);
  };

  const handleCancelEditing = () => {
    setEditingHabitId(null);
  };

  const handleHabitReorder = async (data: Habit[]) => {
    setHabits(data);

    // Update the order in the backend
    try {
      const updatePromises = data.map(async (habit, index) => {
        const currentOrder = habit.display_settings?.order ?? 999;
        if (currentOrder !== index) {
          const updatedDisplaySettings = {
            ...(habit.display_settings || {}),
            order: index,
          };

          return await HabitService.updateHabit(
            habit.id,
            { display_settings: updatedDisplaySettings },
            token!
          );
        }
        return null;
      });

      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error updating habit order:', error);
      // Revert to original order if backend update fails
      await loadHabits();
    }
  };

  // Get current logical day of week (0 = Sunday, 6 = Saturday) using rollover
  const rolloverHour = userSettings.day_rollover_hour ?? 3;
  const currentDate = getCurrentDate();
  const todayLogical = getLogicalDate(rolloverHour, currentDate);
  const [y, m, d] = todayLogical.split('-').map(Number);
  const currentDayOfWeek = new Date(y, m - 1, d).getDay();

  // Determine scheduled status per habit and compute visible list
  const unscheduledHabitIds = new Set<number>();
  const visibleHabits = habits.filter(habit => {
    const weekdays = habit.schedule_settings?.weekdays || [0, 1, 2, 3, 4, 5, 6];
    const isScheduledToday = weekdays.includes(currentDayOfWeek);
    if (!isScheduledToday) unscheduledHabitIds.add(habit.id);

    // When not in unhide mode, apply filters (scheduled today and not checked)
    if (!showCheckedHabits) {
      if (!isScheduledToday) return false;
      if (checkedHabitsToday.has(habit.id)) return false;
    }

    // In unhide mode, show all habits regardless of schedule/completion
    return true;
  });

  useEffect(() => {
    console.log('🔄 useEffect triggered - token:', token ? 'EXISTS' : 'MISSING');
    loadHabits();
  }, [token]);

  // Reload habits and checks when custom date changes
  useEffect(() => {
    if (customDateOverride && token) {
      console.log('📅 Custom date changed, reloading habits and checks');
      loadTodaysChecks();
    }
  }, [customDateOverride]);

  // Refetch on app/window focus and poll periodically to keep devices in sync
  useRefetchOnFocus(
    () => {
      if (token) return loadHabits(true);
    },
    { enabled: !!token, intervalMs: 30000, focusThrottleMs: 1000 }
  );

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={textColor} />
        <ThemedText style={styles.loadingText}>Loading habits...</ThemedText>
      </ThemedView>
    );
  }

  // Determine palette size (hue frequency): span this many distinct hues, then repeat
  const paletteSize = Math.max(
    1,
    Math.min(userSettings.color_frequency ?? visibleHabits.length, visibleHabits.length)
  );

  return (
    <ThemedView style={styles.fullContainer}>
      <QuickAddHabit onHabitAdded={() => loadHabits(true)} />

      {habits.length === 0 ? (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.emptyText}>No habits yet!</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Create your first habit to get started
          </ThemedText>
        </ThemedView>
      ) : visibleHabits.length === 0 ? (
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.emptyText}>All habits completed! 🎉</ThemedText>
          <ThemedText style={styles.emptySubtext}>Great job staying on track today</ThemedText>
        </ThemedView>
      ) : showCheckedHabits ? (
        // Show all habits with drag and drop support
        Platform.OS === 'web' ? (
          <DndKitHabitList
            habits={visibleHabits}
            onReorder={handleHabitReorder}
            onHabitUpdate={handleHabitUpdate}
            onHabitDelete={handleHabitDelete}
            onHabitChecked={handleHabitChecked}
            onHabitUnchecked={handleHabitUnchecked}
            checkedHabitsToday={checkedHabitsToday}
            inactiveHabitIds={showCheckedHabits ? unscheduledHabitIds : undefined}
            editingHabitId={editingHabitId}
            onStartEditing={handleStartEditing}
            onCancelEditing={handleCancelEditing}
            refreshing={refreshing}
            onRefresh={() => loadHabits(true)}
            colorTotal={paletteSize}
          />
        ) : (
          <GestureHandlerRootView style={{ flex: 1 }}>
            <DraggableFlatList
              data={visibleHabits}
              onDragEnd={({ data }) => handleHabitReorder(data)}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item, drag, isActive, index }) => (
                <ScaleDecorator activeScale={1.05}>
                  <HabitItem
                    key={item.id}
                    habit={item}
                    onUpdate={handleHabitUpdate}
                    onDelete={handleHabitDelete}
                    onChecked={handleHabitChecked}
                    onUnchecked={handleHabitUnchecked}
                    isCheckedToday={checkedHabitsToday.has(item.id)}
                    isInactive={showCheckedHabits ? unscheduledHabitIds.has(item.id) : false}
                    isDraggable={true}
                    onDrag={drag}
                    isActive={isActive}
                    isEditing={editingHabitId === item.id}
                    onStartEditing={() => handleStartEditing(item.id)}
                    onCancelEditing={handleCancelEditing}
                    colorIndex={index}
                    colorTotal={paletteSize}
                  />
                </ScaleDecorator>
              )}
              style={styles.container}
              contentContainerStyle={styles.containerContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => loadHabits(true)}
                  tintColor={textColor}
                />
              }
            />
          </GestureHandlerRootView>
        )
      ) : (
        // Regular scroll view when some habits are hidden
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadHabits(true)}
              tintColor={textColor}
            />
          }
        >
          {visibleHabits.map((habit, index) => (
            <HabitItem
              key={habit.id}
              habit={habit}
              onUpdate={handleHabitUpdate}
              onDelete={handleHabitDelete}
              onChecked={handleHabitChecked}
              onUnchecked={handleHabitUnchecked}
              isCheckedToday={checkedHabitsToday.has(habit.id)}
              isInactive={showCheckedHabits ? unscheduledHabitIds.has(habit.id) : false}
              isEditing={editingHabitId === habit.id}
              onStartEditing={() => handleStartEditing(habit.id)}
              onCancelEditing={handleCancelEditing}
              colorIndex={index}
              colorTotal={paletteSize}
            />
          ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  containerContent: {
    paddingVertical: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
