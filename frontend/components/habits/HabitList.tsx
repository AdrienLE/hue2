import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, ActivityIndicator, RefreshControl, Platform, View } from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { getCheckedHabitIdsToday } from '@/lib/habits/checkFilters';
import type { Habit } from '@/lib/types/habits';
import { HabitItem } from './HabitItem';
import { QuickAddHabit } from './QuickAddHabit';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { HabitFilterBar } from './HabitFilterBar';
import {
  filterHabitsForMode,
  getEmptyHabitMessage,
  getHabitDayState,
} from '@/lib/habits/visibility';

export function HabitList() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkedHabitsToday, setCheckedHabitsToday] = useState<Set<number>>(new Set());
  const [editingHabitId, setEditingHabitId] = useState<number | null>(null);
  const { token } = useAuth();
  const { userSettings } = useUser();
  const { mode, setMode } = useHabitVisibility();
  const { customDateOverride } = useDevDate();
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({ light: '#69727d', dark: '#929aa5' }, 'text');
  const surfaceColor = useThemeColor({ light: '#ffffff', dark: '#171a1f' }, 'background');
  const insets = useSafeAreaInsets();

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
        setCheckedHabitsToday(getCheckedHabitIdsToday(response.data, rolloverHour, currentDate));
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

  const dayState = useMemo(
    () => getHabitDayState(habits, checkedHabitsToday, currentDayOfWeek),
    [habits, checkedHabitsToday, currentDayOfWeek]
  );
  const visibleHabits = useMemo(
    () => filterHabitsForMode(habits, mode, dayState),
    [habits, mode, dayState]
  );
  const scheduledCount = dayState.scheduledIds.size;
  const completedScheduledCount = [...dayState.scheduledIds].filter(id =>
    checkedHabitsToday.has(id)
  ).length;
  const completionRatio = scheduledCount ? completedScheduledCount / scheduledCount : 1;

  const colorIndexLookup = useMemo(() => {
    const lookup = new Map<number, number>();
    habits.forEach((habit, index) => {
      lookup.set(habit.id, index);
    });
    return lookup;
  }, [habits]);

  const getColorIndex = useCallback(
    (habitId: number) => colorIndexLookup.get(habitId) ?? 0,
    [colorIndexLookup]
  );

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
  const totalHabitsForPalette = Math.max(habits.length, 1);
  const palettePreference = userSettings.color_frequency ?? totalHabitsForPalette;
  const paletteSize = Math.max(1, Math.min(palettePreference, totalHabitsForPalette));

  return (
    <ThemedView style={styles.fullContainer}>
      <View style={styles.ledgerHeader}>
        <View style={styles.dayRow}>
          <View>
            <ThemedText style={styles.dayTitle}>
              {currentDate.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </ThemedText>
            <ThemedText style={[styles.dayMeta, { color: mutedColor }]}>
              {completedScheduledCount} of {scheduledCount} scheduled complete
            </ThemedText>
          </View>
          <ThemedText style={styles.percent}>{Math.round(completionRatio * 100)}%</ThemedText>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: surfaceColor }]}>
          <View style={[styles.progressFill, { width: `${completionRatio * 100}%` }]} />
        </View>
        <HabitFilterBar mode={mode} onChange={setMode} />
      </View>

      {visibleHabits.length === 0 && (
        <View pointerEvents="none" style={styles.emptyOverlay}>
          <ThemedText style={styles.emptyText}>
            {getEmptyHabitMessage(mode, habits.length > 0)}
          </ThemedText>
          <ThemedText style={[styles.emptySubtext, { color: mutedColor }]}>
            Use All to review or reorder your ledger
          </ThemedText>
        </View>
      )}

      {Platform.OS === 'web' ? (
        <DndKitHabitList
          habits={visibleHabits}
          onReorder={handleHabitReorder}
          onHabitUpdate={handleHabitUpdate}
          onHabitDelete={handleHabitDelete}
          onHabitChecked={handleHabitChecked}
          onHabitUnchecked={handleHabitUnchecked}
          checkedHabitsToday={checkedHabitsToday}
          inactiveHabitIds={dayState.unscheduledIds}
          editingHabitId={editingHabitId}
          onStartEditing={handleStartEditing}
          onCancelEditing={handleCancelEditing}
          refreshing={refreshing}
          onRefresh={() => loadHabits(true)}
          colorTotal={paletteSize}
          getColorIndex={getColorIndex}
          reorderEnabled={mode === 'all'}
          contentBottom={insets.bottom + 24}
        />
      ) : (
        <DraggableFlatList
          data={visibleHabits}
          containerStyle={styles.nativeListContainer}
          onDragEnd={({ data }) => handleHabitReorder(data)}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item, drag, isActive }) => (
            <ScaleDecorator activeScale={1.05}>
              <HabitItem
                key={item.id}
                habit={item}
                onUpdate={handleHabitUpdate}
                onDelete={handleHabitDelete}
                onChecked={handleHabitChecked}
                onUnchecked={handleHabitUnchecked}
                isCheckedToday={checkedHabitsToday.has(item.id)}
                isInactive={dayState.unscheduledIds.has(item.id)}
                isDraggable={mode === 'all'}
                onDrag={mode === 'all' ? drag : undefined}
                isActive={isActive}
                isEditing={editingHabitId === item.id}
                onStartEditing={() => handleStartEditing(item.id)}
                onCancelEditing={handleCancelEditing}
                colorIndex={getColorIndex(item.id)}
                colorTotal={paletteSize}
              />
            </ScaleDecorator>
          )}
          style={styles.container}
          contentContainerStyle={[styles.containerContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadHabits(true)}
              tintColor={textColor}
            />
          }
        />
      )}
      <QuickAddHabit onHabitAdded={() => loadHabits(true)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    position: 'relative',
  },
  ledgerHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 12 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  dayTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  dayMeta: { fontSize: 12, marginTop: 3 },
  percent: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: '#65c7c1' },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  nativeListContainer: { flex: 1 },
  containerContent: {
    paddingTop: 8,
  },
  emptyOverlay: {
    position: 'absolute',
    top: 230,
    left: 24,
    right: 24,
    zIndex: 1,
    alignItems: 'center',
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
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.7,
  },
});
