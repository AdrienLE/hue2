import React from 'react';
import { StyleSheet } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { HabitList } from '@/components/habits/HabitList';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <HabitList />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
