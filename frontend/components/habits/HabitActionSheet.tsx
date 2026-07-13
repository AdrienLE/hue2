import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

interface HabitActionSheetProps {
  visible: boolean;
  habitName: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function HabitActionSheet({
  visible,
  habitName,
  onClose,
  onEdit,
  onDelete,
}: HabitActionSheetProps) {
  const insets = useSafeAreaInsets();
  const surface = useThemeColor({ light: '#ffffff', dark: '#171a1f' }, 'background');
  const border = useThemeColor({ light: '#dfe3e8', dark: '#2d323a' }, 'border');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessible={false}
        style={[styles.backdrop, Platform.OS === 'web' && styles.webBackdrop]}
        onPress={onClose}
      >
        <Pressable
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: surface, borderColor: border, paddingBottom: insets.bottom + 12 },
          ]}
          onPress={event => event.stopPropagation()}
        >
          <View style={styles.handle} />
          <ThemedText style={styles.title} numberOfLines={1}>
            {habitName}
          </ThemedText>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Edit ${habitName}`}
            style={[styles.action, { borderColor: border }]}
            onPress={() => {
              onClose();
              onEdit();
            }}
          >
            <ThemedText style={styles.actionText}>Edit habit</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Delete ${habitName}`}
            style={[styles.action, { borderColor: border }]}
            onPress={() => {
              onClose();
              onDelete();
            }}
          >
            <ThemedText style={[styles.actionText, styles.danger]}>Delete habit</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.cancel} onPress={onClose}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.58)' },
  webBackdrop: { position: 'fixed' as any, top: 0, right: 0, bottom: 0, left: 0 },
  sheet: {
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#737b86',
    opacity: 0.6,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 13, opacity: 0.58, marginHorizontal: 4, marginBottom: 10 },
  action: {
    minHeight: 52,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
  },
  actionText: { fontSize: 17, fontWeight: '600' },
  danger: { color: '#ff6b6b' },
  cancel: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  cancelText: { fontSize: 16, fontWeight: '600', opacity: 0.7 },
});
