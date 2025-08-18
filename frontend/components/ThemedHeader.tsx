import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  Platform,
  Button,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
let DateTimePicker: any;
let ReactDatePicker: any;
try {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
} catch (e) {
  // DateTimePicker not available on web
  DateTimePicker = null;
}
if (Platform.OS === 'web') {
  try {
    ReactDatePicker = require('react-datepicker').default;
    require('react-datepicker/dist/react-datepicker.css');
  } catch (e) {
    ReactDatePicker = null;
  }
}
import { ThemedText } from './ThemedText';
import { ProfileMenu } from './ProfileMenu';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useUser } from '@/contexts/UserContext';
import { useDevDate } from '@/contexts/DevDateContext';
import { HueColors } from '@/constants/Colors';
import { DevTools } from './DevTools';
import { RewardAnimation } from './ui/RewardAnimation';

interface ThemedHeaderProps {
  title: string;
  showIcon?: boolean;
  showCheckedHabits: boolean;
  onToggleCheckedHabits: () => void;
  onAdvanceDay?: () => void;
  onTriggerDailyReview?: () => void;
  onResetDay?: () => void;
}

export function ThemedHeader({
  title,
  showIcon = true,
  showCheckedHabits,
  onToggleCheckedHabits,
  onAdvanceDay,
  onTriggerDailyReview,
  onResetDay,
}: ThemedHeaderProps) {
  const [showDevTools, setShowDevTools] = useState(false);
  const [showSpendInput, setShowSpendInput] = useState(false);
  const [spendAmount, setSpendAmount] = useState('');
  const [spending, setSpending] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempCustomDate, setTempCustomDate] = useState<Date | null>(null);
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({ light: '#e1e5e9', dark: '#333' }, 'border');
  const { userSettings, totalRewards, subtractReward, rewardAnimations, clearAnimation } =
    useUser();
  const { customDateOverride, setCustomDateOverride, isUsingCustomDate } = useDevDate();

  const formatReward = (amount: number) => {
    const unit = userSettings.reward_unit || '$';
    const position = userSettings.reward_unit_position || 'before';
    const formatted = amount.toFixed(2);
    return position === 'before' ? `${unit}${formatted}` : `${formatted}${unit}`;
  };

  const handleSpend = async () => {
    const amount = parseFloat(spendAmount);
    if (isNaN(amount) || amount <= 0) {
      console.log('Invalid Amount: Please enter a valid positive amount to spend.');
      return;
    }

    setSpending(true);
    try {
      await subtractReward(amount);
      setSpendAmount('');
      setShowSpendInput(false);
      console.log(`Success: Spent ${formatReward(amount)}!`);
    } catch (error) {
      console.error('Error spending reward:', error);
    } finally {
      setSpending(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor, borderBottomColor: borderColor, paddingTop: insets.top + 8 },
      ]}
    >
      <View style={styles.leftSection}>
        {showIcon && (
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.icon}
            resizeMode="contain"
          />
        )}
        <Image
          source={require('@/assets/images/maybe_text.png')}
          style={styles.titleImage}
          resizeMode="contain"
        />
      </View>

      <View style={styles.rightSection}>
        <View style={styles.rewardContainer}>
          <TouchableOpacity
            style={[styles.rewardDisplay, { borderColor: tintColor }]}
            onPress={() => {
              console.log('Reward clicked, current showSpendInput:', showSpendInput);
              setShowSpendInput(!showSpendInput);
            }}
          >
            <ThemedText style={[styles.rewardText, { color: tintColor }]}>
              {formatReward(totalRewards)}
            </ThemedText>
          </TouchableOpacity>

          {/* Reward Animations */}
          {rewardAnimations.map(animation => (
            <RewardAnimation
              key={animation.id}
              amount={animation.amount}
              isVisible={true}
              onComplete={() => clearAnimation(animation.id)}
              position="right"
            />
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.visibilityButton,
            {
              backgroundColor: showCheckedHabits ? tintColor : 'transparent',
              borderColor: tintColor,
            },
          ]}
          onPress={onToggleCheckedHabits}
        >
          <ThemedText
            style={[
              styles.visibilityButtonText,
              {
                color: showCheckedHabits ? backgroundColor : tintColor,
              },
            ]}
          >
            {showCheckedHabits ? '◉' : '◯'}
          </ThemedText>
        </TouchableOpacity>

        <ProfileMenu />

        {/* Dev mode button */}
        {(process.env.NODE_ENV !== 'production' ||
          process.env.EXPO_PUBLIC_FORCE_DEV_TOOLS === 'true') &&
          onAdvanceDay && (
            <TouchableOpacity
              style={[styles.devIndicator, { backgroundColor: '#ff0000' }]}
              onPress={() => setShowDevTools(true)}
            >
              <ThemedText style={[styles.devIndicatorText, { color: 'white' }]}>DEV</ThemedText>
            </TouchableOpacity>
          )}
      </View>

      {/* Spending Modal */}
      <Modal
        visible={showSpendInput}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowSpendInput(false);
          setSpendAmount('');
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowSpendInput(false);
            setSpendAmount('');
          }}
        >
          <View style={[styles.spendModalContent, { backgroundColor, borderColor }]}>
            <ThemedText style={[styles.spendModalTitle, { color: textColor }]}>
              Spend Rewards
            </ThemedText>
            <ThemedText style={[styles.spendModalSubtitle, { color: textColor }]}>
              Current balance: {formatReward(totalRewards)}
            </ThemedText>

            <TextInput
              style={[styles.spendInput, { color: textColor, borderColor }]}
              value={spendAmount}
              onChangeText={setSpendAmount}
              placeholder="Amount to spend"
              placeholderTextColor={textColor + '60'}
              keyboardType="numeric"
              autoFocus
            />

            <View style={styles.spendButtons}>
              <TouchableOpacity
                style={[styles.spendButton, styles.cancelSpendButton, { borderColor }]}
                onPress={() => {
                  setShowSpendInput(false);
                  setSpendAmount('');
                }}
              >
                <ThemedText style={[styles.spendButtonText, { color: textColor }]}>
                  Cancel
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.spendButton,
                  styles.confirmSpendButton,
                  { backgroundColor: tintColor },
                ]}
                onPress={handleSpend}
                disabled={spending}
              >
                <ThemedText style={[styles.spendButtonText, { color: backgroundColor }]}>
                  {spending ? 'Spending...' : 'Spend'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Dev Tools Modal */}
      {showDevTools && (
        <Modal
          visible={showDevTools}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDevTools(false)}
        >
          <Pressable
            style={styles.overlay}
            onPress={e => {
              if (e.target === e.currentTarget) {
                setShowDevTools(false);
              }
            }}
          >
            <View style={[styles.modal, { backgroundColor, borderColor }]}>
              <ThemedText style={[styles.modalTitle, { color: textColor }]}>Dev Tools</ThemedText>

              {/* Current Date/Time Display */}
              <View style={styles.dateSection}>
                <ThemedText style={[styles.dateSectionTitle, { color: textColor }]}>
                  Custom Date/Time Override
                </ThemedText>
                {isUsingCustomDate && customDateOverride ? (
                  <View>
                    <ThemedText style={[styles.currentDate, { color: tintColor }]}>
                      {customDateOverride.toLocaleDateString()}{' '}
                      {customDateOverride.toLocaleTimeString()}
                    </ThemedText>
                    <TouchableOpacity
                      style={[styles.devButton, { backgroundColor: '#ff6b6b', marginTop: 8 }]}
                      onPress={() => {
                        setCustomDateOverride(null);
                        setTempCustomDate(null);
                      }}
                    >
                      <ThemedText style={[styles.devButtonText, { color: 'white' }]}>
                        Clear Override (Use Real Time)
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <ThemedText style={[styles.currentDate, { color: textColor, opacity: 0.6 }]}>
                    Using real time
                  </ThemedText>
                )}
              </View>

              {/* Date/Time Picker Controls */}
              <View style={styles.pickerSection}>
                {Platform.OS === 'web' ? (
                  <View>
                    {ReactDatePicker ? (
                      <View>
                        <View style={styles.datePickerWrapper}>
                          <ReactDatePicker
                            selected={tempCustomDate || customDateOverride || new Date()}
                            onChange={(date: Date | null) => {
                              if (date) {
                                setTempCustomDate(date);
                              }
                            }}
                            showTimeSelect
                            dateFormat="yyyy-MM-dd HH:mm:ss"
                            timeFormat="HH:mm"
                            timeIntervals={15}
                            customInput={
                              <TextInput
                                style={[
                                  styles.dateInput,
                                  { color: textColor, borderColor, width: '100%' },
                                ]}
                                placeholder="YYYY-MM-DD HH:MM:SS"
                                placeholderTextColor={textColor + '60'}
                                value={
                                  tempCustomDate
                                    ? tempCustomDate.toISOString().slice(0, 19).replace('T', ' ')
                                    : ''
                                }
                              />
                            }
                          />
                        </View>
                        <View style={styles.dateButtonsRow}>
                          <TouchableOpacity
                            style={[styles.devButton, { backgroundColor: tintColor, flex: 1 }]}
                            onPress={() => {
                              if (tempCustomDate) {
                                setCustomDateOverride(tempCustomDate);
                              }
                            }}
                          >
                            <ThemedText style={[styles.devButtonText, { color: backgroundColor }]}>
                              Apply
                            </ThemedText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.addDayButton, { backgroundColor: '#9b59b6' }]}
                            onPress={() => {
                              const currentDate =
                                tempCustomDate || customDateOverride || new Date();
                              const nextDay = new Date(currentDate);
                              nextDay.setDate(nextDay.getDate() + 1);
                              setTempCustomDate(nextDay);
                              setCustomDateOverride(nextDay);
                            }}
                          >
                            <ThemedText style={[styles.addDayButtonText, { color: 'white' }]}>
                              +1 Day
                            </ThemedText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      // Fallback if ReactDatePicker is not available
                      <View>
                        <View style={styles.dateInputRow}>
                          <TextInput
                            style={[styles.dateInput, { color: textColor, borderColor, flex: 1 }]}
                            placeholder="YYYY-MM-DD HH:MM:SS"
                            placeholderTextColor={textColor + '60'}
                            value={
                              tempCustomDate
                                ? tempCustomDate.toISOString().slice(0, 19).replace('T', ' ')
                                : ''
                            }
                            onChangeText={text => {
                              const date = new Date(text);
                              if (!isNaN(date.getTime())) {
                                setTempCustomDate(date);
                              }
                            }}
                          />
                          <TouchableOpacity
                            style={[styles.addDayButton, { backgroundColor: tintColor }]}
                            onPress={() => {
                              const currentDate = customDateOverride || new Date();
                              const nextDay = new Date(currentDate);
                              nextDay.setDate(nextDay.getDate() + 1);
                              setTempCustomDate(nextDay);
                              setCustomDateOverride(nextDay);
                            }}
                          >
                            <ThemedText
                              style={[styles.addDayButtonText, { color: backgroundColor }]}
                            >
                              +1 Day
                            </ThemedText>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                          style={[styles.devButton, { backgroundColor: tintColor, marginTop: 8 }]}
                          onPress={() => {
                            if (tempCustomDate) {
                              setCustomDateOverride(tempCustomDate);
                            }
                          }}
                        >
                          <ThemedText style={[styles.devButtonText, { color: backgroundColor }]}>
                            Apply Custom Date/Time
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.devButton, { backgroundColor: tintColor }]}
                    onPress={() => {
                      setTempCustomDate(customDateOverride || new Date());
                      if (Platform.OS === 'ios') {
                        setShowDatePicker(true);
                      } else {
                        // On Android, show date picker directly
                        setShowDatePicker(true);
                      }
                    }}
                  >
                    <ThemedText style={[styles.devButtonText, { color: backgroundColor }]}>
                      Set Custom Date/Time
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>

              {/* iOS Date Picker Modal */}
              {Platform.OS === 'ios' && showDatePicker && DateTimePicker && (
                <Modal transparent={true} animationType="slide" visible={showDatePicker}>
                  <View style={styles.pickerOverlay}>
                    <View style={[styles.pickerContainer, { backgroundColor }]}>
                      <View style={styles.pickerHeader}>
                        <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                          <ThemedText style={[styles.pickerButton, { color: tintColor }]}>
                            Cancel
                          </ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            if (tempCustomDate) {
                              setCustomDateOverride(tempCustomDate);
                            }
                            setShowDatePicker(false);
                          }}
                        >
                          <ThemedText style={[styles.pickerButton, { color: tintColor }]}>
                            Done
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={tempCustomDate || new Date()}
                        mode="datetime"
                        display="spinner"
                        onChange={(event, selectedDate) => {
                          if (selectedDate) {
                            setTempCustomDate(selectedDate);
                          }
                        }}
                      />
                    </View>
                  </View>
                </Modal>
              )}

              {/* Android Date/Time Pickers */}
              {Platform.OS === 'android' && showDatePicker && DateTimePicker && (
                <DateTimePicker
                  value={tempCustomDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setTempCustomDate(selectedDate);
                      // After date is selected, show time picker
                      setTimeout(() => setShowTimePicker(true), 100);
                    }
                  }}
                />
              )}

              {Platform.OS === 'android' && showTimePicker && DateTimePicker && (
                <DateTimePicker
                  value={tempCustomDate || new Date()}
                  mode="time"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowTimePicker(false);
                    if (selectedDate) {
                      setCustomDateOverride(selectedDate);
                    }
                  }}
                />
              )}

              <TouchableOpacity
                style={[styles.closeButton, { borderColor }]}
                onPress={() => setShowDevTools(false)}
              >
                <ThemedText style={[styles.closeButtonText, { color: textColor }]}>
                  Close
                </ThemedText>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // Take available space but share with rightSection
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rewardContainer: {
    position: 'relative',
  },
  rewardDisplay: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  rewardText: {
    fontSize: 14,
    fontWeight: '600',
  },
  icon: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  titleImage: {
    height: 24,
    width: 36, // Calculated from image aspect ratio (1536x1024 = 1.5:1)
    marginLeft: 8,
  },
  visibilityButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  visibilityButtonText: {
    fontSize: 10,
  },
  devIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  devIndicatorText: {
    fontSize: 10,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 300,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  devButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  devButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rewardSection: {
    position: 'relative',
  },
  spendInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 8,
  },
  spendButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  spendButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelSpendButton: {
    borderWidth: 1,
  },
  confirmSpendButton: {
    // backgroundColor set dynamically
  },
  spendButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  spendModalContent: {
    width: '100%',
    maxWidth: 300,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  spendModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  spendModalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 20,
  },
  dateSection: {
    marginBottom: 20,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
  },
  dateSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  currentDate: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  pickerSection: {
    marginBottom: 16,
  },
  quickActionsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  pickerButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  dateInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  dateInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addDayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addDayButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  datePickerWrapper: {
    marginBottom: 8,
  },
  dateButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
});
