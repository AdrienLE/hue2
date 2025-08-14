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
import { ThemedTextInput } from '../ThemedTextInput';
import { HabitService } from '@/lib/services/habitService';
import { useAuth } from '@/auth/AuthContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useUser } from '@/contexts/UserContext';
import { getLogicalDateTimestamp } from '@/contexts/DevDateContext';
import { getHabitColor } from '@/constants/Colors';
import type { Habit, WeightUpdate } from '@/lib/types/habits';

interface WeightHabitCardProps {
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

export function WeightHabitCard({ habit, onUpdate, onDelete, onEdit, onCancelEdit, isEditing, onChecked, onUnchecked, isCheckedToday, isDraggable, onDrag, isActive }: WeightHabitCardProps) {
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [checking, setChecking] = useState(false);
  const { token } = useAuth();
  const { addReward, subtractReward, userSettings } = useUser();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({ light: '#e1e5e9', dark: '#333' }, 'border');
  const habitColor = getHabitColor(habit.id);

  const targetWeight = habit.weight_settings?.target_weight;
  const unit = habit.weight_settings?.unit || 'kg';
  const goalType = habit.weight_settings?.goal_type || 'maintain';
  const stepSize = habit.weight_settings?.step_size || 0.1;
  
  // Editing state
  const [editName, setEditName] = useState(habit.name);
  const [editDescription, setEditDescription] = useState(habit.description || '');
  const [editTarget, setEditTarget] = useState(habit.weight_settings?.target_weight?.toString() || '');
  const [editUnit, setEditUnit] = useState(habit.weight_settings?.unit || 'kg');
  const [editGoalType, setEditGoalType] = useState(habit.weight_settings?.goal_type || 'maintain');
  const [editHabitType, setEditHabitType] = useState(habit.has_counts ? 'count' : habit.is_weight ? 'weight' : 'normal');
  
  // Reward settings
  const [editSuccessReward, setEditSuccessReward] = useState(habit.reward_settings?.success_points?.toString() || '1');
  const [editFailureReward, setEditFailureReward] = useState(habit.reward_settings?.penalty_points?.toString() || '0');
  const [editCountReward, setEditCountReward] = useState(habit.reward_settings?.count_reward?.toString() || '0.1');
  const [editWeightReward, setEditWeightReward] = useState(habit.reward_settings?.weight_reward?.toString() || '1');
  const [editTrackingBonus, setEditTrackingBonus] = useState(habit.reward_settings?.tracking_bonus?.toString() || '5');
  const [editTrackingPenalty, setEditTrackingPenalty] = useState(habit.reward_settings?.tracking_penalty?.toString() || '2');

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
        setCurrentWeight(null);
      }
    } catch (error) {
      console.error('Error loading current weight:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWeightUpdate = async (newWeight?: number) => {
    if (!token) return;

    const weight = newWeight || parseFloat(newWeight as any);
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
              // Moving closer to target - reward
              const improvement = oldDistance - newDistance;
              await addReward(weightReward * improvement);
            } else if (newDistance > oldDistance) {
              // Moving away from target - penalty
              const decline = newDistance - oldDistance;
              await subtractReward(weightReward * decline);
            }
          }
        }
        
        if (!newWeight) {
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
    if (!token || updating || !currentWeight) return;

    const change = increment ? stepSize : -stepSize;
    const newWeight = Math.max(0, currentWeight + change);
    
    await handleWeightUpdate(newWeight);
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
          step_size: parseInt('1') || 1,
          count_is_good: true,
        } : null,
        weight_settings: editHabitType === 'weight' ? {
          target_weight: parseFloat(editTarget) || 0,
          unit: editUnit,
          step_size: 0.1,
        } : null,
        reward_settings: {
          success_points: parseFloat(editSuccessReward) || 0,
          penalty_points: parseFloat(editFailureReward) || 0,
          ...(editHabitType === 'count' && { count_reward: parseFloat(editCountReward) || 0 }),
          ...(editHabitType === 'weight' && { 
            weight_reward: parseFloat(editWeightReward) || 0,
            tracking_bonus: parseFloat(editTrackingBonus) || 0,
            tracking_penalty: parseFloat(editTrackingPenalty) || 0,
          }),
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
    setEditTarget(habit.weight_settings?.target_weight?.toString() || '');
    setEditUnit(habit.weight_settings?.unit || 'kg');
    setEditGoalType(habit.weight_settings?.goal_type || 'maintain');
    setEditHabitType(habit.has_counts ? 'count' : habit.is_weight ? 'weight' : 'normal');
    
    // Reset reward settings
    setEditSuccessReward(habit.reward_settings?.success_points?.toString() || '1');
    setEditFailureReward(habit.reward_settings?.penalty_points?.toString() || '0');
    setEditCountReward(habit.reward_settings?.count_reward?.toString() || '0.1');
    setEditWeightReward(habit.reward_settings?.weight_reward?.toString() || '1');
    
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
    loadCurrentWeight();
  }, [habit.id, token]);

  const getProgressInfo = () => {
    if (!currentWeight || !targetWeight) return null;

    const difference = currentWeight - targetWeight;
    const isOnTarget = Math.abs(difference) <= 0.5; // Within 0.5 units is considered "on target"

    let status = '';
    let color = textColor;

    if (isOnTarget) {
      status = 'Target reached! 🎉';
      color = tintColor;
    } else {
      status = `${Math.abs(difference).toFixed(1)} ${unit} ${difference > 0 ? 'above' : 'below'} target`;
    }

    return { status, color };
  };

  const progressInfo = getProgressInfo();

  if (isEditing) {
    // Preview what the edited habit will look like
    const previewTarget = parseFloat(editTarget) || 0;
    
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
            </View>

            {/* Weight controls section for weight type */}
            {editHabitType === 'weight' && (
              <View style={styles.rightSection}>
                <View style={styles.weightDisplay}>
                  <ThemedText style={styles.currentWeight}>
                    {loading ? '...' : currentWeight ? `${currentWeight}` : '0'}
                  </ThemedText>
                  <ThemedText style={styles.unit}>{editUnit}</ThemedText>
                </View>
                
                <View style={styles.controls}>
                  <TouchableOpacity
                    style={[styles.controlButton, { backgroundColor: '#ff4444', borderColor: '#ff4444' }]}
                    disabled={true}
                  >
                    <ThemedText style={[styles.controlButtonText, { color: 'white' }]}>-</ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.controlButton, { backgroundColor: '#4CAF50', borderColor: '#4CAF50' }]}
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

          {editHabitType === 'weight' && (
            <>
              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>Target:</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editTarget}
                  onChangeText={setEditTarget}
                  placeholder="70"
                  keyboardType="numeric"
                  placeholderTextColor={textColor + '80'}
                />
              </View>
              
              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>Unit:</ThemedText>
                <TextInput
                  style={[styles.miniNumberInput, { color: textColor, borderColor }]}
                  value={editUnit}
                  onChangeText={setEditUnit}
                  placeholder="kg"
                  placeholderTextColor={textColor + '80'}
                />
              </View>

              <View style={styles.rewardContainer}>
                <ThemedText style={styles.miniLabel}>Per {editUnit}: $</ThemedText>
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
            {targetWeight && (
              <View style={styles.targetSection}>
                <ThemedText style={styles.targetText}>
                  Target: {targetWeight} {unit}
                </ThemedText>
                {progressInfo && (
                  <ThemedText style={[styles.progressText, { color: progressInfo.color }]}>
                    {progressInfo.status}
                  </ThemedText>
                )}
              </View>
            )}
          </View>

          <View style={styles.rightSection}>
            <View style={styles.weightDisplay}>
              <ThemedText style={styles.currentWeight}>
                {loading ? '...' : currentWeight ? `${currentWeight}` : 'No data'}
              </ThemedText>
              <ThemedText style={styles.unit}>{unit}</ThemedText>
            </View>

            {currentWeight && (
              <View style={styles.controls}>
                <TouchableOpacity
                  style={[styles.controlButton, { backgroundColor: '#ff4444', borderColor: '#ff4444' }]}
                  onPress={() => updateWeight(false)}
                  disabled={updating}
                >
                  <ThemedText style={[styles.controlButtonText, { color: 'white' }]}>-</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.controlButton, { backgroundColor: '#4CAF50', borderColor: '#4CAF50' }]}
                  onPress={() => updateWeight(true)}
                  disabled={updating}
                >
                  <ThemedText style={[styles.controlButtonText, { color: 'white' }]}>+</ThemedText>
                </TouchableOpacity>
              </View>
            )}
            
            {!currentWeight && (
              <TouchableOpacity
                style={[styles.updateButton, { backgroundColor: tintColor }]}
                onPress={() => setShowWeightInput(true)}
              >
                <ThemedText style={[styles.updateButtonText, { color: backgroundColor }]}>
                  Set Weight
                </ThemedText>
              </TouchableOpacity>
            )}
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

      {/* Modal for manual weight input */}
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
  targetSection: {
    marginTop: 4,
  },
  targetText: {
    fontSize: 10,
    opacity: 0.7,
  },
  progressText: {
    fontSize: 12,
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
  saveButton: {
    // backgroundColor set dynamically
  },
  cancelButtonText: {
    fontSize: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
});