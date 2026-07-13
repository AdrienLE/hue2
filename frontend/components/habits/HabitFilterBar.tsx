import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import type { HabitVisibilityMode } from '@/contexts/HabitVisibilityContext';

const FILTERS: Array<{ key: HabitVisibilityMode; label: string }> = [
  { key: 'active', label: 'Active' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
];

interface HabitFilterBarProps {
  mode: HabitVisibilityMode;
  onChange: (mode: HabitVisibilityMode) => void;
}

export function HabitFilterBar({ mode, onChange }: HabitFilterBarProps) {
  const surface = useThemeColor({ light: '#e8ebee', dark: '#171a1f' }, 'background');
  const selected = useThemeColor({ light: '#ffffff', dark: '#2b3038' }, 'background');
  const muted = useThemeColor({ light: '#69727d', dark: '#929aa5' }, 'text');

  return (
    <View accessibilityRole="tablist" style={[styles.container, { backgroundColor: surface }]}>
      {FILTERS.map(filter => {
        const isSelected = filter.key === mode;
        return (
          <TouchableOpacity
            key={filter.key}
            accessibilityRole={Platform.OS === 'web' ? 'tab' : 'button'}
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Show ${filter.label.toLowerCase()} habits`}
            style={[styles.tab, isSelected && { backgroundColor: selected }]}
            onPress={() => onChange(filter.key)}
          >
            <ThemedText style={[styles.label, !isSelected && { color: muted }]}>
              {filter.label}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderRadius: 11, padding: 3, gap: 2 },
  tab: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  label: { fontSize: 13, fontWeight: '700' },
});
