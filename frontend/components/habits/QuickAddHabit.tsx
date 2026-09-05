import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
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
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const { token } = useAuth();
  const borderColor = useThemeColor({}, 'border');
  const surfaceColor = useThemeColor({}, 'surface');
  const mutedColor = useThemeColor({}, 'muted');
  const errorColor = useThemeColor({ light: '#b42318', dark: '#ffb4ab' }, 'text');
  const tintColor = useThemeColor({ light: '#176b87', dark: '#20cfe0' }, 'tint');
  const insets = useSafeAreaInsets();

  const handleSubmit = async () => {
    if (submitting.current) return;
    if (!token) {
      console.log('Error: You must be logged in to create habits');
      return;
    }

    if (!habitName.trim()) {
      return; // Just clear if empty
    }

    submitting.current = true;
    setCreating(true);
    setError(null);
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
        setError('Could not add your habit. Please try again.');
      }
    } catch (error) {
      console.error('Error creating habit:', error);
      setError('Could not add your habit. Please try again.');
    } finally {
      submitting.current = false;
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
          paddingBottom: Math.max(16, insets.bottom + 8),
        },
      ]}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.inputContainer, { borderColor, backgroundColor: surfaceColor }]}>
          <ThemedTextInput
            ref={inputRef}
            style={styles.input}
            value={habitName}
            onChangeText={setHabitName}
            placeholder="Add a new habit..."
            accessibilityLabel="New habit name"
            placeholderTextColor={mutedColor}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
            editable={!creating}
            maxLength={100}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add habit"
            accessibilityState={{ disabled: creating || !habitName.trim(), busy: creating }}
            disabled={creating || !habitName.trim()}
            onPress={handleSubmit}
            style={[
              styles.addIcon,
              { backgroundColor: tintColor, opacity: creating || !habitName.trim() ? 0.4 : 1 },
            ]}
          >
            {creating ? (
              <ActivityIndicator size="small" color={surfaceColor} />
            ) : (
              <ThemedText style={[styles.addIconText, { color: surfaceColor }]}>+</ThemedText>
            )}
          </Pressable>
        </View>
        {error && (
          <ThemedText accessibilityRole="alert" style={[styles.error, { color: errorColor }]}>
            {error}
          </ThemedText>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 10,
    flexShrink: 0,
  },
  inputContainer: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  addIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
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
    minWidth: 0,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 9,
    fontSize: 14,
    backgroundColor: 'transparent',
  },
  error: { fontSize: 12, lineHeight: 18, marginTop: 6 },
});
