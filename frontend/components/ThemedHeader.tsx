import React, { useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Modal, Pressable, TextInput, Alert } from 'react-native';
import { ThemedText } from './ThemedText';
import { ProfileMenu } from './ProfileMenu';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useUser } from '@/contexts/UserContext';
import { HueColors } from '@/constants/Colors';
import { DevTools } from './DevTools';

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
  onResetDay
}: ThemedHeaderProps) {
  const [showDevTools, setShowDevTools] = useState(false);
  const [showSpendInput, setShowSpendInput] = useState(false);
  const [spendAmount, setSpendAmount] = useState('');
  const [spending, setSpending] = useState(false);
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({ light: '#e1e5e9', dark: '#333' }, 'border');
  const { userSettings, totalRewards, subtractReward } = useUser();

  const formatReward = (amount: number) => {
    const unit = userSettings.reward_unit || '$';
    const position = userSettings.reward_unit_position || 'before';
    const formatted = amount.toFixed(2);
    return position === 'before' ? `${unit}${formatted}` : `${formatted}${unit}`;
  };

  const handleSpend = async () => {
    const amount = parseFloat(spendAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive amount to spend.');
      return;
    }

    const willGoNegative = totalRewards - amount < 0;
    if (willGoNegative) {
      Alert.alert(
        'Warning: Negative Balance',
        `This will take your balance to ${formatReward(totalRewards - amount)}. Make sure you\'re not cheating your targets!`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Spend Anyway', 
            style: 'destructive',
            onPress: async () => {
              setSpending(true);
              try {
                await subtractReward(amount);
                setSpendAmount('');
                setShowSpendInput(false);
                Alert.alert('Success', `Spent ${formatReward(amount)}!`);
              } catch (error) {
                console.error('Error spending reward:', error);
                Alert.alert('Error', 'Failed to spend reward');
              } finally {
                setSpending(false);
              }
            }
          }
        ]
      );
    } else {
      setSpending(true);
      try {
        await subtractReward(amount);
        setSpendAmount('');
        setShowSpendInput(false);
        Alert.alert('Success', `Spent ${formatReward(amount)}!`);
      } catch (error) {
        console.error('Error spending reward:', error);
        Alert.alert('Error', 'Failed to spend reward');
      } finally {
        setSpending(false);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor, borderBottomColor: borderColor }]}>
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

        <TouchableOpacity
          style={[
            styles.visibilityButton,
            { 
              backgroundColor: showCheckedHabits ? tintColor : 'transparent',
              borderColor: tintColor,
            }
          ]}
          onPress={onToggleCheckedHabits}
        >
          <ThemedText style={[
            styles.visibilityButtonText,
            { 
              color: showCheckedHabits ? backgroundColor : tintColor,
            }
          ]}>
            {showCheckedHabits ? '◉' : '◯'}
          </ThemedText>
        </TouchableOpacity>
        
        <ProfileMenu />
        
        {/* Dev mode button */}
        {(process.env.NODE_ENV !== 'production' || process.env.EXPO_PUBLIC_FORCE_DEV_TOOLS === 'true') && onAdvanceDay && (
          <TouchableOpacity
            style={[styles.devIndicator, { backgroundColor: '#ff0000' }]}
            onPress={() => setShowDevTools(true)}
          >
            <ThemedText style={[styles.devIndicatorText, { color: 'white' }]}>
              DEV
            </ThemedText>
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
            <ThemedText style={[styles.spendModalTitle, { color: textColor }]}>Spend Rewards</ThemedText>
            <ThemedText style={[styles.spendModalSubtitle, { color: textColor }]}>Current balance: {formatReward(totalRewards)}</ThemedText>
            
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
                <ThemedText style={[styles.spendButtonText, { color: textColor }]}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.spendButton, styles.confirmSpendButton, { backgroundColor: tintColor }]}
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
            onPress={() => setShowDevTools(false)}
          >
            <View style={[styles.modal, { backgroundColor, borderColor }]}>
              <ThemedText style={[styles.modalTitle, { color: textColor }]}>Dev Tools</ThemedText>
              
              <TouchableOpacity
                style={[styles.devButton, { backgroundColor: tintColor }]}
                onPress={() => {
                  onAdvanceDay?.();
                  setShowDevTools(false);
                }}
              >
                <ThemedText style={[styles.devButtonText, { color: backgroundColor }]}>
                  Advance Day (+1)
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.devButton, { backgroundColor: '#9b59b6' }]}
                onPress={() => {
                  // Advance 3 days
                  onAdvanceDay?.();
                  setTimeout(() => onAdvanceDay?.(), 100);
                  setTimeout(() => onAdvanceDay?.(), 200);
                  setShowDevTools(false);
                }}
              >
                <ThemedText style={[styles.devButtonText, { color: 'white' }]}>
                  Advance 3 Days (+3)
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.devButton, { backgroundColor: '#4ecdc4' }]}
                onPress={() => {
                  onTriggerDailyReview?.();
                  setShowDevTools(false);
                }}
              >
                <ThemedText style={[styles.devButtonText, { color: 'white' }]}>
                  Trigger Daily Review
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.devButton, { backgroundColor: '#ff6b6b' }]}
                onPress={() => {
                  onResetDay?.();
                  setShowDevTools(false);
                }}
              >
                <ThemedText style={[styles.devButtonText, { color: 'white' }]}>
                  Reset to Today
                </ThemedText>
              </TouchableOpacity>

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
    paddingTop: 8, // Reduced from 32 to make header thinner
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
});