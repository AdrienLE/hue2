import { StyleSheet } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { HabitForm } from '@/components/habits/HabitForm';

export default function ExploreScreen() {
  return (
    <ThemedView style={styles.container}>
      <HabitForm />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
