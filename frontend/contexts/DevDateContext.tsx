import React, { createContext, useContext, useState, ReactNode } from 'react';

import {
  getLogicalDate as computeLogicalDate,
  getLogicalDateRange as computeLogicalDateRange,
  getLogicalDateTimestamp as computeLogicalDateTimestamp,
  getLocalTimestamp as computeLocalTimestamp,
  getLogicalDayStartISO,
  getLogicalDayEndISO,
} from '@/lib/logicalTime';

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
      setGlobalCurrentDate(newDate);
      return newDate;
    });
  };

  const resetToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setGlobalCurrentDate(today);
    setCustomDateOverride(null);
  };

  const setDate = (date: Date) => {
    setCurrentDate(new Date(date));
    setGlobalCurrentDate(date);
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
let globalCurrentDate: Date | null = null;

export function setGlobalCustomDateOverride(date: Date | null) {
  globalCustomDateOverride = date;
}

function setGlobalCurrentDate(date: Date) {
  globalCurrentDate = new Date(date);
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

  return globalCurrentDate ? new Date(globalCurrentDate) : new Date();
}

// Helper function to get the "logical date" for habit tracking
// This considers the day rollover hour (e.g., 3am) instead of midnight
export function getLogicalDate(rolloverHour: number = 3, currentDate?: Date): string {
  return computeLogicalDate(rolloverHour, currentDate || getCurrentDate());
}

export function getLogicalDateRange(
  rolloverHour: number = 3,
  currentDate?: Date
): { startDate: string; endDate: string } {
  return computeLogicalDateRange(rolloverHour, currentDate || getCurrentDate());
}

export function getLogicalDateTimestamp(rolloverHour: number = 3, currentDate?: Date): string {
  return computeLogicalDateTimestamp(rolloverHour, currentDate || getCurrentDate());
}

export function getLocalTimestamp(date?: Date): string {
  return computeLocalTimestamp(date || getCurrentDate());
}

export { getLogicalDayStartISO, getLogicalDayEndISO };
