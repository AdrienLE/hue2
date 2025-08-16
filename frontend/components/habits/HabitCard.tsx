import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Pressable,
  Modal,
  TextInput,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { getLogicalDateTimestamp } from '@/contexts/DevDateContext';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { ThemedView } from '../ThemedView';
import { ThemedText } from '../ThemedText';
import { ThemedTextInput } from '../ThemedTextInput';
import { HabitService } from '@/lib/services/habitService';
import { useAuth } from '@/auth/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getHabitColor } from '@/constants/Colors';
import type { Habit, Count, WeightUpdate, SubHabit, SubHabitCreate } from '@/lib/types/habits';

interface HabitCardProps {
  habit: Habit;
  onUpdate: (habit: Habit) => void;
  onDelete: (habitId: number) => void;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  isEditing?: boolean;
  onChecked?: (habitId: number) => void;
  onUnchecked?: (habitId: number) => void;
  isCheckedToday?: boolean;
  isDraggable?: boolean;
  onDrag?: () => void;
  isActive?: boolean;
}

export function HabitCard({
  habit,
  onUpdate,
  onDelete,
  onEdit,
  onCancelEdit,
  isEditing,
  onChecked,
  onUnchecked,
  isCheckedToday,
  isDraggable,
  onDrag,
  isActive,
}: HabitCardProps) {
  // Common state
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Count habit state
  const [todayCount, setTodayCount] = useState(0);

  // Weight habit state
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [newWeight, setNewWeight] = useState('');

  // Sub-habit state (for normal habits only)
  const [subHabits, setSubHabits] = useState<SubHabit[]>([]);
  const [checkedSubHabits, setCheckedSubHabits] = useState<Set<number>>(new Set());
  const [newSubHabitName, setNewSubHabitName] = useState('');
  const [editingSubHabitId, setEditingSubHabitId] = useState<number | null>(null);
  const [editingSubHabitName, setEditingSubHabitName] = useState('');

  // Editing state
  const [editName, setEditName] = useState(habit.name);
  const [editDescription, setEditDescription] = useState(habit.description || '');
  const [editHabitType, setEditHabitType] = useState(
    habit.has_counts ? 'count' : habit.is_weight ? 'weight' : 'normal'
  );

  // Count settings with defaults
  const [editCountTarget, setEditCountTarget] = useState(
    habit.count_settings?.target?.toString() || '10'
  );
  const [editCountUnit, setEditCountUnit] = useState(habit.count_settings?.unit || 'units');
  const [editCountStepSize, setEditCountStepSize] = useState(
    habit.count_settings?.step_size?.toString() || '1'
  );
  const [editCountIsGood, setEditCountIsGood] = useState(
    habit.count_settings?.count_is_good ?? true
  );

  // Weight settings with defaults
  const [editWeightTarget, setEditWeightTarget] = useState(
    habit.weight_settings?.target_weight?.toString() || '150'
  );
  const [editWeightUnit, setEditWeightUnit] = useState(habit.weight_settings?.unit || 'lbs');

  // Reward settings with defaults
  const [editSuccessReward, setEditSuccessReward] = useState(
    habit.reward_settings?.success_points?.toString() || '1'
  );
  const [editFailureReward, setEditFailureReward] = useState(
    habit.reward_settings?.penalty_points?.toString() || '0'
  );
  const [editSubHabitPoints, setEditSubHabitPoints] = useState(
    habit.reward_settings?.sub_habit_points?.toString() || '5'
  );
  const [editCountReward, setEditCountReward] = useState(
    habit.reward_settings?.count_reward?.toString() || '0.1'
  );
  const [editCountCheckBonus, setEditCountCheckBonus] = useState(
    habit.reward_settings?.count_check_bonus?.toString() || '5'
  );
  const [editCountCheckPenalty, setEditCountCheckPenalty] = useState(
    habit.reward_settings?.count_check_penalty?.toString() || '5'
  );
  const [editWeightReward, setEditWeightReward] = useState(
    habit.reward_settings?.weight_per_unit?.toString() || '1'
  );
  const [editWeightCheckBonus, setEditWeightCheckBonus] = useState(
    habit.reward_settings?.weight_check_bonus?.toString() || '5'
  );
  const [editWeightCheckPenalty, setEditWeightCheckPenalty] = useState(
    habit.reward_settings?.weight_check_penalty?.toString() || '5'
  );

  // Schedule settings
  const [editWeekdays, setEditWeekdays] = useState<number[]>(
    habit.schedule_settings?.weekdays || [0, 1, 2, 3, 4, 5, 6]
  );

  // Display settings
  const [editHue, setEditHue] = useState(habit.display_settings?.hue?.toString() || '');

  // Effect to apply defaults when switching habit types
  useEffect(() => {
    if (editHabitType === 'count') {
      // Set count defaults if switching to count type and no values exist
      if (!editCountTarget || editCountTarget === '0') setEditCountTarget('10');
      if (!editCountUnit) setEditCountUnit('units');
      if (!editCountStepSize) setEditCountStepSize('1');
      if (!editCountReward || editCountReward === '0') setEditCountReward('0.1');
    } else if (editHabitType === 'weight') {
      // Set weight defaults if switching to weight type and no values exist
      if (!editWeightTarget || editWeightTarget === '0') setEditWeightTarget('150');
      if (!editWeightUnit) setEditWeightUnit('lbs');
      if (!editWeightReward || editWeightReward === '0') setEditWeightReward('1');
    }
  }, [editHabitType]);

  const { token } = useAuth();
  const { addReward, subtractReward, userSettings } = useUser();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({ light: '#e1e5e9', dark: '#333' }, 'border');
  const progressBgColor = useThemeColor({ light: '#e0e0e0', dark: '#444' }, 'background');
  const habitColor = getHabitColor(
    habit.id,
    habit.display_settings?.hue,
    userSettings.color_brightness,
    userSettings.color_saturation,
    isDarkMode
  );

  // Live preview color that updates with current edit values
  const liveHabitColor =
    isEditing && editHue
      ? getHabitColor(
          habit.id,
          parseFloat(editHue),
          userSettings.color_brightness,
          userSettings.color_saturation,
          isDarkMode
        )
      : habitColor;

  // Helper function to format reward labels
  const formatRewardLabel = (label: string) => {
    const unit = userSettings.reward_unit || '$';
    const position = userSettings.reward_unit_position || 'before';
    return position === 'before' ? `${label} ${unit}` : `${label} ${unit}`;
  };

  // Get current settings based on habit type
  const target = habit.count_settings?.target || 0;
  const unit = habit.count_settings?.unit || habit.weight_settings?.unit || '';
  const stepSize = habit.count_settings?.step_size || habit.weight_settings?.step_size || 1;
  const countIsGood = habit.count_settings?.count_is_good ?? true;
  const targetWeight = habit.weight_settings?.target_weight;

  // Load sub-habits (always load them, regardless of habit type, to preserve them)
  const loadSubHabits = async () => {
    if (!token) return;

    // Always load sub-habits to preserve them when switching types
    try {
      const response = await HabitService.getSubHabits(habit.id, token);
      if (response.data) {
        setSubHabits(response.data.sort((a, b) => a.order_index - b.order_index));
      }
    } catch (error) {
      console.error('Error loading sub-habits:', error);
    }
  };

  // Add new sub-habit
  const addSubHabit = async () => {
    if (!token || !newSubHabitName.trim()) return;

    try {
      const subHabitData: SubHabitCreate = {
        parent_habit_id: habit.id,
        name: newSubHabitName.trim(),
        order_index: subHabits.length,
      };

      const response = await HabitService.createSubHabit(subHabitData, token);
      if (response.data) {
        setSubHabits(prev => [...prev, response.data!]);
        setNewSubHabitName('');
      }
    } catch (error) {
      console.error('Error creating sub-habit:', error);
      Alert.alert('Error', 'Failed to create sub-habit');
    }
  };

  // Toggle sub-habit checked status
  const toggleSubHabit = async (subHabitId: number) => {
    const subHabitPoints = habit.reward_settings?.sub_habit_points || 0;
    const wasChecked = checkedSubHabits.has(subHabitId);

    setCheckedSubHabits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subHabitId)) {
        newSet.delete(subHabitId);
      } else {
        newSet.add(subHabitId);
      }
      return newSet;
    });

    // Apply rewards for sub-habit checking
    if (subHabitPoints > 0) {
      if (wasChecked) {
        // Unchecking - remove reward
        await subtractReward(subHabitPoints);
      } else {
        // Checking - add reward
        await addReward(subHabitPoints);
      }
    }
  };

  // Delete sub-habit
  const deleteSubHabit = async (subHabitId: number) => {
    console.log('deleteSubHabit called with ID:', subHabitId);
    if (!token) {
      console.log('No token available');
      return;
    }

    try {
      console.log('Calling HabitService.deleteSubHabit...');
      const response = await HabitService.deleteSubHabit(subHabitId, token);
      console.log('Delete response:', response);

      if (response.status === 200) {
        console.log('Delete successful, updating local state');
        // Remove from local state
        setSubHabits(prev => {
          const filtered = prev.filter(sh => sh.id !== subHabitId);
          console.log('Updated sub-habits:', filtered);
          return filtered;
        });
        // Remove from checked set if it was checked
        setCheckedSubHabits(prev => {
          const newSet = new Set(prev);
          newSet.delete(subHabitId);
          return newSet;
        });
      } else {
        console.error('Failed to delete sub-habit:', response.error);
        Alert.alert('Error', 'Failed to delete sub-habit');
      }
    } catch (error) {
      console.error('Error deleting sub-habit:', error);
      Alert.alert('Error', 'Failed to delete sub-habit');
    }
  };

  // Load data based on habit type
  useEffect(() => {
    // Always load sub-habits to preserve them
    loadSubHabits();

    // Load type-specific data
    if (habit.has_counts) {
      loadTodayCount();
      setLoading(true);
      setTimeout(() => setLoading(false), 500); // Set loading for count habits
    } else if (habit.is_weight) {
      loadCurrentWeight();
    } else {
      // Normal habit - loading already handled by loadSubHabits
      setLoading(true);
      setTimeout(() => setLoading(false), 500); // Set loading for normal habits
    }
  }, [habit.id, habit.has_counts, habit.is_weight, token]);

  const loadTodayCount = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).toISOString();
      const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1
      ).toISOString();

      const response = await HabitService.getCounts(token, {
        habitId: habit.id,
        startDate: startOfDay,
        endDate: endOfDay,
      });

      if (response.data && response.data.length > 0) {
        const total = response.data.reduce((sum, count) => sum + count.value, 0);
        setTodayCount(total);
      } else {
        setTodayCount(0);
      }
    } catch (error) {
      console.error('Error loading today count:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentWeight = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const response = await HabitService.getWeightUpdates(token, {
        habitId: habit.id,
        limit: 1,
      });

      if (response.data && response.data.length > 0) {
        setCurrentWeight(response.data[0].weight);
      } else {
        // Use starting weight if no weight updates exist yet
        setCurrentWeight(habit.weight_settings?.starting_weight || null);
      }
    } catch (error) {
      console.error('Error loading current weight:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle checking/unchecking
  const handleCheck = async () => {
    if (!token || checking) return;

    setChecking(true);
    try {
      const successReward = habit.reward_settings?.success_points || 0;

      if (isCheckedToday) {
        await HabitService.uncheckHabitToday(habit.id, token);
        if (successReward > 0) {
          await subtractReward(successReward);
        }
        Alert.alert('Success', 'Habit unchecked!');
        onUnchecked?.(habit.id);
      } else {
        const rolloverHour = userSettings.day_rollover_hour || 3;
        const checkData = {
          habit_id: habit.id,
          checked: true,
          check_date: getLogicalDateTimestamp(rolloverHour),
        };

        const response = await HabitService.createCheck(checkData, token);
        if (response.data) {
          if (successReward > 0) {
            await addReward(successReward);
          }
          Alert.alert('Success', 'Habit checked!');
          onChecked?.(habit.id);
        } else {
          console.error('Failed to check habit:', response.error);
          Alert.alert('Error', 'Failed to check habit');
        }
      }
    } catch (error) {
      console.error('Error checking/unchecking habit:', error);
      Alert.alert('Error', 'Failed to check/uncheck habit');
    } finally {
      setChecking(false);
    }
  };

  // Handle count updates
  const updateCount = async (increment: boolean) => {
    if (!token || updating) return;

    setUpdating(true);
    try {
      const change = increment ? stepSize : -stepSize;
      const newValue = Math.max(0, todayCount + change);

      const countData = {
        habit_id: habit.id,
        value: change,
        count_date: new Date().toISOString(),
      };

      const response = await HabitService.createCount(countData, token);
      if (response.data) {
        setTodayCount(newValue);

        // Calculate reward
        const countReward = habit.reward_settings?.count_reward || 0;
        if (countReward > 0) {
          const rewardAmount = countReward * Math.abs(stepSize);

          if (countIsGood) {
            if (increment) {
              await addReward(rewardAmount);
            }
          } else {
            if (!increment) {
              await addReward(rewardAmount);
            } else if (target > 0 && newValue > target) {
              await subtractReward(rewardAmount);
            }
          }
        }
      } else {
        console.error('Failed to update count:', response.error);
        Alert.alert('Error', 'Failed to update count');
      }
    } catch (error) {
      console.error('Error updating count:', error);
      Alert.alert('Error', 'Failed to update count');
    } finally {
      setUpdating(false);
    }
  };

  // Handle weight updates
  const handleWeightUpdate = async (newWeightValue?: number) => {
    if (!token) return;

    const weight = newWeightValue || parseFloat(newWeight);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Error', 'Please enter a valid weight');
      return;
    }

    setUpdating(true);
    try {
      const weightData = {
        habit_id: habit.id,
        weight,
        update_date: new Date().toISOString(),
      };

      const response = await HabitService.createWeightUpdate(weightData, token);
      if (response.data) {
        const oldWeight = currentWeight || 0;
        setCurrentWeight(weight);

        // Calculate reward based on weight movement
        if (targetWeight && oldWeight > 0) {
          const weightReward = habit.reward_settings?.weight_reward || 0;
          if (weightReward > 0) {
            const oldDistance = Math.abs(oldWeight - targetWeight);
            const newDistance = Math.abs(weight - targetWeight);

            if (newDistance < oldDistance) {
              const improvement = oldDistance - newDistance;
              await addReward(weightReward * improvement);
            } else if (newDistance > oldDistance) {
              const decline = newDistance - oldDistance;
              await subtractReward(weightReward * decline);
            }
          }
        }

        if (!newWeightValue) {
          setNewWeight('');
          setShowWeightInput(false);
        }
        Alert.alert('Success', 'Weight updated successfully!');
      } else {
        console.error('Failed to update weight:', response.error);
        Alert.alert('Error', 'Failed to update weight');
      }
    } catch (error) {
      console.error('Error updating weight:', error);
      Alert.alert('Error', 'Failed to update weight');
    } finally {
      setUpdating(false);
    }
  };

  const updateWeight = async (increment: boolean) => {
    if (!token || updating) return;

    const baseWeight = currentWeight || 0;
    const change = increment ? 0.1 : -0.1;
    const newWeight = Math.max(0, Math.round((baseWeight + change) * 10) / 10);

    await handleWeightUpdate(newWeight);
  };

  // Handle save/cancel
  const handleSave = async () => {
    if (!token) return;

    // Validate weight habits require starting weight
    if (editHabitType === 'weight' && !currentWeight) {
      alert('Missing Starting Weight: Please enter a starting weight before saving.');
      return;
    }

    try {
      const updatedHabit = {
        name: editName,
        description: editDescription,
        has_counts: editHabitType === 'count',
        is_weight: editHabitType === 'weight',
        count_settings:
          editHabitType === 'count'
            ? {
                target: parseInt(editCountTarget) || 0,
                unit: editCountUnit,
                step_size: parseInt(editCountStepSize) || 1,
                count_is_good: editCountIsGood,
              }
            : null,
        weight_settings:
          editHabitType === 'weight'
            ? {
                target_weight: parseFloat(editWeightTarget) || 0,
                starting_weight: currentWeight || 0,
                unit: editWeightUnit,
                step_size: 0.1,
              }
            : null,
        reward_settings: {
          success_points: parseFloat(editSuccessReward) || 0,
          penalty_points: parseFloat(editFailureReward) || 0,
          sub_habit_points: parseFloat(editSubHabitPoints) || 5,
          ...(editHabitType === 'count' && {
            count_reward: parseFloat(editCountReward) || 0,
            count_check_bonus: parseFloat(editCountCheckBonus) || 0,
            count_check_penalty: parseFloat(editCountCheckPenalty) || 0,
          }),
          ...(editHabitType === 'weight' && {
            weight_per_unit: parseFloat(editWeightReward) || 0,
            weight_check_bonus: parseFloat(editWeightCheckBonus) || 0,
            weight_check_penalty: parseFloat(editWeightCheckPenalty) || 0,
          }),
        },
        schedule_settings: {
          ...habit.schedule_settings,
          weekdays: editWeekdays,
        },
        display_settings: {
          ...habit.display_settings,
          hue: editHue ? parseFloat(editHue) : undefined,
        },
      };

      const response = await HabitService.updateHabit(habit.id, updatedHabit, token);
      if (response.data) {
        onUpdate(response.data);
        onCancelEdit?.();
        Alert.alert('Success', 'Habit updated successfully!');
      } else {
        Alert.alert('Error', 'Failed to update habit');
      }
    } catch (error) {
      console.error('Error updating habit:', error);
      Alert.alert('Error', 'Failed to update habit');
    }
  };

  const handleCancel = () => {
    // Reset all form values with proper defaults
    setEditName(habit.name);
    setEditDescription(habit.description || '');
    setEditHabitType(habit.has_counts ? 'count' : habit.is_weight ? 'weight' : 'normal');
    setEditCountTarget(habit.count_settings?.target?.toString() || '10');
    setEditCountUnit(habit.count_settings?.unit || 'units');
    setEditCountStepSize(habit.count_settings?.step_size?.toString() || '1');
    setEditCountIsGood(habit.count_settings?.count_is_good ?? true);
    setEditWeightTarget(habit.weight_settings?.target_weight?.toString() || '70');
    setEditWeightUnit(habit.weight_settings?.unit || 'kg');
    setEditSuccessReward(habit.reward_settings?.success_points?.toString() || '1');
    setEditFailureReward(habit.reward_settings?.penalty_points?.toString() || '0');
    setEditSubHabitPoints(habit.reward_settings?.sub_habit_points?.toString() || '5');
    setEditCountReward(habit.reward_settings?.count_reward?.toString() || '0.1');
    setEditCountCheckBonus(habit.reward_settings?.count_check_bonus?.toString() || '5');
    setEditCountCheckPenalty(habit.reward_settings?.count_check_penalty?.toString() || '5');
    setEditWeightReward(habit.reward_settings?.weight_per_unit?.toString() || '1');
    setEditWeightCheckBonus(habit.reward_settings?.weight_check_bonus?.toString() || '5');
    setEditWeightCheckPenalty(habit.reward_settings?.weight_check_penalty?.toString() || '5');
    setEditWeekdays(habit.schedule_settings?.weekdays || [0, 1, 2, 3, 4, 5, 6]);
    setEditHue(habit.display_settings?.hue?.toString() || '');

    onCancelEdit?.();
  };

  const handleDelete = async () => {
    if (!token) return;

    try {
      const response = await HabitService.deleteHabit(habit.id, token);
      if (response.status === 200) {
        onDelete(habit.id);
      } else {
        console.error('Failed to delete habit:', response.error);
        Alert.alert('Error', 'Failed to delete habit');
      }
    } catch (error) {
      console.error('Error deleting habit:', error);
      Alert.alert('Error', 'Failed to delete habit');
    }
  };

  // Calculate progress for count habits
  const progressPercentage = target > 0 ? Math.min((todayCount / target) * 100, 100) : 0;

  // Get weight progress info
  const getWeightProgressInfo = () => {
    if (!currentWeight || !targetWeight) return null;

    const difference = currentWeight - targetWeight;
    const isOnTarget = Math.abs(difference) <= 0.5;

    let status = '';
    let color = textColor;

    if (isOnTarget) {
      status = 'On target! 🎯';
      color = tintColor;
    } else {
      status = `${Math.abs(difference).toFixed(1)} ${unit} ${difference > 0 ? 'above' : 'below'} target`;
    }

    return { status, color };
  };

  const weightProgressInfo = getWeightProgressInfo();

  // Get inferred goal type based on current vs target weight
  const getInferredGoalType = () => {
    if (!currentWeight || !targetWeight) return 'maintain';
    const difference = currentWeight - targetWeight;
    if (Math.abs(difference) <= 0.5) return 'maintain';
    return difference > 0 ? 'lose' : 'gain';
  };

  // Get dynamic colors for weight buttons
  const getWeightButtonColors = () => {
    const goalType = getInferredGoalType();
    if (goalType === 'lose') {
      return {
        decreaseColor: '#4CAF50', // Green for decreasing (good)
        increaseColor: '#ff4444', // Red for increasing (bad)
      };
    } else if (goalType === 'gain') {
      return {
        decreaseColor: '#ff4444', // Red for decreasing (bad)
        increaseColor: '#4CAF50', // Green for increasing (good)
      };
    } else {
      return {
        decreaseColor: '#ff4444', // Red for both when maintaining
        increaseColor: '#ff4444',
      };
    }
  };

  if (isEditing) {
    return (
      <>
        {/* Editing View */}
        <ThemedView
          style={[
            styles.container,
            { borderColor: liveHabitColor, borderLeftWidth: 4, borderLeftColor: liveHabitColor },
          ]}
        >
          <View style={styles.mainRow}>
            {/* Disabled check button during editing */}
            <TouchableOpacity
              style={[
                styles.checkButton,
                {
                  backgroundColor: 'transparent',
                  borderColor: liveHabitColor,
                  borderWidth: 2,
                  opacity: 0.5,
                },
              ]}
              disabled={true}
            >
              <ThemedText style={[styles.checkButtonText, { color: liveHabitColor }]}>✓</ThemedText>
            </TouchableOpacity>

            <View style={styles.leftSection}>
              {/* Editable name */}
              <TextInput
                style={[styles.habitNameInput, { color: textColor }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Habit name"
                placeholderTextColor={textColor + '80'}
              />

              {/* Editable description */}
              <TextInput
                style={[styles.descriptionInput, { color: textColor }]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Add description (optional)"
                placeholderTextColor={textColor + '60'}
              />

              {/* Progress bar for count habits with better preview */}
              {editHabitType === 'count' && (
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBarContainer, { backgroundColor: progressBgColor }]}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: parseInt(editCountTarget) > 0 ? '30%' : '0%', // Show preview if target exists
                          backgroundColor: editCountIsGood ? '#4CAF50' : '#ff4444',
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.targetEditContainer}>
                    <TextInput
                      style={[styles.inlineNumberInput, { color: textColor, borderColor }]}
                      value={editCountTarget}
                      onChangeText={setEditCountTarget}
                      placeholder="10"
                      keyboardType="numeric"
                      placeholderTextColor={textColor + '80'}
                    />
                    <TextInput
                      style={[styles.inlineUnitInput, { color: textColor, borderColor }]}
                      value={editCountUnit}
                      onChangeText={setEditCountUnit}
                      placeholder="units"
                      placeholderTextColor={textColor + '80'}
                    />
                  </View>
                </View>
              )}

              {/* Weight target info for weight habits */}
              {editHabitType === 'weight' && (
                <View style={styles.targetSection}>
                  <ThemedText style={styles.targetText}>
                    Target: {editWeightTarget} {editWeightUnit} (auto)
                  </ThemedText>
                </View>
              )}

              {/* Sub-habits for normal habits in edit mode - always show if switching to normal */}
              {editHabitType === 'normal' && (
                <View style={styles.subHabitsInCard}>
                  {subHabits.length > 0 ? (
                    <DraggableFlatList
                      data={subHabits}
                      onDragEnd={({ data }) => {
                        setSubHabits(data);
                        // TODO: Update order in backend
                      }}
                      keyExtractor={item => item.id.toString()}
                      renderItem={({ item, drag, isActive }: RenderItemParams<SubHabit>) => (
                        <ScaleDecorator activeScale={1.05}>
                          <View
                            style={[styles.subHabitItemInCard, { opacity: isActive ? 0.8 : 1 }]}
                          >
                            <TouchableOpacity style={styles.subHabitCheckbox} disabled={true}>
                              <View
                                style={[
                                  styles.subHabitCheckboxInner,
                                  {
                                    backgroundColor: 'transparent',
                                    borderColor: liveHabitColor,
                                    opacity: 0.5,
                                  },
                                ]}
                              />
                            </TouchableOpacity>

                            {editingSubHabitId === item.id ? (
                              <TextInput
                                style={[styles.subHabitNameEditInput, { color: textColor }]}
                                value={editingSubHabitName}
                                onChangeText={setEditingSubHabitName}
                                onBlur={() => {
                                  // TODO: Save the edited name
                                  setEditingSubHabitId(null);
                                }}
                                onSubmitEditing={() => {
                                  // TODO: Save the edited name
                                  setEditingSubHabitId(null);
                                }}
                                autoFocus
                                returnKeyType="done"
                              />
                            ) : (
                              <TouchableOpacity
                                style={styles.subHabitNameTouchable}
                                onPress={() => {
                                  setEditingSubHabitId(item.id);
                                  setEditingSubHabitName(item.name);
                                }}
                              >
                                <ThemedText
                                  style={[styles.subHabitNameInCard, { color: textColor }]}
                                >
                                  {item.name}
                                </ThemedText>
                              </TouchableOpacity>
                            )}

                            <TouchableOpacity
                              onLongPress={drag}
                              delayLongPress={100}
                              style={styles.dragHandleSubHabitInCard}
                            >
                              <ThemedText
                                style={[styles.dragHandleText, { color: textColor + '80' }]}
                              >
                                ⋮⋮
                              </ThemedText>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.deleteSubHabitButtonInCard,
                                { borderColor: '#ff4444' },
                              ]}
                              onPress={() => {
                                console.log(
                                  'Delete button pressed for sub-habit:',
                                  item.name,
                                  'ID:',
                                  item.id
                                );
                                deleteSubHabit(item.id);
                              }}
                            >
                              <ThemedText style={styles.deleteSubHabitTextInCard}>✕</ThemedText>
                            </TouchableOpacity>
                          </View>
                        </ScaleDecorator>
                      )}
                      scrollEnabled={false}
                    />
                  ) : (
                    <View />
                  )}

                  {/* Add new sub-habit input at the bottom */}
                  <View style={styles.subHabitItemInCard}>
                    <View
                      style={[
                        styles.subHabitCheckbox,
                        {
                          backgroundColor: 'transparent',
                          borderColor: liveHabitColor,
                          opacity: 0.3,
                          borderStyle: 'dashed',
                        },
                      ]}
                    />
                    <TextInput
                      style={[styles.subHabitInputInCard, { color: textColor }]}
                      value={newSubHabitName}
                      onChangeText={setNewSubHabitName}
                      placeholder="Add sub-habit..."
                      placeholderTextColor={textColor + '40'}
                      onSubmitEditing={addSubHabit}
                      returnKeyType="done"
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Right section with controls */}
            <View style={styles.rightSection}>
              {editHabitType === 'count' && (
                <>
                  <View style={styles.countDisplay}>
                    <ThemedText style={styles.currentCount}>
                      {habit.has_counts ? (loading ? '...' : todayCount) : '3'}
                    </ThemedText>
                    <ThemedText style={styles.unit}>{editCountUnit || 'units'}</ThemedText>
                  </View>

                  <View style={styles.controls}>
                    <TouchableOpacity
                      style={[
                        styles.controlButton,
                        {
                          backgroundColor: editCountIsGood ? '#ff4444' : '#4CAF50',
                          borderColor: editCountIsGood ? '#ff4444' : '#4CAF50',
                        },
                      ]}
                      disabled={true}
                    >
                      <ThemedText style={[styles.controlButtonText, { color: 'white' }]}>
                        -
                      </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.controlButton,
                        {
                          backgroundColor: editCountIsGood ? '#4CAF50' : '#ff4444',
                          borderColor: editCountIsGood ? '#4CAF50' : '#ff4444',
                        },
                      ]}
                      disabled={true}
                    >
                      <ThemedText style={[styles.controlButtonText, { color: 'white' }]}>
                        +
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {editHabitType === 'weight' && (
                <>
                  <View style={styles.weightDisplay}>
                    <TextInput
                      style={[styles.currentWeightInput, { color: textColor, borderColor }]}
                      value={currentWeight ? (Math.round(currentWeight * 10) / 10).toString() : ''}
                      onChangeText={value => {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue) || value === '') {
                          setCurrentWeight(value === '' ? null : numValue);
                        }
                      }}
                      placeholder="Starting weight"
                      keyboardType="numeric"
                      placeholderTextColor={textColor + '60'}
                    />
                    <ThemedText style={styles.unit}>{editWeightUnit || 'kg'}</ThemedText>
                  </View>

                  <View style={styles.controls}>
                    <TouchableOpacity
                      style={[
                        styles.controlButton,
                        { backgroundColor: '#ff4444', borderColor: '#ff4444' },
                      ]}
                      disabled={true}
                    >
                      <ThemedText style={[styles.controlButtonText, { color: 'white' }]}>
                        -
                      </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.controlButton,
                        { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
                      ]}
                      disabled={true}
                    >
                      <ThemedText style={[styles.controlButtonText, { color: 'white' }]}>
                        +
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </ThemedView>

        {/* Settings bar */}
        <ThemedView style={[styles.editSettingsBar, { backgroundColor, borderColor }]}>
          {/* Type selector */}
          <View style={styles.typeSelectorCompact}>
            {['normal', 'count', 'weight'].map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButtonCompact,
                  {
                    backgroundColor: editHabitType === type ? tintColor : 'transparent',
                    borderColor: tintColor,
                  },
                ]}
                onPress={() => setEditHabitType(type)}
              >
                <ThemedText
                  style={[
                    styles.typeButtonTextCompact,
                    { color: editHabitType === type ? backgroundColor : tintColor },
                  ]}
                >
                  {type === 'normal' ? '✓' : type === 'count' ? '#' : '⚖'}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Type-specific settings */}
          {editHabitType === 'normal' && (
            <>
              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>{formatRewardLabel('Checked:')}</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editSuccessReward}
                  onChangeText={setEditSuccessReward}
                  placeholder="1"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>

              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>{formatRewardLabel('Unchecked:')}</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editFailureReward}
                  onChangeText={setEditFailureReward}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>

              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>{formatRewardLabel('Sub-habit:')}</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editSubHabitPoints}
                  onChangeText={setEditSubHabitPoints}
                  placeholder="5"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>
            </>
          )}

          {editHabitType === 'count' && (
            <>
              <View style={styles.stepSizeContainer}>
                <ThemedText style={styles.miniLabel}>Step:</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editCountStepSize}
                  onChangeText={setEditCountStepSize}
                  placeholder="1"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>

              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>{formatRewardLabel('Per +/-:')}</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editCountReward}
                  onChangeText={setEditCountReward}
                  placeholder="0.1"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>

              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>{formatRewardLabel('Checked:')}</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editCountCheckBonus}
                  onChangeText={setEditCountCheckBonus}
                  placeholder="5"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>

              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>{formatRewardLabel('Unchecked:')}</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editCountCheckPenalty}
                  onChangeText={setEditCountCheckPenalty}
                  placeholder="5"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.goodBadToggle,
                  {
                    backgroundColor: editCountIsGood ? '#4CAF50' : '#ff4444',
                  },
                ]}
                onPress={() => setEditCountIsGood(!editCountIsGood)}
              >
                <ThemedText style={[styles.goodBadText, { color: 'white' }]}>
                  {editCountIsGood ? '↑ Good' : '↓ Bad'}
                </ThemedText>
              </TouchableOpacity>
            </>
          )}

          {editHabitType === 'weight' && (
            <>
              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>Target:</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editWeightTarget}
                  onChangeText={setEditWeightTarget}
                  placeholder="70"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>

              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>Unit:</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editWeightUnit}
                  onChangeText={setEditWeightUnit}
                  placeholder="kg"
                  placeholderTextColor={textColor + '80'}
                />
              </View>

              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>{formatRewardLabel('Per unit:')}</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editWeightReward}
                  onChangeText={setEditWeightReward}
                  placeholder="1"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>

              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>{formatRewardLabel('Checked:')}</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editWeightCheckBonus}
                  onChangeText={setEditWeightCheckBonus}
                  placeholder="5"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>

              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>{formatRewardLabel('Unchecked:')}</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editWeightCheckPenalty}
                  onChangeText={setEditWeightCheckPenalty}
                  placeholder="5"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>
            </>
          )}

          {/* Weekday Schedule */}
          <View style={styles.rewardContainer}>
            <ThemedText style={styles.miniLabel}>Show on:</ThemedText>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.weekdayButtonMini,
                  {
                    backgroundColor: editWeekdays.includes(index) ? tintColor : 'transparent',
                    borderColor: tintColor,
                  },
                ]}
                onPress={() => {
                  if (editWeekdays.includes(index)) {
                    setEditWeekdays(prev => prev.filter(d => d !== index));
                  } else {
                    setEditWeekdays(prev => [...prev, index].sort());
                  }
                }}
              >
                <ThemedText
                  style={[
                    styles.weekdayButtonTextMini,
                    { color: editWeekdays.includes(index) ? backgroundColor : tintColor },
                  ]}
                >
                  {day}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Color Hue Slider */}
          <View style={styles.hueSliderContainer}>
            <View style={styles.hueSliderLabelRow}>
              <ThemedText style={styles.miniLabel}>Color:</ThemedText>
              <TouchableOpacity style={styles.resetHueButton} onPress={() => setEditHue('')}>
                <ThemedText style={[styles.miniLabel, { opacity: 0.6 }]}>Auto</ThemedText>
              </TouchableOpacity>
            </View>
            <View style={styles.hueSliderWrapper}>
              <View style={styles.hueGradientBar} pointerEvents="none" />
              <Slider
                style={styles.hueSlider}
                minimumValue={0}
                maximumValue={360}
                value={editHue ? parseFloat(editHue) : 200}
                onValueChange={value => setEditHue(Math.round(value).toString())}
                minimumTrackTintColor="transparent"
                maximumTrackTintColor="transparent"
                thumbTintColor={getHabitColor(
                  habit.id,
                  editHue ? parseFloat(editHue) : undefined,
                  userSettings.color_brightness,
                  userSettings.color_saturation,
                  isDarkMode
                )}
              />
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelButtonCompact} onPress={handleCancel}>
              <ThemedText style={[styles.actionButtonTextCompact, { color: '#ff4444' }]}>
                ✕
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButtonCompact, { backgroundColor: tintColor }]}
              onPress={handleSave}
            >
              <ThemedText style={[styles.actionButtonTextCompact, { color: backgroundColor }]}>
                ✓
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </>
    );
  }

  // Normal view
  return (
    <>
      <ThemedView
        style={[
          styles.container,
          {
            borderColor: liveHabitColor,
            borderLeftWidth: 4,
            borderLeftColor: liveHabitColor,
            opacity: isActive ? 0.7 : 1,
          },
        ]}
      >
        <View style={styles.mainRow}>
          {isDraggable && (
            <TouchableOpacity style={styles.dragHandle} onLongPress={onDrag} delayLongPress={100}>
              <ThemedText style={[styles.dragHandleText, { color: textColor }]}>⋮⋮</ThemedText>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.checkButton,
              {
                backgroundColor: isCheckedToday ? liveHabitColor : 'transparent',
                borderColor: liveHabitColor,
                borderWidth: isCheckedToday ? 0 : 2,
              },
            ]}
            onPress={handleCheck}
            disabled={checking}
          >
            <ThemedText
              style={[
                styles.checkButtonText,
                {
                  color: isCheckedToday ? backgroundColor : liveHabitColor,
                },
              ]}
            >
              {checking ? '...' : '✓'}
            </ThemedText>
          </TouchableOpacity>

          <View style={styles.leftSection}>
            <ThemedText style={styles.habitName} numberOfLines={1} ellipsizeMode="tail">
              {habit.name}
            </ThemedText>
            {habit.description && (
              <ThemedText style={styles.description} numberOfLines={1} ellipsizeMode="tail">
                {habit.description}
              </ThemedText>
            )}

            {/* Count habit progress */}
            {habit.has_counts && target > 0 && (
              <View style={styles.progressContainer}>
                <View style={[styles.progressBarContainer, { backgroundColor: progressBgColor }]}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${progressPercentage}%`,
                        backgroundColor: countIsGood ? '#4CAF50' : '#ff4444',
                      },
                    ]}
                  />
                </View>
                <ThemedText style={styles.targetText}>
                  {target} {unit}
                </ThemedText>
              </View>
            )}

            {/* Weight habit progress */}
            {habit.is_weight && targetWeight && (
              <View style={styles.targetSection}>
                <ThemedText style={styles.targetText}>
                  Target: {targetWeight} {unit} ({getInferredGoalType()})
                </ThemedText>
                {weightProgressInfo && (
                  <ThemedText style={[styles.progressText, { color: weightProgressInfo.color }]}>
                    {weightProgressInfo.status}
                  </ThemedText>
                )}
              </View>
            )}

            {/* Sub-habits for normal habits - only show in non-edit mode if actually normal type */}
            {!habit.has_counts && !habit.is_weight && subHabits.length > 0 && (
              <View style={styles.subHabitsInCard}>
                {subHabits.map(subHabit => (
                  <TouchableOpacity
                    key={subHabit.id}
                    style={styles.subHabitItemInCard}
                    onPress={() => toggleSubHabit(subHabit.id)}
                  >
                    <View style={styles.subHabitCheckbox}>
                      <View
                        style={[
                          styles.subHabitCheckboxInner,
                          {
                            backgroundColor: checkedSubHabits.has(subHabit.id)
                              ? liveHabitColor
                              : 'transparent',
                            borderColor: liveHabitColor,
                          },
                        ]}
                      >
                        {checkedSubHabits.has(subHabit.id) && (
                          <ThemedText
                            style={[styles.subHabitCheckmark, { color: backgroundColor }]}
                          >
                            ✓
                          </ThemedText>
                        )}
                      </View>
                    </View>
                    <ThemedText
                      style={[
                        styles.subHabitNameInCard,
                        {
                          color: checkedSubHabits.has(subHabit.id) ? textColor + '60' : textColor,
                          textDecorationLine: checkedSubHabits.has(subHabit.id)
                            ? 'line-through'
                            : 'none',
                        },
                      ]}
                    >
                      {subHabit.name}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Right section with type-specific controls */}
          <View style={styles.rightSection}>
            {habit.has_counts && (
              <>
                <View style={styles.countDisplay}>
                  <ThemedText style={styles.currentCount}>
                    {loading ? '...' : todayCount}
                  </ThemedText>
                  <ThemedText style={styles.unit}>{unit}</ThemedText>
                </View>

                <View style={styles.controls}>
                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      {
                        backgroundColor: countIsGood ? '#ff4444' : '#4CAF50',
                        borderColor: countIsGood ? '#ff4444' : '#4CAF50',
                      },
                    ]}
                    onPress={() => updateCount(false)}
                    disabled={updating || todayCount <= 0}
                  >
                    <ThemedText style={[styles.controlButtonText, { color: 'white' }]}>
                      -
                    </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      {
                        backgroundColor: countIsGood ? '#4CAF50' : '#ff4444',
                        borderColor: countIsGood ? '#4CAF50' : '#ff4444',
                      },
                    ]}
                    onPress={() => updateCount(true)}
                    disabled={updating}
                  >
                    <ThemedText style={[styles.controlButtonText, { color: 'white' }]}>
                      +
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {habit.is_weight && (
              <>
                <View style={styles.weightDisplay}>
                  <ThemedText style={styles.currentWeight}>
                    {loading
                      ? '...'
                      : currentWeight
                        ? `${Math.round(currentWeight * 10) / 10}`
                        : 'No data'}
                  </ThemedText>
                  <ThemedText style={styles.unit}>{unit}</ThemedText>
                </View>

                <View style={styles.controls}>
                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      {
                        backgroundColor: getWeightButtonColors().decreaseColor,
                        borderColor: getWeightButtonColors().decreaseColor,
                      },
                    ]}
                    onPress={() => updateWeight(false)}
                    disabled={updating}
                  >
                    <ThemedText style={[styles.controlButtonText, { color: 'white' }]}>
                      -
                    </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      {
                        backgroundColor: getWeightButtonColors().increaseColor,
                        borderColor: getWeightButtonColors().increaseColor,
                      },
                    ]}
                    onPress={() => updateWeight(true)}
                    disabled={updating}
                  >
                    <ThemedText style={[styles.controlButtonText, { color: 'white' }]}>
                      +
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          <TouchableOpacity
            style={styles.menuButton}
            onPress={event => {
              event.currentTarget.measure((x, y, width, height, pageX, pageY) => {
                setDropdownPosition({ x: pageX - 80, y: pageY + height });
                setShowDropdown(true);
              });
            }}
          >
            <ThemedText style={[styles.menuDots, { color: textColor }]}>⋮</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>

      {/* Dropdown Menu */}
      <Modal
        visible={showDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <Pressable style={styles.dropdownOverlay} onPress={() => setShowDropdown(false)}>
          <ThemedView
            style={[
              styles.dropdownMenu,
              {
                position: 'absolute',
                top: dropdownPosition.y,
                left: dropdownPosition.x,
                borderColor: borderColor,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setShowDropdown(false);
                onEdit?.();
              }}
            >
              <ThemedText style={styles.dropdownText}>Edit</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setShowDropdown(false);
                handleDelete();
              }}
            >
              <ThemedText style={[styles.dropdownText, styles.deleteText]}>Delete</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </Pressable>
      </Modal>

      {/* Weight input modal */}
      {habit.is_weight && (
        <Modal
          visible={showWeightInput}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowWeightInput(false)}
        >
          <View style={styles.modalOverlay}>
            <ThemedView style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>Update Weight</ThemedText>

              <ThemedTextInput
                style={styles.weightInput}
                value={newWeight}
                onChangeText={setNewWeight}
                placeholder={`Enter weight in ${unit}`}
                keyboardType="numeric"
                autoFocus
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowWeightInput(false);
                    setNewWeight('');
                  }}
                >
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton, { backgroundColor: tintColor }]}
                  onPress={() => handleWeightUpdate()}
                  disabled={updating}
                >
                  <ThemedText style={[styles.saveButtonText, { color: backgroundColor }]}>
                    {updating ? 'Saving...' : 'Save'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Align to top instead of center
    gap: 6,
  },
  dragHandle: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 8, // Align with text baseline
  },
  dragHandleText: {
    fontSize: 12,
    opacity: 0.6,
    lineHeight: 14,
  },
  checkButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2, // Slight offset to align with first line of text
  },
  checkButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  leftSection: {
    flex: 1,
    minWidth: 0,
  },
  rightSection: {
    alignItems: 'center',
    gap: 8,
  },
  habitName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarContainer: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  targetText: {
    fontSize: 10,
    opacity: 0.7,
    minWidth: 40,
  },
  targetSection: {
    marginTop: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  countDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 6,
  },
  currentCount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  unit: {
    fontSize: 12,
    marginLeft: 4,
    opacity: 0.7,
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  weightDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 6,
  },
  currentWeight: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  currentWeightInput: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    minWidth: 60,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  updateButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  updateButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  menuButton: {
    padding: 8,
    borderRadius: 8,
    marginTop: 2, // Align with text baseline
  },
  menuDots: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 120,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: 16,
  },
  deleteText: {
    color: '#ff4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 300,
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  weightInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {},
  cancelButtonText: {
    fontSize: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Editing styles
  habitNameInput: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  descriptionInput: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  targetEditContainer: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  inlineNumberInput: {
    fontSize: 10,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    width: 35,
  },
  inlineUnitInput: {
    fontSize: 10,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    width: 40,
  },
  editSettingsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    padding: 8,
    marginTop: -4,
    marginBottom: 4,
    marginHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  typeSelectorCompact: {
    flexDirection: 'row',
    gap: 4,
  },
  typeButtonCompact: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeButtonTextCompact: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepSizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  goalTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  miniNumberInput: {
    fontSize: 12,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    width: 40,
  },
  goodBadToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  goodBadText: {
    fontSize: 12,
    fontWeight: '600',
  },
  goalToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  goalText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 'auto',
  },
  cancelButtonCompact: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  saveButtonCompact: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonTextCompact: {
    fontSize: 18,
    fontWeight: '600',
  },
  weekdayButtonMini: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayButtonTextMini: {
    fontSize: 10,
    fontWeight: '600',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  colorPreview: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  hueSliderContainer: {
    flexDirection: 'column',
    gap: 8,
    minWidth: 280,
    maxWidth: 400,
  },
  hueSliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hueSliderWrapper: {
    flex: 1,
    position: 'relative',
    height: 32,
    justifyContent: 'center',
  },
  hueSlider: {
    flex: 1,
    height: 32,
  },
  hueTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'transparent',
  },
  hueGradientBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 8,
    borderRadius: 4,
    background:
      'linear-gradient(to right, #ff0000 0%, #ffff00 16.67%, #00ff00 33.33%, #00ffff 50%, #0000ff 66.67%, #ff00ff 83.33%, #ff0000 100%)',
    backgroundColor: '#ff0000', // Fallback for platforms that don't support gradients
  },
  hueThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
    elevation: 2,
  },
  resetHueButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  // Sub-habits in main card area
  subHabitsInCard: {
    marginTop: 6,
    gap: 2,
  },
  subHabitItemInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingRight: 2,
  },
  subHabitCheckbox: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subHabitCheckboxInner: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subHabitCheckmark: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  subHabitNameInCard: {
    fontSize: 12,
    flex: 1,
  },
  subHabitNameTouchable: {
    flex: 1,
    paddingVertical: 2,
  },
  subHabitNameEditInput: {
    fontSize: 12,
    flex: 1,
    padding: 2,
    marginVertical: -2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.3)',
  },
  // Sub-habit input for new items
  subHabitInputInCard: {
    fontSize: 12,
    flex: 1,
    padding: 0,
    paddingVertical: 2,
  },
  // Drag handle for sub-habits
  dragHandleSubHabitInCard: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: -4,
  },
  deleteSubHabitButtonInCard: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteSubHabitTextInCard: {
    fontSize: 10,
    color: '#ff4444',
    fontWeight: '600',
  },
  weekdaySection: {
    marginTop: 12,
    marginBottom: 8,
  },
  weekdayLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  weekdayButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekdayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
