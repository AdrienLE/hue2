import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useAuth } from '@/auth/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { HabitService } from '@/lib/services/habitService';
import { getHabitColor } from '@/constants/Colors';
import { HabitCard } from './habits/HabitCard';
import type { Habit } from '@/lib/types/habits';

interface DailyReviewModalProps {
  visible: boolean;
  onClose: () => void;
  reviewDate: Date;
}

export function DailyReviewModal({ visible, onClose, reviewDate }: DailyReviewModalProps) {
  const handleClose = async () => {
    try {
      await clearPendingDailyReview();
      onClose();
    } catch (error) {
      console.error('Error clearing pending review:', error);
      onClose(); // Still close even if clearing fails
    }
  };
  const [originallyUncheckedHabits, setOriginallyUncheckedHabits] = useState<Habit[]>([]);
  const [currentlyCheckedHabits, setCurrentlyCheckedHabits] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [missedDays, setMissedDays] = useState<Date[]>([]);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [showSkippedDaysOptions, setShowSkippedDaysOptions] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const { token } = useAuth();
  const { subtractReward, clearPendingDailyReview } = useUser();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({ light: '#e1e5e9', dark: '#333' }, 'border');

  const loadUncheckedHabits = async () => {
    if (!token || !visible) return;

    setLoading(true);
    try {
      // Get all habits
      const habitsResponse = await HabitService.getHabits(token);
      if (!habitsResponse.data) {
        setOriginallyUncheckedHabits([]);
        return;
      }

      const reviewDateStr = reviewDate.toISOString().split('T')[0];
      console.log('DailyReview: Review date string:', reviewDateStr);

      // Get all types of activity data for the review date
      const [checksResponse, countsResponse, weightsResponse] = await Promise.all([
        HabitService.getChecks(token),
        HabitService.getCounts(token),
        HabitService.getWeightUpdates(token, {}),
      ]);

      console.log('DailyReview: All checks:', checksResponse.data);
      console.log('DailyReview: All counts:', countsResponse.data);
      console.log('DailyReview: All weights:', weightsResponse.data);

      // Get habit IDs that have been tracked for this date
      const trackedHabitIds = new Set();

      // Normal habits: checked in checks table
      (checksResponse.data || [])
        .filter(check => check.check_date.startsWith(reviewDateStr))
        .forEach(check => {
          console.log('DailyReview: Normal habit checked:', check.habit_id);
          trackedHabitIds.add(check.habit_id);
        });

      // Count habits: have count entries for the date
      (countsResponse.data || [])
        .filter(count => count.count_date.startsWith(reviewDateStr))
        .forEach(count => {
          console.log('DailyReview: Count habit tracked:', count.habit_id);
          trackedHabitIds.add(count.habit_id);
        });

      // Weight habits: have weight updates for the date
      (weightsResponse.data || [])
        .filter(weight => weight.update_date.startsWith(reviewDateStr))
        .forEach(weight => {
          console.log('DailyReview: Weight habit tracked:', weight.habit_id);
          trackedHabitIds.add(weight.habit_id);
        });

      console.log('DailyReview: All tracked habit IDs for date:', Array.from(trackedHabitIds));

      // Filter to ALL habits that weren't tracked
      const allHabits = habitsResponse.data;
      console.log(
        'DailyReview: All habits:',
        allHabits.map(h => ({
          id: h.id,
          name: h.name,
          type: h.has_counts ? 'count' : h.is_weight ? 'weight' : 'normal',
        }))
      );

      const unchecked = allHabits.filter(habit => !trackedHabitIds.has(habit.id));
      console.log(
        'DailyReview: Untracked habits:',
        unchecked.map(h => ({
          id: h.id,
          name: h.name,
          type: h.has_counts ? 'count' : h.is_weight ? 'weight' : 'normal',
        }))
      );

      setOriginallyUncheckedHabits(unchecked);
      setCurrentlyCheckedHabits(new Set()); // Reset checked status
      setShowCelebration(false);
    } catch (error) {
      console.error('Error loading unchecked habits:', error);
      setOriginallyUncheckedHabits([]);
    } finally {
      setLoading(false);
    }
  };

  const applyPenalties = async () => {
    if (!token || originallyUncheckedHabits.length === 0) return;

    setApplying(true);
    try {
      let totalPenalty = 0;

      for (const habit of originallyUncheckedHabits) {
        const penaltyPoints = habit.reward_settings?.penalty_points || 0;
        if (penaltyPoints > 0) {
          totalPenalty += penaltyPoints;
        }
      }

      if (totalPenalty > 0) {
        await subtractReward(totalPenalty);
        Alert.alert(
          'Penalties Applied',
          `Deducted ${totalPenalty} points for ${originallyUncheckedHabits.length} missed habits.`,
          [{ text: 'OK', onPress: handleClose }]
        );
      } else {
        Alert.alert('No Penalties', 'No penalty points were configured for these habits.', [
          { text: 'OK', onPress: handleClose },
        ]);
      }
    } catch (error) {
      console.error('Error applying penalties:', error);
      Alert.alert('Error', 'Failed to apply penalties');
    } finally {
      setApplying(false);
    }
  };

  useEffect(() => {
    if (visible) {
      // Reset state when modal opens
      setCurrentDayIndex(0);
      setShowSkippedDaysOptions(false);
      setCurrentlyCheckedHabits(new Set());
      setShowCelebration(false);
      loadUncheckedHabits();
    }
  }, [visible, reviewDate, token]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleHabitUpdate = (updatedHabit: Habit) => {
    // Mark habit as checked but keep it visible
    setCurrentlyCheckedHabits(prev => new Set([...prev, updatedHabit.id]));
    checkForCelebration();
  };

  const handleHabitChecked = (habitId: number) => {
    // Mark habit as checked but keep it visible
    setCurrentlyCheckedHabits(prev => new Set([...prev, habitId]));
    checkForCelebration();
  };

  const handleHabitUnchecked = (habitId: number) => {
    // Remove from checked set
    setCurrentlyCheckedHabits(prev => {
      const newSet = new Set(prev);
      newSet.delete(habitId);
      return newSet;
    });
    setShowCelebration(false);
  };

  const checkForCelebration = () => {
    // Check if all originally unchecked habits are now checked
    setTimeout(() => {
      setCurrentlyCheckedHabits(current => {
        const allCompleted = originallyUncheckedHabits.every(habit => current.has(habit.id));
        if (allCompleted && originallyUncheckedHabits.length > 0) {
          setShowCelebration(true);
        }
        return current;
      });
    }, 100);
  };

  const currentDate = missedDays[currentDayIndex] || reviewDate;
  const isLastDay = currentDayIndex === missedDays.length - 1;
  const hasMoreDays = missedDays.length > 1;
  const allHabitsCompleted = originallyUncheckedHabits.every(habit =>
    currentlyCheckedHabits.has(habit.id)
  );

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <ThemedView style={[styles.modal, { borderColor }]}>
          <ThemedText style={styles.title}>Daily Review</ThemedText>
          <ThemedText style={styles.subtitle}>{formatDate(currentDate)}</ThemedText>

          {hasMoreDays && (
            <View style={[styles.dayCounter, { backgroundColor: '#ff4444' }]}>
              <ThemedText style={[styles.dayCounterText, { color: 'white' }]}>
                Day {currentDayIndex + 1} of {missedDays.length} missed days
              </ThemedText>
            </View>
          )}

          {loading ? (
            <View style={styles.centerContent}>
              <ThemedText style={styles.loadingText}>Loading...</ThemedText>
            </View>
          ) : originallyUncheckedHabits.length === 0 ? (
            <View style={styles.centerContent}>
              <ThemedText style={styles.successText}>🎉 Perfect day!</ThemedText>
              <ThemedText style={styles.successSubtext}>All habits were completed</ThemedText>
            </View>
          ) : (
            <>
              {showCelebration && (
                <View style={[styles.celebrationBanner, { backgroundColor: tintColor }]}>
                  <ThemedText style={[styles.celebrationText, { color: backgroundColor }]}>
                    🎉 All habits completed! Great job! 🎉
                  </ThemedText>
                </View>
              )}

              <ThemedText style={styles.sectionTitle}>
                Complete These Habits ({originallyUncheckedHabits.length})
              </ThemedText>

              <ScrollView style={styles.habitsList} showsVerticalScrollIndicator={false}>
                {originallyUncheckedHabits.map(habit => {
                  const isChecked = currentlyCheckedHabits.has(habit.id);

                  return (
                    <HabitCard
                      key={habit.id}
                      habit={habit}
                      onUpdate={handleHabitUpdate}
                      onDelete={() => {}}
                      onChecked={handleHabitChecked}
                      onUnchecked={handleHabitUnchecked}
                      isCheckedToday={isChecked}
                    />
                  );
                })}
              </ScrollView>
            </>
          )}

          <View style={styles.buttonRow}>
            {originallyUncheckedHabits.length === 0 ? (
              <TouchableOpacity
                style={[styles.button, styles.fullButton, { backgroundColor: tintColor }]}
                onPress={handleClose}
              >
                <ThemedText style={[styles.buttonText, { color: backgroundColor }]}>
                  All Done! 🎉
                </ThemedText>
              </TouchableOpacity>
            ) : allHabitsCompleted && isLastDay ? (
              <TouchableOpacity
                style={[styles.button, styles.fullButton, { backgroundColor: tintColor }]}
                onPress={handleClose}
              >
                <ThemedText style={[styles.buttonText, { color: backgroundColor }]}>
                  Perfect! All Complete! 🎉
                </ThemedText>
              </TouchableOpacity>
            ) : allHabitsCompleted && !isLastDay ? (
              <TouchableOpacity
                style={[styles.button, styles.fullButton, { backgroundColor: tintColor }]}
                onPress={() => setCurrentDayIndex(prev => prev + 1)}
              >
                <ThemedText style={[styles.buttonText, { color: backgroundColor }]}>
                  Next Day →
                </ThemedText>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.skipButton, { borderColor }]}
                  onPress={() => setShowSkippedDaysOptions(true)}
                  disabled={applying}
                >
                  <ThemedText style={[styles.buttonText, { color: textColor }]}>
                    Apply Penalties
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.applyButton, { backgroundColor: '#666' }]}
                  onPress={handleClose}
                  disabled={applying}
                >
                  <ThemedText style={[styles.buttonText, { color: 'white' }]}>Close</ThemedText>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 20,
  },
  centerContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
  successText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 16,
    opacity: 0.7,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  habitsList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  habitInfo: {
    flex: 1,
  },
  habitName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  habitDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  penaltyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 12,
  },
  penaltyText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  totalPenalty: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    marginBottom: 20,
  },
  totalPenaltyText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#ff4444',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipButton: {
    borderWidth: 1,
  },
  applyButton: {
    // backgroundColor set dynamically
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dayCounter: {
    padding: 8,
    borderRadius: 6,
    marginBottom: 16,
    alignItems: 'center',
  },
  dayCounterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fullButton: {
    flex: 1,
  },
  celebrationBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  celebrationText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
