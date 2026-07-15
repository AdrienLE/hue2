import React, { useState, useRef } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { ThemedTextInput } from '../ThemedTextInput';
import { ThemedText } from '../ThemedText';
import { HabitService } from '@/lib/services/habitService';
import { useAuth } from '@/auth/AuthContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import type { HabitCreate } from '@/lib/types/habits';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface QuickAddHabitProps {
  onHabitAdded?: () => void;
}

export function QuickAddHabit({ onHabitAdded }: QuickAddHabitProps) {
  const [habitName, setHabitName] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { token } = useAuth();
  const borderColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({ light: '#176b87', dark: '#20cfe0' }, 'tint');
  const insets = useSafeAreaInsets();

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
    <View
      style={[
        styles.container,
        {
          paddingLeft: Math.max(16, insets.left + 12),
          paddingRight: Math.max(16, insets.right + 12),
          paddingBottom: Math.max(32, insets.bottom + 8),
        },
      ]}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.inputContainer, { borderColor: borderColor + '30' }]}>
          <View style={[styles.addIcon, { borderColor: tintColor }]} pointerEvents="none">
            <ThemedText style={[styles.addIconText, { color: tintColor }]}>+</ThemedText>
          </View>
          <ThemedTextInput
            ref={inputRef}
            style={styles.input}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 5,
    flexShrink: 0,
  },
  inputContainer: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  addIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconText: {
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '500',
  },
  input: {
    flex: 1,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 9,
    fontSize: 14,
    backgroundColor: 'transparent',
  },
});
