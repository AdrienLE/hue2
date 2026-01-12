import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { HabitService } from '@/lib/services/habitService';
import { useAuth } from '@/auth/AuthContext';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';

interface UserSettings {
  reward_unit?: string;
  reward_unit_position?: 'before' | 'after';
  total_rewards?: number;
  day_rollover_hour?: number; // Hour of day when habits roll over to next day (0-23, default 3)
  color_brightness?: number; // 0-100, inverts in dark mode
  color_saturation?: number; // 0-100, how colorful vs gray
  color_frequency?: number; // Number of distinct hues before repeating (palette size)
  last_session_date?: string; // Last date the user was active (YYYY-MM-DD format)
  pending_daily_review?: {
    review_date: string;
    created_at: string;
  } | null; // Tracks if there's a pending daily review that needs completion
}

interface RewardAnimation {
  id: string;
  amount: number;
  timestamp: number;
}

interface UserContextType {
  userSettings: UserSettings;
  totalRewards: number;
  settingsLoaded: boolean;
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
  addReward: (amount: number) => Promise<void>;
  subtractReward: (amount: number) => Promise<void>;
  loadUserData: () => Promise<void>;
  rewardAnimations: RewardAnimation[];
  clearAnimation: (id: string) => void;
  setPendingDailyReview: (
    reviewData: { review_date: string; created_at: string } | null
  ) => Promise<void>;
  clearPendingDailyReview: () => Promise<void>;
  updateLastSessionDate: (date: string) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userSettings, setUserSettings] = useState<UserSettings>({
    reward_unit: '$',
    reward_unit_position: 'before',
    total_rewards: 0,
    day_rollover_hour: 3,
    color_brightness: 50, // Default 50% brightness
    color_saturation: 60, // Default 60% saturation for tame colors
    color_frequency: undefined, // Default: span all habits unless user specifies
  });
  const [totalRewards, setTotalRewards] = useState(0);
  const [rewardAnimations, setRewardAnimations] = useState<RewardAnimation[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const { token } = useAuth();
  const settingsLoadedRef = useRef(false);
  const loadUserDataPromiseRef = useRef<Promise<void> | null>(null);

  const loadUserData = async () => {
    if (!token) return;
    if (loadUserDataPromiseRef.current) {
      await loadUserDataPromiseRef.current;
      return;
    }

    const loadPromise = (async () => {
      try {
        const response = await HabitService.getCurrentUser(token);
        console.log('📅 loadUserData response:', JSON.stringify(response.data, null, 2));
        console.log('📅 response.data exists:', !!response.data);
        console.log(
          '📅 response.data.settings exists:',
          !!(response.data && response.data.settings)
        );
        if (response.data) {
          const settings = response.data.settings || {}; // Handle case where settings is null/undefined
          console.log('📅 User settings from server:', JSON.stringify(settings, null, 2));
          console.log(
            '📅 last_session_date value:',
            settings.last_session_date,
            'type:',
            typeof settings.last_session_date
          );

          let userSettings = {
            reward_unit: settings.reward_unit || '$',
            reward_unit_position: settings.reward_unit_position || 'before',
            total_rewards: settings.total_rewards || 0,
            day_rollover_hour: settings.day_rollover_hour ?? 3,
            color_brightness: settings.color_brightness ?? 50,
            color_saturation: settings.color_saturation ?? 60,
            color_frequency: settings.color_frequency, // optional, undefined means span all habits
            last_session_date: settings.last_session_date,
            pending_daily_review: settings.pending_daily_review || null,
          };

          const shouldInitLastSession = !settings.last_session_date;
          if (shouldInitLastSession) {
            console.log('📅 No last_session_date found, initializing with current date');
            const { getLogicalDate } = await import('@/contexts/DevDateContext');
            const rolloverHour = settings.day_rollover_hour ?? 3;
            const todayLogical = getLogicalDate(rolloverHour);
            userSettings = { ...userSettings, last_session_date: todayLogical };
            console.log('📅 Initialized last_session_date to:', todayLogical);
          }

          setUserSettings(userSettings);
          setTotalRewards(settings.total_rewards || 0);
          settingsLoadedRef.current = true;
          setSettingsLoaded(true);

          if (shouldInitLastSession) {
            await HabitService.updateCurrentUser({ settings: userSettings }, token);
          } else {
            console.log('📅 last_session_date already exists:', settings.last_session_date);
          }
        } else {
          console.log('📅 No user data found in response');
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    })();

    loadUserDataPromiseRef.current = loadPromise;
    try {
      await loadPromise;
    } finally {
      if (loadUserDataPromiseRef.current === loadPromise) {
        loadUserDataPromiseRef.current = null;
      }
    }
  };

  const updateUserSettings = async (newSettings: Partial<UserSettings>) => {
    if (!token) return;
    if (!settingsLoadedRef.current) {
      await loadUserData();
      if (!settingsLoadedRef.current) {
        console.warn('updateUserSettings: user settings not loaded; skipping update');
        return;
      }
    }

    let previous: UserSettings | null = null;
    let updatedSettings: UserSettings | null = null;

    setUserSettings(prev => {
      previous = prev;
      updatedSettings = { ...prev, ...newSettings };
      return updatedSettings;
    });

    // Optimistic update
    if (newSettings.total_rewards !== undefined) {
      setTotalRewards(newSettings.total_rewards);
    }

    try {
      const settingsToSave = updatedSettings ?? { ...userSettings, ...newSettings };
      const response = await HabitService.updateCurrentUser({ settings: settingsToSave }, token);

      // If backend failed silently, keep optimistic state but log
      if (!response.data) {
        console.warn('updateUserSettings: no data returned from server; keeping optimistic state');
      }
    } catch (error) {
      console.error('Error updating user settings, reverting:', error);
      // Revert on error
      if (previous) {
        setUserSettings(previous);
      }
      if (newSettings.total_rewards !== undefined) {
        setTotalRewards(previous?.total_rewards || 0);
      }
      throw error;
    }
  };

  const addReward = async (amount: number) => {
    const newTotal = totalRewards + amount;
    // Optimistic update for immediate UI feedback
    setTotalRewards(newTotal);

    // Add animation
    const animationId = `${Date.now()}-${Math.random()}`;
    const newAnimation: RewardAnimation = {
      id: animationId,
      amount,
      timestamp: Date.now(),
    };
    setRewardAnimations(prev => [...prev, newAnimation]);

    try {
      await updateUserSettings({ total_rewards: newTotal });
    } catch (error) {
      // Revert on error
      setTotalRewards(totalRewards);
      throw error;
    }
  };

  const subtractReward = async (amount: number) => {
    const newTotal = totalRewards - amount;
    // Optimistic update for immediate UI feedback
    setTotalRewards(newTotal);

    // Add animation (negative amount)
    const animationId = `${Date.now()}-${Math.random()}`;
    const newAnimation: RewardAnimation = {
      id: animationId,
      amount: -amount,
      timestamp: Date.now(),
    };
    setRewardAnimations(prev => [...prev, newAnimation]);

    try {
      await updateUserSettings({ total_rewards: newTotal });
    } catch (error) {
      // Revert on error
      setTotalRewards(totalRewards);
      throw error;
    }
  };

  const clearAnimation = (id: string) => {
    setRewardAnimations(prev => prev.filter(anim => anim.id !== id));
  };

  const setPendingDailyReview = async (
    reviewData: { review_date: string; created_at: string } | null
  ) => {
    await updateUserSettings({ pending_daily_review: reviewData });
  };

  const clearPendingDailyReview = async () => {
    await updateUserSettings({ pending_daily_review: null });
  };

  const updateLastSessionDate = async (date: string) => {
    console.log('📅 updateLastSessionDate called with:', date);
    await updateUserSettings({ last_session_date: date });
    console.log('📅 updateLastSessionDate completed for:', date);
  };

  useEffect(() => {
    settingsLoadedRef.current = false;
    setSettingsLoaded(false);
    loadUserData();
  }, [token]);

  // Keep user settings fresh across devices: refetch on focus and poll occasionally
  useRefetchOnFocus(
    () => {
      if (token) return loadUserData();
    },
    { enabled: !!token, intervalMs: 60000, focusThrottleMs: 1000 }
  );

  return (
    <UserContext.Provider
      value={{
        userSettings,
        totalRewards,
        settingsLoaded,
        updateUserSettings,
        addReward,
        subtractReward,
        loadUserData,
        rewardAnimations,
        clearAnimation,
        setPendingDailyReview,
        clearPendingDailyReview,
        updateLastSessionDate,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
