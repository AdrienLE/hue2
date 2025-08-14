import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

interface DevToolsProps {
  onAdvanceDay: () => void;
  onTriggerDailyReview: () => void;
  onResetDay: () => void;
}

export function DevTools({ onAdvanceDay, onTriggerDailyReview, onResetDay }: DevToolsProps) {
  const [showDevTools, setShowDevTools] = useState(false);
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const borderColor = useThemeColor({ light: '#e1e5e9', dark: '#333' }, 'border');

  // Always show in development mode or when dev tools are force enabled
  const forceDevTools = process.env.EXPO_PUBLIC_FORCE_DEV_TOOLS === 'true';
  const isDev = process.env.NODE_ENV !== 'production';
  
  console.log('DevTools debug:', {
    NODE_ENV: process.env.NODE_ENV,
    EXPO_PUBLIC_FORCE_DEV_TOOLS: process.env.EXPO_PUBLIC_FORCE_DEV_TOOLS,
    forceDevTools,
    isDev,
    shouldShow: isDev || forceDevTools
  });
  
  if (!isDev && !forceDevTools) {
    return null;
  }

  return (
    <>
      {/* Floating dev button */}
      <View style={styles.devButton}>
        <TouchableOpacity
          style={[styles.devButtonInner, { backgroundColor: tintColor }]}
          onPress={() => setShowDevTools(true)}
        >
          <ThemedText style={[styles.devButtonText, { color: backgroundColor }]}>
            🛠️
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Dev tools modal */}
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
          <ThemedView style={[styles.modal, { borderColor }]}>
            <ThemedText style={styles.title}>Dev Tools</ThemedText>
            
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Time Travel</ThemedText>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: tintColor }]}
                onPress={() => {
                  onAdvanceDay();
                  setShowDevTools(false);
                }}
              >
                <ThemedText style={[styles.buttonText, { color: backgroundColor }]}>
                  Advance Day (+1)
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#ff6b6b' }]}
                onPress={() => {
                  onResetDay();
                  setShowDevTools(false);
                }}
              >
                <ThemedText style={[styles.buttonText, { color: 'white' }]}>
                  Reset to Today
                </ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Daily Review</ThemedText>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#4ecdc4' }]}
                onPress={() => {
                  onTriggerDailyReview();
                  setShowDevTools(false);
                }}
              >
                <ThemedText style={[styles.buttonText, { color: 'white' }]}>
                  Trigger Daily Review
                </ThemedText>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.closeButton, { borderColor }]}
              onPress={() => setShowDevTools(false)}
            >
              <ThemedText style={[styles.closeButtonText, { color: textColor }]}>
                Close
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  devButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1000,
  },
  devButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  devButtonText: {
    fontSize: 20,
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});