import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { View, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { getLogicalDate, getLogicalDateTimestamp, getCurrentDate } from '@/contexts/DevDateContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UserProvider>
          <HabitVisibilityProvider>
            <DevDateProvider>
              <RootLayoutNav />
            </DevDateProvider>
          </HabitVisibilityProvider>
        </UserProvider>
      </AuthProvider>
    </SafeAreaProvider>
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
  const [reviewDate, setReviewDate] = useState(getCurrentDate());
  const [hasCheckedToday, setHasCheckedToday] = useState(false);

  const handleAdvanceDay = async () => {
    console.log('handleAdvanceDay called');

    // Get the current logical date before advancing
    const rolloverHour = userSettings?.day_rollover_hour || 3;
    const currentLogicalDate = getLogicalDate(rolloverHour);

    // Advance the day
    advanceDay();

    // Show daily review immediately (same logic as 5-second interval)
    const lastActiveDate = userSettings?.last_session_date;
    if (lastActiveDate) {
      // Show daily review for the LAST ACTIVE DATE
      const reviewDay = new Date(lastActiveDate + 'T00:00:00');
      setReviewDate(reviewDay);
      setShowDailyReview(true);
      console.log('🚀 Manual advance - Showing daily review for:', reviewDay);
    } else {
      console.log('🚀 Manual advance - No lastActiveDate, skipping daily review');
    }

    // Update last session date to the logical date we just "completed"
    // This ensures the next advance will show the correct review date
    try {
      await updateLastSessionDate(currentLogicalDate);
      console.log('Updated last session date to:', currentLogicalDate);
    } catch (error) {
      console.error('Error updating last session date:', error);
    }
  };

  const handleTriggerDailyReview = () => {
    console.log('handleTriggerDailyReview called');
    // Show daily review for today (not yesterday) to see current unchecked habits
    const today = getCurrentDate();
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
        console.log(
          '📅 Current dates - today (logical):',
          today,
          'getCurrentDate():',
          getCurrentDate(),
          'real Date():',
          new Date()
        );

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
            // Show daily review for the LAST ACTIVE DATE (not yesterday)
            const reviewDay = new Date(lastActiveDate + 'T00:00:00');
            setReviewDate(reviewDay);
            setShowDailyReview(true);

            // Store pending review on server to persist across devices/reloads
            await setPendingDailyReview({
              review_date: reviewDay.toISOString(),
              created_at: getCurrentDate().toISOString(),
            });

            console.log(
              'Showing automatic daily review for LAST ACTIVE DATE:',
              reviewDay,
              'lastActiveDate was:',
              lastActiveDate
            );
          }
        } else if (lastActiveDate) {
          console.log('🟢 Same day detected - No daily review needed:', {
            lastActiveDate,
            today,
            match: lastActiveDate === today,
          });
        } else {
          console.log('🔵 No lastActiveDate found - should be initialized by UserContext');
        }

        // Only update last active date if we already have one (to avoid the race condition)
        if (lastActiveDate) {
          await updateLastSessionDate(today);
        }
        setHasCheckedToday(true);
      } catch (error) {
        console.error('Error checking for daily review:', error);
      }
    };

    // Only check once per app session and when user settings are loaded
    console.log('🔍 Daily review useEffect triggered:', {
      token: !!token,
      userSettings: !!userSettings,
      hasCheckedToday,
    });
    if (!hasCheckedToday) {
      console.log('🚀 Running checkForDailyReview...');
      checkForDailyReview();
    } else {
      console.log('⏭️ Skipping checkForDailyReview (already checked today)');
    }
  }, [token, userSettings, hasCheckedToday]);

  // Also check when the app comes back to foreground
  useEffect(() => {
    if (!token || !userSettings) return;

    const handleAppStateChange = async () => {
      // Don't run checks while daily review modal is shown
      if (showDailyReview) {
        console.log('⏰ 5sec check - Skipping (daily review modal is open)');
        return;
      }

      try {
        const rolloverHour = userSettings.day_rollover_hour || 3;
        const today = getLogicalDate(rolloverHour);
        const lastActiveDate = userSettings.last_session_date;

        console.log('⏰ 5sec check - userSettings:', {
          last_session_date: userSettings.last_session_date,
          day_rollover_hour: userSettings.day_rollover_hour,
          total_rewards: userSettings.total_rewards,
          hasLastSessionDate: !!userSettings.last_session_date,
          today,
        });

        if (lastActiveDate && lastActiveDate !== today) {
          // Day has changed while app was in background
          const lastDate = new Date(lastActiveDate + 'T00:00:00');
          const currentDate = new Date(today + 'T00:00:00');
          const daysDiff = Math.floor(
            (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          console.log('⏰ 5sec check - Different day detected:', {
            lastActiveDate,
            today,
            daysDiff,
          });

          if (daysDiff >= 1 && !showDailyReview) {
            // Show daily review for the LAST ACTIVE DATE (not yesterday)
            const reviewDay = new Date(lastActiveDate + 'T00:00:00');
            setReviewDate(reviewDay);
            setShowDailyReview(true);

            console.log('⏰ 5sec check - Showing daily review for:', reviewDay);

            // Store pending review on server to persist across devices/reloads
            await setPendingDailyReview({
              review_date: reviewDay.toISOString(),
              created_at: getCurrentDate().toISOString(),
            });
          }

          await updateLastSessionDate(today);
        } else if (lastActiveDate) {
          console.log('⏰ 5sec check - Same day:', { lastActiveDate, today });
        } else {
          console.log('⏰ 5sec check - No lastActiveDate found');
        }
      } catch (error) {
        console.error('Error checking app state change:', error);
      }
    };

    // Check every 5 seconds for day changes (lightweight check)
    const interval = setInterval(handleAppStateChange, 5000);
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
          <Stack
            screenOptions={{
              headerShown: false,
              headerTitle: '',
              headerStyle: { display: 'none' },
              contentStyle: Platform.OS === 'web' ? { marginTop: 0 } : undefined,
            }}
          >
            {token ? (
              <>
                <Stack.Screen
                  name="index"
                  options={{
                    headerShown: false,
                    title: '',
                    headerTitle: '',
                  }}
                />
                <Stack.Screen
                  name="settings"
                  options={{
                    headerShown: false,
                    title: 'Settings',
                    headerTitle: '',
                  }}
                />
                <Stack.Screen
                  name="+not-found"
                  options={{
                    headerShown: false,
                    title: 'Not Found',
                    headerTitle: '',
                  }}
                />
              </>
            ) : (
              <Stack.Screen
                name="login"
                options={{
                  headerShown: false,
                  title: 'Login',
                  headerTitle: '',
                }}
              />
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
