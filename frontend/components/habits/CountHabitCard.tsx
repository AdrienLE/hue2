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
import { ThemedView } from '../ThemedView';
import { ThemedText } from '../ThemedText';
import { HabitService } from '@/lib/services/habitService';
import { useAuth } from '@/auth/AuthContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { getHabitColor } from '@/constants/Colors';
import { useUser } from '@/contexts/UserContext';
import { getLogicalDateTimestamp } from '@/contexts/DevDateContext';
import type { Habit, Count } from '@/lib/types/habits';

interface CountHabitCardProps {
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

export function CountHabitCard({ habit, onUpdate, onDelete, onEdit, onCancelEdit, isEditing, onChecked, onUnchecked, isCheckedToday, isDraggable, onDrag, isActive }: CountHabitCardProps) {
  const [todayCount, setTodayCount] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();
  const { addReward, subtractReward, userSettings } = useUser();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({ light: '#e1e5e9', dark: '#333' }, 'border');
  const progressBgColor = useThemeColor({ light: '#e0e0e0', dark: '#444' }, 'background');
  const habitColor = getHabitColor(habit.id);

  const target = habit.count_settings?.target || 0;
  const unit = habit.count_settings?.unit || '';
  const stepSize = habit.count_settings?.step_size || 1;
  const countIsGood = habit.count_settings?.count_is_good ?? true; // Default: more is better

  const loadTodayCount = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const response = await HabitService.getCounts(token, {
        habitId: habit.id,
        startDate: startOfDay,
        endDate: endOfDay,
      });

      if (response.data && response.data.length > 0) {
        // Sum all counts for today
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
        
        // Calculate reward based on count logic
        const countReward = habit.reward_settings?.count_reward || 0;
        if (countReward > 0) {
          const rewardAmount = countReward * Math.abs(stepSize);
          
          if (countIsGood) {
            // If count is good, always reward for increment
            if (increment) {
              await addReward(rewardAmount);
            }
            // Don't penalize decrement for good counts
          } else {
            // If count is bad, reward for decrement (reducing bad thing)
            if (!increment) {
              await addReward(rewardAmount);
            }
            // Penalize increment only if exceeding target
            else if (target > 0 && newValue > target) {
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

  const handleCheck = async () => {
    if (!token || checking) return;

    setChecking(true);
    try {
      const successReward = habit.reward_settings?.success_points || 0;
      
      if (isCheckedToday) {
        // Uncheck the habit - subtract success reward
        await HabitService.uncheckHabitToday(habit.id, token);
        if (successReward > 0) {
          await subtractReward(successReward);
        }
        Alert.alert('Success', 'Habit unchecked!');
        onUnchecked?.(habit.id);
      } else {
        // Check the habit - add success reward
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

  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  
  // Editing state
  const [editName, setEditName] = useState(habit.name);
  const [editDescription, setEditDescription] = useState(habit.description || '');
  const [editTarget, setEditTarget] = useState(habit.count_settings?.target?.toString() || '');
  const [editUnit, setEditUnit] = useState(habit.count_settings?.unit || '');
  const [editStepSize, setEditStepSize] = useState(habit.count_settings?.step_size?.toString() || '1');
  const [editCountIsGood, setEditCountIsGood] = useState(habit.count_settings?.count_is_good ?? true);
  const [editHabitType, setEditHabitType] = useState(habit.has_counts ? 'count' : habit.is_weight ? 'weight' : 'normal');
  
  // Reward settings
  const [editSuccessReward, setEditSuccessReward] = useState(habit.reward_settings?.success_points?.toString() || '1');
  const [editFailureReward, setEditFailureReward] = useState(habit.reward_settings?.penalty_points?.toString() || '0');
  const [editCountReward, setEditCountReward] = useState(habit.reward_settings?.count_reward?.toString() || '0.1');
  const [editTrackingBonus, setEditTrackingBonus] = useState(habit.reward_settings?.tracking_bonus?.toString() || '5');
  const [editTrackingPenalty, setEditTrackingPenalty] = useState(habit.reward_settings?.tracking_penalty?.toString() || '2');
  const [editWeightReward, setEditWeightReward] = useState(habit.reward_settings?.weight_reward?.toString() || '1');
  const [editWeightTarget, setEditWeightTarget] = useState(habit.weight_settings?.target_weight?.toString() || '');
  const [editWeightUnit, setEditWeightUnit] = useState(habit.weight_settings?.unit || 'kg');
  const [editWeightStep, setEditWeightStep] = useState('0.1');

  const handleSave = async () => {
    if (!token) return;

    try {
      const updatedHabit = {
        name: editName,
        description: editDescription,
        has_counts: editHabitType === 'count',
        is_weight: editHabitType === 'weight',
        count_settings: editHabitType === 'count' ? {
          target: parseInt(editTarget) || 0,
          unit: editUnit,
          step_size: parseInt(editStepSize) || 1,
          count_is_good: editCountIsGood,
        } : null,
        weight_settings: editHabitType === 'weight' ? {
          target_weight: parseFloat(editWeightTarget) || 0,
          unit: editWeightUnit,
          step_size: parseFloat(editWeightStep) || 0.1,
        } : null,
        reward_settings: {
          success_points: parseFloat(editSuccessReward) || 0,
          penalty_points: parseFloat(editFailureReward) || 0,
          ...(editHabitType === 'count' && { 
            count_reward: parseFloat(editCountReward) || 0,
            tracking_bonus: parseFloat(editTrackingBonus) || 0,
            tracking_penalty: parseFloat(editTrackingPenalty) || 0,
          }),
          ...(editHabitType === 'weight' && { weight_reward: parseFloat(editWeightReward) || 0 }),
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
    // Reset form to original values
    setEditName(habit.name);
    setEditDescription(habit.description || '');
    setEditTarget(habit.count_settings?.target?.toString() || '');
    setEditUnit(habit.count_settings?.unit || '');
    setEditStepSize(habit.count_settings?.step_size?.toString() || '1');
    setEditCountIsGood(habit.count_settings?.count_is_good ?? true);
    setEditHabitType(habit.has_counts ? 'count' : habit.is_weight ? 'weight' : 'normal');
    
    // Reset reward settings
    setEditSuccessReward(habit.reward_settings?.success_points?.toString() || '1');
    setEditFailureReward(habit.reward_settings?.penalty_points?.toString() || '0');
    setEditCountReward(habit.reward_settings?.count_reward?.toString() || '0.1');
    setEditTrackingBonus(habit.reward_settings?.tracking_bonus?.toString() || '5');
    setEditTrackingPenalty(habit.reward_settings?.tracking_penalty?.toString() || '2');
    setEditWeightReward(habit.reward_settings?.weight_reward?.toString() || '1');
    setEditWeightTarget(habit.weight_settings?.target_weight?.toString() || '');
    setEditWeightUnit(habit.weight_settings?.unit || 'kg');
    
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

  useEffect(() => {
    loadTodayCount();
  }, [habit.id, token]);

  const progressPercentage = target > 0 ? Math.min((todayCount / target) * 100, 100) : 0;

  if (isEditing) {
    // Preview what the edited habit will look like
    const previewTarget = parseInt(editTarget) || 0;
    const previewStepSize = parseInt(editStepSize) || 1;
    
    return (
      <>
        <ThemedView style={[styles.container, { borderColor: habitColor, borderLeftWidth: 4, borderLeftColor: habitColor }]}>
          {/* Main row similar to normal view but with editable fields */}
          <View style={styles.mainRow}>
            {/* Keep the check button visible but disabled */}
            <TouchableOpacity
              style={[
                styles.checkButton,
                {
                  backgroundColor: 'transparent',
                  borderColor: habitColor,
                  borderWidth: 2,
                  opacity: 0.5,
                }
              ]}
              disabled={true}
            >
              <ThemedText style={[styles.checkButtonText, { color: habitColor }]}>✓</ThemedText>
            </TouchableOpacity>
            
            <View style={styles.leftSection}>
              {/* Editable name in place */}
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
              
              {/* Show progress bar if count type with target */}
              {editHabitType === 'count' && previewTarget > 0 && (
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBarContainer, { backgroundColor: progressBgColor }]}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: '30%', // Just a preview
                          backgroundColor: editCountIsGood ? '#4CAF50' : '#ff4444',
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.targetEditContainer}>
                    <TextInput
                      style={[styles.inlineNumberInput, { color: textColor, borderColor }]}
                      value={editTarget}
                      onChangeText={setEditTarget}
                      placeholder="0"
                      keyboardType="numeric"
                      placeholderTextColor={textColor + '80'}
                    />
                    <TextInput
                      style={[styles.inlineUnitInput, { color: textColor, borderColor }]}
                      value={editUnit}
                      onChangeText={setEditUnit}
                      placeholder="unit"
                      placeholderTextColor={textColor + '80'}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Count controls section for count type */}
            {editHabitType === 'count' && (
              <View style={styles.rightSection}>
                <View style={styles.countDisplay}>
                  <ThemedText style={styles.currentCount}>0</ThemedText>
                  <ThemedText style={styles.unit}>{editUnit}</ThemedText>
                </View>
                
                <View style={styles.controls}>
                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      { 
                        backgroundColor: editCountIsGood ? '#ff4444' : '#4CAF50',
                        borderColor: editCountIsGood ? '#ff4444' : '#4CAF50',
                      }
                    ]}
                    disabled={true}
                  >
                    <ThemedText style={[styles.controlButtonText, { color: 'white' }]}>-</ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.controlButton,
                      { 
                        backgroundColor: editCountIsGood ? '#4CAF50' : '#ff4444',
                        borderColor: editCountIsGood ? '#4CAF50' : '#ff4444',
                      }
                    ]}
                    disabled={true}
                  >
                    <ThemedText style={[styles.controlButtonText, { color: 'white' }]}>+</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ThemedView>

        {/* Settings bar below the habit card */}
        <ThemedView style={[styles.editSettingsBar, { backgroundColor, borderColor }]}>
          {/* Type selector */}
          <View style={styles.typeSelectorCompact}>
            {['normal', 'count', 'weight'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButtonCompact,
                  { 
                    backgroundColor: editHabitType === type ? tintColor : 'transparent',
                    borderColor: tintColor,
                  }
                ]}
                onPress={() => setEditHabitType(type)}
              >
                <ThemedText style={[
                  styles.typeButtonTextCompact,
                  { color: editHabitType === type ? backgroundColor : tintColor }
                ]}>
                  {type === 'normal' ? '✓' : type === 'count' ? '#' : 'kg'}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Type-specific inline settings */}
          {editHabitType === 'normal' && (
            <>
              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>Success: $</ThemedText>
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
                <ThemedText style={styles.miniLabel}>Failure: $</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editFailureReward}
                  onChangeText={setEditFailureReward}
                  placeholder="0"
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
                  value={editStepSize}
                  onChangeText={setEditStepSize}
                  placeholder="1"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>

              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>Per +/-: $</ThemedText>
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
                <ThemedText style={styles.miniLabel}>Track ✓: $</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editTrackingBonus}
                  onChangeText={setEditTrackingBonus}
                  placeholder="5"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>

              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>Track ✗: $</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editTrackingPenalty}
                  onChangeText={setEditTrackingPenalty}
                  placeholder="2"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.goodBadToggle,
                  { 
                    backgroundColor: editCountIsGood ? '#4CAF50' : '#ff4444',
                  }
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
                <ThemedText style={styles.miniLabel}>Per unit:</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editWeightReward}
                  onChangeText={setEditWeightReward}
                  placeholder="1"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>
            </>
          )}

          {/* Action buttons */}
          <View style={styles.editActions}>
            <TouchableOpacity
              style={styles.cancelButtonCompact}
              onPress={handleCancel}
            >
              <ThemedText style={[styles.actionButtonTextCompact, { color: '#ff4444' }]}>✕</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.saveButtonCompact, { backgroundColor: tintColor }]}
              onPress={handleSave}
            >
              <ThemedText style={[styles.actionButtonTextCompact, { color: backgroundColor }]}>✓</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </>
    );
  }

  return (
    <>
      <ThemedView style={[styles.container, { borderColor: habitColor, borderLeftWidth: 4, borderLeftColor: habitColor, opacity: isActive ? 0.7 : 1 }]}>
        <View style={styles.mainRow}>
          {isDraggable && (
            <TouchableOpacity
              style={styles.dragHandle}
              onLongPress={onDrag}
              delayLongPress={100}
            >
              <ThemedText style={[styles.dragHandleText, { color: textColor }]}>⋮⋮</ThemedText>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[
              styles.checkButton,
              {
                backgroundColor: isCheckedToday ? habitColor : 'transparent',
                borderColor: habitColor,
                borderWidth: isCheckedToday ? 0 : 2,
              }
            ]}
            onPress={handleCheck}
            disabled={checking}
          >
            <ThemedText style={[
              styles.checkButtonText,
              {
                color: isCheckedToday ? backgroundColor : habitColor,
              }
            ]}>
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
            {target > 0 && (
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
          </View>

          <View style={styles.rightSection}>
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
                  styles.decrementButton,
                  { 
                    backgroundColor: countIsGood ? '#ff4444' : '#4CAF50',
                    borderColor: countIsGood ? '#ff4444' : '#4CAF50',
                  }
                ]}
                onPress={() => updateCount(false)}
                disabled={updating || todayCount <= 0}
              >
                <ThemedText style={[styles.controlButtonText, { color: 'white' }]}>-</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.controlButton, 
                  styles.incrementButton, 
                  { 
                    backgroundColor: countIsGood ? '#4CAF50' : '#ff4444',
                    borderColor: countIsGood ? '#4CAF50' : '#ff4444',
                  }
                ]}
                onPress={() => updateCount(true)}
                disabled={updating}
              >
                <ThemedText style={[styles.controlButtonText, { color: 'white' }]}>
                  +
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.menuButton}
            onPress={(event) => {
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
        <Pressable 
          style={styles.dropdownOverlay} 
          onPress={() => setShowDropdown(false)}
        >
          <ThemedView style={[
            styles.dropdownMenu,
            {
              position: 'absolute',
              top: dropdownPosition.y,
              left: dropdownPosition.x,
              borderColor: borderColor,
            }
          ]}>
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
    alignItems: 'center',
    gap: 6,
  },
  dragHandle: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  checkButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  leftSection: {
    flex: 1,
    minWidth: 0, // Allow text to truncate
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
  decrementButton: {
    backgroundColor: 'transparent',
  },
  incrementButton: {
    borderColor: 'transparent',
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  menuButton: {
    padding: 8,
    borderRadius: 8,
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
  // Editing styles - WYSIWYG format
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
});