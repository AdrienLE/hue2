import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { HabitService } from '@/lib/services/habitService';
import { useAuth } from '@/auth/AuthContext';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import {
  DEFAULT_USER_SETTINGS,
  UserSettings,
  mergeUserSettingsUpdate,
  normalizeUserSettings,
} from '@/lib/userSettings';

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
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [totalRewards, setTotalRewards] = useState(0);
  const [rewardAnimations, setRewardAnimations] = useState<RewardAnimation[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const { token } = useAuth();
  const userSettingsRef = useRef<UserSettings>(DEFAULT_USER_SETTINGS);
  const totalRewardsRef = useRef(0);
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

          let normalizedSettings = normalizeUserSettings(settings);

          const shouldInitLastSession = !settings.last_session_date;
          if (shouldInitLastSession) {
            console.log('📅 No last_session_date found, initializing with current date');
            const { getLogicalDate } = await import('@/contexts/DevDateContext');
            const rolloverHour = settings.day_rollover_hour ?? 3;
            const todayLogical = getLogicalDate(rolloverHour);
            normalizedSettings = { ...normalizedSettings, last_session_date: todayLogical };
            console.log('📅 Initialized last_session_date to:', todayLogical);
          }

          userSettingsRef.current = normalizedSettings;
          totalRewardsRef.current = settings.total_rewards || 0;
          setUserSettings(normalizedSettings);
          setTotalRewards(totalRewardsRef.current);
          settingsLoadedRef.current = true;
          setSettingsLoaded(true);

          if (shouldInitLastSession) {
            await HabitService.updateCurrentUser({ settings: normalizedSettings }, token);
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

    const previous = userSettingsRef.current;
    const previousTotalRewards = totalRewardsRef.current;
    const settingsToSave = mergeUserSettingsUpdate(previous, newSettings);

    userSettingsRef.current = settingsToSave;
    setUserSettings(settingsToSave);

    // Optimistic update
    if (newSettings.total_rewards !== undefined) {
      totalRewardsRef.current = newSettings.total_rewards;
      setTotalRewards(newSettings.total_rewards);
    }

    try {
      const response = await HabitService.updateCurrentUser({ settings: newSettings }, token);
      if (!response.data) throw new Error(response.error || 'Failed to save settings');
    } catch (error) {
      console.error('Error updating user settings, reverting:', error);
      // Revert on error
      userSettingsRef.current = previous;
      setUserSettings(previous);
      if (newSettings.total_rewards !== undefined) {
        totalRewardsRef.current = previousTotalRewards;
        setTotalRewards(previousTotalRewards);
      }
      throw error;
    }
  };

  const addReward = async (amount: number) => {
    const previousTotal = totalRewardsRef.current;
    const newTotal = previousTotal + amount;
    // Optimistic update for immediate UI feedback
    totalRewardsRef.current = newTotal;
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
      if (!token) throw new Error('Not signed in');
      const response = await HabitService.adjustReward(amount, token);
      if (!response.data) throw new Error(response.error || 'Failed to add reward');
      totalRewardsRef.current = response.data.total_rewards;
      setTotalRewards(response.data.total_rewards);
      userSettingsRef.current = {
        ...userSettingsRef.current,
        total_rewards: response.data.total_rewards,
      };
      setUserSettings(userSettingsRef.current);
    } catch (error) {
      // Revert on error
      totalRewardsRef.current = previousTotal;
      setTotalRewards(previousTotal);
      throw error;
    }
  };

  const subtractReward = async (amount: number) => {
    const previousTotal = totalRewardsRef.current;
    const newTotal = previousTotal - amount;
    // Optimistic update for immediate UI feedback
    totalRewardsRef.current = newTotal;
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
      if (!token) throw new Error('Not signed in');
      const response = await HabitService.adjustReward(-amount, token);
      if (!response.data) throw new Error(response.error || 'Failed to subtract reward');
      totalRewardsRef.current = response.data.total_rewards;
      setTotalRewards(response.data.total_rewards);
      userSettingsRef.current = {
        ...userSettingsRef.current,
        total_rewards: response.data.total_rewards,
      };
      setUserSettings(userSettingsRef.current);
    } catch (error) {
      // Revert on error
      totalRewardsRef.current = previousTotal;
      setTotalRewards(previousTotal);
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
    userSettingsRef.current = DEFAULT_USER_SETTINGS;
    totalRewardsRef.current = 0;
    setTotalRewards(0);
    setRewardAnimations([]);
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
