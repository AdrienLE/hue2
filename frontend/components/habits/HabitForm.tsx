import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { ThemedView } from '../ThemedView';
import { ThemedText } from '../ThemedText';
import { ThemedTextInput } from '../ThemedTextInput';
import { HabitService } from '@/lib/services/habitService';
import { useAuth } from '@/auth/AuthContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import type {
  HabitCreate,
  CountSettings,
  WeightSettings,
  RewardSettings,
} from '@/lib/types/habits';

interface HabitFormProps {
  onHabitCreated?: () => void;
}

export function HabitForm({ onHabitCreated }: HabitFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hasCount, setHasCount] = useState(false);
  const [isWeight, setIsWeight] = useState(false);
  const [creating, setCreating] = useState(false);

  // Count settings
  const [countTarget, setCountTarget] = useState('');
  const [countUnit, setCountUnit] = useState('');
  const [countStepSize, setCountStepSize] = useState('1');

  // Weight settings
  const [weightTarget, setWeightTarget] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');

  // Reward settings
  const [successPoints, setSuccessPoints] = useState('3');
  const [penaltyPoints, setPenaltyPoints] = useState('2');

  const { token } = useAuth();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');

  const resetForm = () => {
    setName('');
    setDescription('');
    setHasCount(false);
    setIsWeight(false);
    setCountTarget('');
    setCountUnit('');
    setCountStepSize('1');
    setWeightTarget('');
    setWeightUnit('kg');
    setSuccessPoints('10');
    setPenaltyPoints('5');
  };

  const handleCreate = async () => {
    if (!token) {
      console.log('Error: You must be logged in to create habits');
      return;
    }

    if (!name.trim()) {
      console.log('Error: Please enter a habit name');
      return;
    }

    if (hasCount && isWeight) {
      console.log('Error: A habit cannot be both count-based and weight-based');
      return;
    }

    setCreating(true);

    try {
      const habitData: HabitCreate = {
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

        habitData.count_settings = countSettings;
      }

      // Add weight settings if applicable
      if (isWeight) {
        const weightSettings: WeightSettings = {
          unit: weightUnit as 'kg' | 'lbs',
        };

        if (weightTarget.trim()) {
          weightSettings.target_weight = parseFloat(weightTarget);
        }

        habitData.weight_settings = weightSettings;
      }

      // Add reward settings
      const rewardSettings: RewardSettings = {
        success_points: parseFloat(successPoints) || 3,
        penalty_points: parseFloat(penaltyPoints) || 2,
      };
      habitData.reward_settings = rewardSettings;

      const response = await HabitService.createHabit(habitData, token);

      if (response.data) {
        console.log('Success: Habit created successfully!');
        resetForm();
        onHabitCreated?.();
      } else {
        console.error('Failed to create habit:', response.error);
      }
    } catch (error) {
      console.error('Error creating habit:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.form}>
        <ThemedText style={styles.title}>Create New Habit</ThemedText>

        <ThemedView style={styles.inputGroup}>
          <ThemedText style={styles.label}>Name *</ThemedText>
          <ThemedTextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter habit name"
            maxLength={100}
          />
        </ThemedView>

        <ThemedView style={styles.inputGroup}>
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

        <ThemedView style={styles.switchGroup}>
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
          <ThemedView style={styles.subSection}>
            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.label}>Target (optional)</ThemedText>
              <ThemedTextInput
                style={styles.input}
                value={countTarget}
                onChangeText={setCountTarget}
                placeholder="e.g., 50"
                keyboardType="numeric"
              />
            </ThemedView>

            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.label}>Unit</ThemedText>
              <ThemedTextInput
                style={styles.input}
                value={countUnit}
                onChangeText={setCountUnit}
                placeholder="e.g., pushups, glasses"
              />
            </ThemedView>

            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.label}>Step Size</ThemedText>
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

        <ThemedView style={styles.switchGroup}>
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
          <ThemedView style={styles.subSection}>
            <ThemedView style={styles.inputGroup}>
              <ThemedText style={styles.label}>Target Weight (optional)</ThemedText>
              <ThemedTextInput
                style={styles.input}
                value={weightTarget}
                onChangeText={setWeightTarget}
                placeholder="e.g., 70"
                keyboardType="numeric"
              />
            </ThemedView>

            <ThemedView style={styles.switchGroup}>
              <ThemedText style={styles.label}>Unit: kg</ThemedText>
              <Switch
                value={weightUnit === 'lbs'}
                onValueChange={value => setWeightUnit(value ? 'lbs' : 'kg')}
                trackColor={{ false: '#767577', true: tintColor }}
                thumbColor={weightUnit === 'lbs' ? backgroundColor : '#f4f3f4'}
              />
              <ThemedText style={styles.label}>lbs</ThemedText>
            </ThemedView>
          </ThemedView>
        )}

        <ThemedView style={styles.subSection}>
          <ThemedText style={styles.sectionTitle}>Rewards</ThemedText>

          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.label}>Success Points ($)</ThemedText>
            <ThemedTextInput
              style={styles.input}
              value={successPoints}
              onChangeText={setSuccessPoints}
              placeholder="3"
              keyboardType="numeric"
            />
          </ThemedView>

          <ThemedView style={styles.inputGroup}>
            <ThemedText style={styles.label}>Penalty Points ($)</ThemedText>
            <ThemedTextInput
              style={styles.input}
              value={penaltyPoints}
              onChangeText={setPenaltyPoints}
              placeholder="2"
              keyboardType="numeric"
            />
          </ThemedView>
        </ThemedView>

        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: tintColor }]}
          onPress={handleCreate}
          disabled={creating}
        >
          <ThemedText style={[styles.createButtonText, { color: backgroundColor }]}>
            {creating ? 'Creating...' : 'Create Habit'}
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
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
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  subSection: {
    marginLeft: 16,
    marginBottom: 16,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#ddd',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  createButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
