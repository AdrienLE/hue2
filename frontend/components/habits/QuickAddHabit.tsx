import React, { useState, useRef } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { ThemedTextInput } from '../ThemedTextInput';
import { HabitService } from '@/lib/services/habitService';
import { useAuth } from '@/auth/AuthContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import type { HabitCreate } from '@/lib/types/habits';

interface QuickAddHabitProps {
  onHabitAdded?: () => void;
}

export function QuickAddHabit({ onHabitAdded }: QuickAddHabitProps) {
  const [habitName, setHabitName] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { token } = useAuth();
  const borderColor = useThemeColor({}, 'text');

  const handleSubmit = async () => {
    if (!token) {
      console.log('Error: You must be logged in to create habits');
      return;
    }

    if (!habitName.trim()) {
      return; // Just clear if empty
    }

    setCreating(true);
    try {
      // Create a simple habit with default settings
      const habitData: HabitCreate = {
        name: habitName.trim(),
        has_counts: false,
        is_weight: false,
        reward_settings: {
          success_points: 3,
          penalty_points: 2,
        },
        display_settings: {
          order: Date.now(), // Use timestamp for simple ordering
        },
      };

      const response = await HabitService.createHabit(habitData, token);

      if (response.data) {
        setHabitName('');
        onHabitAdded?.();
        // Keep focus on web platform after adding habit
        if (Platform.OS === 'web') {
          setTimeout(() => {
            inputRef.current?.focus();
          }, 100);
        }
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inputContainer}>
        <ThemedTextInput
          ref={inputRef}
          style={[styles.input, { borderColor: borderColor + '30' }]}
          value={habitName}
          onChangeText={setHabitName}
          placeholder="Add a new habit..."
          placeholderTextColor={borderColor + '60'}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
          editable={!creating}
          maxLength={100}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
});
