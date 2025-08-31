import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { View, Platform, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback } from 'react';
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
  const isCheckingRef = useRef(false);

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

  // Unified daily review check reused by mount/focus/interval
  const checkForDailyReview = useCallback(
    async (source: string = 'manual') => {
      if (!token || !userSettings) return;
      if (showDailyReview) {
        console.log(`⏭️ ${source} check - Skipping (daily review modal open)`);
        return;
      }
      if (isCheckingRef.current) {
        console.log(`⏭️ ${source} check - Already checking`);
        return;
      }

      isCheckingRef.current = true;
      try {
        const rolloverHour = userSettings.day_rollover_hour || 3;
        const today = getLogicalDate(rolloverHour);
        const lastActiveDate = userSettings.last_session_date;
        const pendingDailyReview = userSettings.pending_daily_review;

        console.log(`${source} daily review check:`, {
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

        // If there's a pending daily review that hasn't been completed, restore it
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
      } catch (error) {
        console.error('Error checking for daily review:', error);
      } finally {
        isCheckingRef.current = false;
      }
    },
    [token, userSettings, showDailyReview, setPendingDailyReview, updateLastSessionDate]
  );

  // Check immediately on mount when user + settings are ready
  useEffect(() => {
    if (!token || !userSettings) return;
    console.log('🔍 Daily review initial check');
    checkForDailyReview('mount');
  }, [token, userSettings, checkForDailyReview]);

  // Check on a short interval as a fallback
  useEffect(() => {
    if (!token || !userSettings) return;
    const interval = setInterval(() => checkForDailyReview('interval'), 5000);
    return () => clearInterval(interval);
  }, [token, userSettings, checkForDailyReview]);

  // Also check when app/page gains focus (RN + web)
  useEffect(() => {
    if (!token || !userSettings) return;

    const onAppStateChange = (state: string) => {
      if (state === 'active') {
        checkForDailyReview('appstate');
      }
    };

    const sub = AppState.addEventListener('change', onAppStateChange);

    let webFocusHandler: (() => void) | null = null;
    let visibilityHandler: (() => void) | null = null;

    if (Platform.OS === 'web') {
      webFocusHandler = () => checkForDailyReview('window-focus');
      visibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          checkForDailyReview('visibility');
        }
      };
      window.addEventListener('focus', webFocusHandler);
      document.addEventListener('visibilitychange', visibilityHandler);
    }

    return () => {
      sub.remove();
      if (Platform.OS === 'web') {
        if (webFocusHandler) window.removeEventListener('focus', webFocusHandler);
        if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
      }
    };
  }, [token, userSettings, checkForDailyReview]);

  if (loading) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Head>
        <title>Hue - Habit Tracker</title>
        {/* High-res favicons for production web */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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
