import React, { createContext, useContext, useState, useEffect } from 'react';
import { HabitService } from '@/lib/services/habitService';
import { useAuth } from '@/auth/AuthContext';

interface UserSettings {
  reward_unit?: string;
  reward_unit_position?: 'before' | 'after';
  total_rewards?: number;
  day_rollover_hour?: number; // Hour of day when habits roll over to next day (0-23, default 3)
}

interface UserContextType {
  userSettings: UserSettings;
  totalRewards: number;
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
  addReward: (amount: number) => Promise<void>;
  subtractReward: (amount: number) => Promise<void>;
  loadUserData: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userSettings, setUserSettings] = useState<UserSettings>({
    reward_unit: '$',
    reward_unit_position: 'before',
    total_rewards: 0,
    day_rollover_hour: 3,
  });
  const [totalRewards, setTotalRewards] = useState(0);
  const { token } = useAuth();

  const loadUserData = async () => {
    if (!token) return;
    
    try {
      const response = await HabitService.getCurrentUser(token);
      if (response.data && response.data.settings) {
        const settings = response.data.settings;
        setUserSettings({
          reward_unit: settings.reward_unit || '$',
          reward_unit_position: settings.reward_unit_position || 'before',
          total_rewards: settings.total_rewards || 0,
        });
        setTotalRewards(settings.total_rewards || 0);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const updateUserSettings = async (newSettings: Partial<UserSettings>) => {
    if (!token) return;

    try {
      const updatedSettings = { ...userSettings, ...newSettings };
      
      const response = await HabitService.updateCurrentUser({
        settings: updatedSettings
      }, token);

      if (response.data) {
        setUserSettings(updatedSettings);
        if (newSettings.total_rewards !== undefined) {
          setTotalRewards(newSettings.total_rewards);
        }
      }
    } catch (error) {
      console.error('Error updating user settings:', error);
    }
  };

  const addReward = async (amount: number) => {
    const newTotal = totalRewards + amount;
    await updateUserSettings({ total_rewards: newTotal });
  };

  const subtractReward = async (amount: number) => {
    const newTotal = Math.max(0, totalRewards - amount); // Don't go below 0
    await updateUserSettings({ total_rewards: newTotal });
  };

  useEffect(() => {
    loadUserData();
  }, [token]);

  return (
    <UserContext.Provider value={{
      userSettings,
      totalRewards,
      updateUserSettings,
      addReward,
      subtractReward,
      loadUserData,
    }}>
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