import React, { useState, useEffect } from 'react';
import { Modal, ScrollView, StyleSheet, Alert, Switch, TouchableOpacity } from 'react-native';
import { ThemedView } from '../ThemedView';
import { ThemedText } from '../ThemedText';
import { ThemedTextInput } from '../ThemedTextInput';
import { HabitService } from '@/lib/services/habitService';
import { useAuth } from '@/auth/AuthContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import type {
  Habit,
  HabitUpdate,
  CountSettings,
  WeightSettings,
  RewardSettings,
} from '@/lib/types/habits';

interface HabitSettingsModalProps {
  habit: Habit;
  visible: boolean;
  onClose: () => void;
  onUpdate: (updatedHabit: Habit) => void;
}

export function HabitSettingsModal({ habit, visible, onClose, onUpdate }: HabitSettingsModalProps) {
  const [name, setName] = useState(habit.name);
  const [description, setDescription] = useState(habit.description || '');
  const [hasCount, setHasCount] = useState(habit.has_counts);
  const [isWeight, setIsWeight] = useState(habit.is_weight);
  const [saving, setSaving] = useState(false);

  // Count settings
  const [countTarget, setCountTarget] = useState(habit.count_settings?.target?.toString() || '');
  const [countUnit, setCountUnit] = useState(habit.count_settings?.unit || '');
  const [countStepSize, setCountStepSize] = useState(
    habit.count_settings?.step_size?.toString() || '1'
  );

  // Weight settings
  const [weightTarget, setWeightTarget] = useState(
    habit.weight_settings?.target_weight?.toString() || ''
  );
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>(habit.weight_settings?.unit || 'kg');

  // Reward settings
  const [successPoints, setSuccessPoints] = useState(
    habit.reward_settings?.success_points?.toString() || '10'
  );
  const [penaltyPoints, setPenaltyPoints] = useState(
    habit.reward_settings?.penalty_points?.toString() || '5'
  );

  const { token } = useAuth();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');

  // Reset form when habit changes
  useEffect(() => {
    setName(habit.name);
    setDescription(habit.description || '');
    setHasCount(habit.has_counts);
    setIsWeight(habit.is_weight);
    setCountTarget(habit.count_settings?.target?.toString() || '');
    setCountUnit(habit.count_settings?.unit || '');
    setCountStepSize(habit.count_settings?.step_size?.toString() || '1');
    setWeightTarget(habit.weight_settings?.target_weight?.toString() || '');
    setWeightUnit(habit.weight_settings?.unit || 'kg');
    setSuccessPoints(habit.reward_settings?.success_points?.toString() || '10');
    setPenaltyPoints(habit.reward_settings?.penalty_points?.toString() || '5');
  }, [habit]);

  const handleSave = async () => {
    if (!token) {
      Alert.alert('Error', 'You must be logged in to update habits');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a habit name');
      return;
    }

    if (hasCount && isWeight) {
      Alert.alert('Error', 'A habit cannot be both count-based and weight-based');
      return;
    }

    setSaving(true);
    try {
      const updateData: HabitUpdate = {
        name: name.trim(),
        description: description.trim() || undefined,
        has_counts: hasCount,
        is_weight: isWeight,
      };

      // Add count settings if applicable
      if (hasCount) {
        const countSettings: CountSettings = {
          unit: countUnit.trim() || undefined,
          step_size: parseFloat(countStepSize) || 1,
        };

        if (countTarget.trim()) {
          countSettings.target = parseFloat(countTarget);
        }

        updateData.count_settings = countSettings;
      }

      // Add weight settings if applicable
      if (isWeight) {
        const weightSettings: WeightSettings = {
          unit: weightUnit,
        };

        if (weightTarget.trim()) {
          weightSettings.target_weight = parseFloat(weightTarget);
        }

        updateData.weight_settings = weightSettings;
      }

      // Add reward settings
      const rewardSettings: RewardSettings = {
        success_points: parseFloat(successPoints) || 10,
        penalty_points: parseFloat(penaltyPoints) || 5,
      };
      updateData.reward_settings = rewardSettings;

      const response = await HabitService.updateHabit(habit.id, updateData, token);

      if (response.data) {
        onUpdate(response.data);
        onClose();
      } else {
        console.error('Failed to update habit:', response.error);
        Alert.alert('Error', `Failed to update habit: ${response.error}`);
      }
    } catch (error) {
      console.error('Error updating habit:', error);
      Alert.alert('Error', 'Failed to update habit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </TouchableOpacity>

          <ThemedText style={styles.title}>Edit Habit</ThemedText>

          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveButton, { backgroundColor: tintColor }]}
            disabled={saving}
          >
            <ThemedText style={[styles.saveText, { color: backgroundColor }]}>
              {saving ? 'Saving...' : 'Save'}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.section}>
            <ThemedText style={styles.label}>Name *</ThemedText>
            <ThemedTextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter habit name"
              maxLength={100}
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.label}>Description</ThemedText>
            <ThemedTextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description"
              multiline
              numberOfLines={3}
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedView style={styles.switchRow}>
              <ThemedText style={styles.label}>Count-based habit</ThemedText>
              <Switch
                value={hasCount}
                onValueChange={value => {
                  setHasCount(value);
                  if (value) setIsWeight(false);
                }}
                trackColor={{ false: '#767577', true: tintColor }}
                thumbColor={hasCount ? backgroundColor : '#f4f3f4'}
              />
            </ThemedView>

            {hasCount && (
              <ThemedView style={styles.subsection}>
                <ThemedView style={styles.inputGroup}>
                  <ThemedText style={styles.sublabel}>Target (optional)</ThemedText>
                  <ThemedTextInput
                    style={styles.input}
                    value={countTarget}
                    onChangeText={setCountTarget}
                    placeholder="e.g., 50"
                    keyboardType="numeric"
                  />
                </ThemedView>

                <ThemedView style={styles.inputGroup}>
                  <ThemedText style={styles.sublabel}>Unit</ThemedText>
                  <ThemedTextInput
                    style={styles.input}
                    value={countUnit}
                    onChangeText={setCountUnit}
                    placeholder="e.g., pushups, glasses"
                  />
                </ThemedView>

                <ThemedView style={styles.inputGroup}>
                  <ThemedText style={styles.sublabel}>Step Size</ThemedText>
                  <ThemedTextInput
                    style={styles.input}
                    value={countStepSize}
                    onChangeText={setCountStepSize}
                    placeholder="1"
                    keyboardType="numeric"
                  />
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedView style={styles.switchRow}>
              <ThemedText style={styles.label}>Weight tracking habit</ThemedText>
              <Switch
                value={isWeight}
                onValueChange={value => {
                  setIsWeight(value);
                  if (value) setHasCount(false);
                }}
                trackColor={{ false: '#767577', true: tintColor }}
                thumbColor={isWeight ? backgroundColor : '#f4f3f4'}
              />
            </ThemedView>

            {isWeight && (
              <ThemedView style={styles.subsection}>
                <ThemedView style={styles.inputGroup}>
                  <ThemedText style={styles.sublabel}>Target Weight (optional)</ThemedText>
                  <ThemedTextInput
                    style={styles.input}
                    value={weightTarget}
                    onChangeText={setWeightTarget}
                    placeholder="e.g., 70"
                    keyboardType="numeric"
                  />
                </ThemedView>

                <ThemedView style={styles.switchRow}>
                  <ThemedText style={styles.sublabel}>Unit: kg</ThemedText>
                  <Switch
                    value={weightUnit === 'lbs'}
                    onValueChange={value => setWeightUnit(value ? 'lbs' : 'kg')}
                    trackColor={{ false: '#767577', true: tintColor }}
                    thumbColor={weightUnit === 'lbs' ? backgroundColor : '#f4f3f4'}
                  />
                  <ThemedText style={styles.sublabel}>lbs</ThemedText>
                </ThemedView>
              </ThemedView>
            )}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.label}>Rewards</ThemedText>

            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.sublabel}>Success Points</ThemedText>
              <ThemedTextInput
                style={styles.input}
                value={successPoints}
                onChangeText={setSuccessPoints}
                placeholder="10"
                keyboardType="numeric"
              />
            </ThemedView>

            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.sublabel}>Penalty Points</ThemedText>
              <ThemedTextInput
                style={styles.input}
                value={penaltyPoints}
                onChangeText={setPenaltyPoints}
                placeholder="5"
                keyboardType="numeric"
              />
            </ThemedView>
          </ThemedView>
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  subsection: {
    marginLeft: 16,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#ddd',
  },
  inputGroup: {
    marginBottom: 16,
  },
});
