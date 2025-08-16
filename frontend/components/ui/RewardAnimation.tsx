import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useUser } from '@/contexts/UserContext';

interface RewardAnimationProps {
  amount: number;
  isVisible: boolean;
  onComplete: () => void;
  position?: 'center' | 'right';
}

export function RewardAnimation({
  amount,
  isVisible,
  onComplete,
  position = 'center',
}: RewardAnimationProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  const textColor = useThemeColor({}, 'text');
  const positiveColor = '#4CAF50';
  const negativeColor = '#F44336';
  const { userSettings } = useUser();

  const isPositive = amount > 0;
  const displayAmount = Math.abs(amount);
  const animationColor = isPositive ? positiveColor : negativeColor;

  const formatAmount = (amount: number) => {
    const unit = userSettings.reward_unit || '$';
    const position = userSettings.reward_unit_position || 'before';
    const formatted = amount.toFixed(2);
    return position === 'before' ? `${unit}${formatted}` : `${formatted}${unit}`;
  };

  useEffect(() => {
    if (isVisible) {
      // Reset values
      translateY.setValue(0);
      opacity.setValue(0);
      scale.setValue(0.5);

      // Start animation sequence
      Animated.sequence([
        // Appear and scale up
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        // Hold for a moment
        Animated.delay(800),
        // Move up and fade out
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -50,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        onComplete();
      });
    }
  }, [isVisible, amount]);

  if (!isVisible) {
    return null;
  }

  return (
    <View style={[styles.container, position === 'right' && styles.rightPosition]}>
      <Animated.View
        style={[
          styles.animationContainer,
          {
            transform: [{ translateY }, { scale }],
            opacity,
          },
        ]}
      >
        <View style={[styles.badge, { backgroundColor: animationColor }]}>
          <ThemedText style={[styles.text, { color: 'white' }]}>
            {isPositive ? '+' : '-'}
            {formatAmount(displayAmount)}
          </ThemedText>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    pointerEvents: 'none',
  },
  rightPosition: {
    alignItems: 'flex-start',
    left: -80,
  },
  animationContainer: {
    marginTop: 0,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
