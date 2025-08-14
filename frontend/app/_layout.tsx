import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { HabitVisibilityProvider, useHabitVisibility } from '@/contexts/HabitVisibilityContext';
import { UserProvider } from '@/contexts/UserContext';
import { DevDateProvider, useDevDate } from '@/contexts/DevDateContext';
import { Colors } from '@/constants/Colors';
import { ThemedHeader } from '@/components/ThemedHeader';
import { DailyReviewModal } from '@/components/DailyReviewModal';

export default function RootLayout() {
  return (
    <AuthProvider>
      <UserProvider>
        <HabitVisibilityProvider>
          <DevDateProvider>
            <RootLayoutNav />
          </DevDateProvider>
        </HabitVisibilityProvider>
      </UserProvider>
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { token, loading } = useAuth();
  const { showCheckedHabits, toggleCheckedHabits } = useHabitVisibility();
  const { advanceDay, resetToToday } = useDevDate();
  const [showDailyReview, setShowDailyReview] = useState(false);
  const [reviewDate, setReviewDate] = useState(new Date());

  const handleAdvanceDay = () => {
    console.log('handleAdvanceDay called');
    advanceDay();
    // Show daily review for the previous day
    const previousDay = new Date();
    previousDay.setDate(previousDay.getDate() - 1);
    setReviewDate(previousDay);
    setShowDailyReview(true);
    console.log('Daily review should show:', { showDailyReview: true, reviewDate: previousDay });
  };

  const handleTriggerDailyReview = () => {
    console.log('handleTriggerDailyReview called');
    // Show daily review for today (not yesterday) to see current unchecked habits
    const today = new Date();
    setReviewDate(today);
    setShowDailyReview(true);
    console.log('Daily review should show:', { showDailyReview: true, reviewDate: today });
  };

  const handleResetDay = () => {
    console.log('handleResetDay called');
    resetToToday();
  };

  if (loading) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Head>
        <title>Hue - Habit Tracker</title>
        {/* Static favicon for production web */}
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          width: '100%',
          backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f5f5f5',
        }}
      >
        <View style={{ flex: 1, width: '100%', maxWidth: 800 }}>
          {token && (
            <ThemedHeader 
              title="Hue 2" 
              showCheckedHabits={showCheckedHabits}
              onToggleCheckedHabits={toggleCheckedHabits}
              onAdvanceDay={handleAdvanceDay}
              onTriggerDailyReview={handleTriggerDailyReview}
              onResetDay={handleResetDay}
            />
          )}
          <Stack screenOptions={{ headerShown: false }}>
            {token ? (
              <>
                <Stack.Screen name="index" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="+not-found" />
              </>
            ) : (
              <Stack.Screen name="login" />
            )}
          </Stack>
        </View>
      </View>
      
      {/* Global Daily Review Modal */}
      <DailyReviewModal
        visible={showDailyReview}
        onClose={() => setShowDailyReview(false)}
        reviewDate={reviewDate}
      />
      
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
