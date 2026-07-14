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
  const surface = useThemeColor({ light: '#f5f6f7', dark: '#0d0f12' }, 'background');
  const selected = useThemeColor({ light: '#e9edf0', dark: '#242930' }, 'background');
  const muted = useThemeColor({ light: '#69727d', dark: '#929aa5' }, 'text');
  const border = useThemeColor({ light: '#dfe3e8', dark: '#2d323a' }, 'border');

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.container, { backgroundColor: surface, borderColor: border }]}
    >
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
  container: { flexDirection: 'row', borderRadius: 8, borderWidth: 1, padding: 2, gap: 2 },
  tab: { flex: 1, minHeight: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 5 },
  label: { fontSize: 12, fontWeight: '700' },
});
