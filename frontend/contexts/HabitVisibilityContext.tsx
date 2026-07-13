import React, { createContext, useContext, useMemo, useState } from 'react';

export type HabitVisibilityMode = 'active' | 'done' | 'all';

interface HabitVisibilityContextType {
  mode: HabitVisibilityMode;
  setMode: (mode: HabitVisibilityMode) => void;
}

const HabitVisibilityContext = createContext<HabitVisibilityContextType | undefined>(undefined);

export function HabitVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<HabitVisibilityMode>('active');
  const value = useMemo(() => ({ mode, setMode }), [mode]);

  return (
    <HabitVisibilityContext.Provider value={value}>{children}</HabitVisibilityContext.Provider>
  );
}

export function useHabitVisibility() {
  const context = useContext(HabitVisibilityContext);
  if (context === undefined) {
    throw new Error('useHabitVisibility must be used within a HabitVisibilityProvider');
  }
  return context;
}
