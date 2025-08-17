import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useState, useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { HabitVisibilityProvider, useHabitVisibility } from '@/contexts/HabitVisibilityContext';
import { UserProvider, useUser } from '@/contexts/UserContext';
import { DevDateProvider, useDevDate } from '@/contexts/DevDateContext';
import { Colors } from '@/constants/Colors';
import { ThemedHeader } from '@/components/ThemedHeader';
import { DailyReviewModal } from '@/components/DailyReviewModal';
import { getLogicalDate, getLogicalDateTimestamp } from '@/contexts/DevDateContext';

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
  const { userSettings, setPendingDailyReview, clearPendingDailyReview, updateLastSessionDate } =
    useUser();
  const { showCheckedHabits, toggleCheckedHabits } = useHabitVisibility();
  const { advanceDay, resetToToday } = useDevDate();
  const [showDailyReview, setShowDailyReview] = useState(false);
  const [reviewDate, setReviewDate] = useState(new Date());
  const [hasCheckedToday, setHasCheckedToday] = useState(false);

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

  // Check for automatic daily review on app load/focus
  useEffect(() => {
    if (!token || !userSettings) return;

    const checkForDailyReview = async () => {
      try {
        const rolloverHour = userSettings.day_rollover_hour || 3;
        const today = getLogicalDate(rolloverHour);
        const lastActiveDate = userSettings.last_session_date;
        const pendingDailyReview = userSettings.pending_daily_review;

        console.log('Daily review check:', {
          today,
          lastActiveDate,
          rolloverHour,
          pendingDailyReview,
        });

        // Check if there's a pending daily review that hasn't been completed
        if (pendingDailyReview) {
          setReviewDate(new Date(pendingDailyReview.review_date));
          setShowDailyReview(true);
          console.log('Restoring pending daily review for:', pendingDailyReview.review_date);
          return;
        }

        if (lastActiveDate && lastActiveDate !== today) {
          // User was last active on a different day
          const lastDate = new Date(lastActiveDate + 'T00:00:00');
          const currentDate = new Date(today + 'T00:00:00');
          const daysDiff = Math.floor(
            (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          console.log('Days since last active:', daysDiff);

          if (daysDiff >= 1) {
            // Show daily review for the most recent missed day
            const reviewDay = new Date(currentDate);
            reviewDay.setDate(reviewDay.getDate() - 1);
            setReviewDate(reviewDay);
            setShowDailyReview(true);

            // Store pending review on server to persist across devices/reloads
            await setPendingDailyReview({
              review_date: reviewDay.toISOString(),
              created_at: new Date().toISOString(),
            });

            console.log('Showing automatic daily review for:', reviewDay);
          }
        }

        // Update last active date on server
        await updateLastSessionDate(today);
        setHasCheckedToday(true);
      } catch (error) {
        console.error('Error checking for daily review:', error);
      }
    };

    // Only check once per app session and when user settings are loaded
    if (!hasCheckedToday) {
      checkForDailyReview();
    }
  }, [token, userSettings, hasCheckedToday]);

  // Also check when the app comes back to foreground
  useEffect(() => {
    if (!token || !userSettings) return;

    const handleAppStateChange = async () => {
      try {
        const rolloverHour = userSettings.day_rollover_hour || 3;
        const today = getLogicalDate(rolloverHour);
        const lastActiveDate = userSettings.last_session_date;

        if (lastActiveDate && lastActiveDate !== today) {
          // Day has changed while app was in background
          const lastDate = new Date(lastActiveDate + 'T00:00:00');
          const currentDate = new Date(today + 'T00:00:00');
          const daysDiff = Math.floor(
            (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysDiff >= 1 && !showDailyReview) {
            const reviewDay = new Date(currentDate);
            reviewDay.setDate(reviewDay.getDate() - 1);
            setReviewDate(reviewDay);
            setShowDailyReview(true);

            // Store pending review on server to persist across devices/reloads
            await setPendingDailyReview({
              review_date: reviewDay.toISOString(),
              created_at: new Date().toISOString(),
            });
          }

          await updateLastSessionDate(today);
        }
      } catch (error) {
        console.error('Error checking app state change:', error);
      }
    };

    // Check every minute for day changes (lightweight check)
    const interval = setInterval(handleAppStateChange, 60000);
    return () => clearInterval(interval);
  }, [token, userSettings, showDailyReview]);

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
