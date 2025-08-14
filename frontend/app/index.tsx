import { StyleSheet } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { HabitList } from '@/components/habits/HabitList';
import { useAuth } from '@/auth/AuthContext';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function HomeScreen() {
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      router.replace('/login');
    }
  }, [token]);

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
