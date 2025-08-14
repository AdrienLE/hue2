import React, { createContext, useContext, useState } from 'react';

interface HabitVisibilityContextType {
  showCheckedHabits: boolean;
  setShowCheckedHabits: (show: boolean) => void;
  toggleCheckedHabits: () => void;
}

const HabitVisibilityContext = createContext<HabitVisibilityContextType | undefined>(undefined);

export function HabitVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [showCheckedHabits, setShowCheckedHabits] = useState(false);

  const toggleCheckedHabits = () => {
    setShowCheckedHabits(!showCheckedHabits);
  };

  return (
    <HabitVisibilityContext.Provider value={{
      showCheckedHabits,
      setShowCheckedHabits,
      toggleCheckedHabits,
    }}>
      {children}
    </HabitVisibilityContext.Provider>
  );
}

export function useHabitVisibility() {
  const context = useContext(HabitVisibilityContext);
  if (context === undefined) {
    throw new Error('useHabitVisibility must be used within a HabitVisibilityProvider');
  }
  return context;
}