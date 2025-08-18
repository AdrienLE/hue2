import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DevDateContextType {
  currentDate: Date;
  customDateOverride: Date | null;
  advanceDay: () => void;
  resetToToday: () => void;
  setDate: (date: Date) => void;
  setCustomDateOverride: (date: Date | null) => void;
  isUsingCustomDate: boolean;
}

const DevDateContext = createContext<DevDateContextType | undefined>(undefined);

interface DevDateProviderProps {
  children: ReactNode;
}

export function DevDateProvider({ children }: DevDateProviderProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [customDateOverrideState, setCustomDateOverrideState] = useState<Date | null>(null);

  const setCustomDateOverride = (date: Date | null) => {
    setCustomDateOverrideState(date);
    setGlobalCustomDateOverride(date);
  };

  const advanceDay = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 1);
      return newDate;
    });
  };

  const resetToToday = () => {
    setCurrentDate(new Date());
    setCustomDateOverride(null);
  };

  const setDate = (date: Date) => {
    setCurrentDate(new Date(date));
  };

  return (
    <DevDateContext.Provider
      value={{
        currentDate,
        customDateOverride: customDateOverrideState,
        advanceDay,
        resetToToday,
        setDate,
        setCustomDateOverride,
        isUsingCustomDate: customDateOverrideState !== null,
      }}
    >
      {children}
    </DevDateContext.Provider>
  );
}

export function useDevDate() {
  const context = useContext(DevDateContext);
  if (context === undefined) {
    throw new Error('useDevDate must be used within a DevDateProvider');
  }
  return context;
}

// Store for custom date override outside of React context
// This allows getCurrentDate to work outside of React components
let globalCustomDateOverride: Date | null = null;

export function setGlobalCustomDateOverride(date: Date | null) {
  globalCustomDateOverride = date;
}

// Helper function to get the current date (either real or simulated)
export function getCurrentDate(): Date {
  // First check if there's a custom date override
  if (globalCustomDateOverride) {
    return new Date(globalCustomDateOverride);
  }

  // In production, always return real date (unless dev tools are force enabled)
  const isDevelopment =
    process.env.NODE_ENV !== 'production' || process.env.EXPO_PUBLIC_FORCE_DEV_TOOLS === 'true';
  if (!isDevelopment) {
    return new Date();
  }

  // In development, try to use the dev date context if available
  try {
    const { customDateOverride, currentDate } = useDevDate();
    return customDateOverride || currentDate;
  } catch {
    // Fallback to real date if context is not available
    return new Date();
  }
}

// Helper function to get the "logical date" for habit tracking
// This considers the day rollover hour (e.g., 3am) instead of midnight
export function getLogicalDate(rolloverHour: number = 3, currentDate?: Date): string {
  const now = currentDate || getCurrentDate();

  // If it's before the rollover hour, use the previous day
  const adjustedDate = new Date(now);
  if (adjustedDate.getHours() < rolloverHour) {
    adjustedDate.setDate(adjustedDate.getDate() - 1);
  }

  // Use local date methods to avoid timezone issues
  const year = adjustedDate.getFullYear();
  const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
  const day = String(adjustedDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// Helper function to get date range for API calls
export function getLogicalDateRange(
  rolloverHour: number = 3,
  currentDate?: Date
): { startDate: string; endDate: string } {
  const now = currentDate || getCurrentDate();
  const logicalDate = getLogicalDate(rolloverHour, now);

  // Create start and end times for the logical day
  const startDate = new Date(logicalDate + 'T00:00:00.000Z');
  startDate.setHours(startDate.getHours() + rolloverHour); // Add rollover hour

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  endDate.setSeconds(endDate.getSeconds() - 1); // End at 2:59:59

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

// Helper function to create a timestamp for the logical date
// This ensures the timestamp aligns with the logical date used for filtering
export function getLogicalDateTimestamp(rolloverHour: number = 3, currentDate?: Date): string {
  const now = currentDate || getCurrentDate();
  const logicalDate = getLogicalDate(rolloverHour, now);

  // Create timestamp using logical date but current time
  // This ensures the date part matches what getLogicalDate() returns
  const timestamp = new Date(now);
  const logicalDateObj = new Date(logicalDate + 'T00:00:00.000');

  // Set the date part to match the logical date, keep the time part from now
  timestamp.setFullYear(logicalDateObj.getFullYear());
  timestamp.setMonth(logicalDateObj.getMonth());
  timestamp.setDate(logicalDateObj.getDate());

  // Return local time instead of UTC - server should store what client sends
  // Format: YYYY-MM-DDTHH:mm:ss.sss (no timezone suffix)
  const year = timestamp.getFullYear();
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getDate()).padStart(2, '0');
  const hours = String(timestamp.getHours()).padStart(2, '0');
  const minutes = String(timestamp.getMinutes()).padStart(2, '0');
  const seconds = String(timestamp.getSeconds()).padStart(2, '0');
  const milliseconds = String(timestamp.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
}

// Helper function to get current local timestamp (no timezone conversion)
export function getLocalTimestamp(date?: Date): string {
  const timestamp = date || getCurrentDate();

  const year = timestamp.getFullYear();
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getDate()).padStart(2, '0');
  const hours = String(timestamp.getHours()).padStart(2, '0');
  const minutes = String(timestamp.getMinutes()).padStart(2, '0');
  const seconds = String(timestamp.getSeconds()).padStart(2, '0');
  const milliseconds = String(timestamp.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
}
