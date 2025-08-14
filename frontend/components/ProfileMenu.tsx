import { useState, useEffect } from 'react';
import { Pressable, View, StyleSheet, Platform, Modal, TouchableOpacity } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Image } from 'expo-image';

import { useAuth } from '@/auth/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { api } from '@/lib/api';
import { useRouter } from 'expo-router';

export function ProfileMenu() {
  const { logout, token } = useAuth();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });

  const loadProfileImage = async () => {
    if (!token) return;
    try {
      const response = await api.get('/api/settings', token);
      if (response.data) {
        setProfileImageUrl(response.data.imageUrl ?? '');
      }
    } catch (e) {
      console.warn('Failed to load profile image', e);
    }
  };

  useEffect(() => {
    loadProfileImage();
  }, [!!token]);

  // Refresh profile image when the screen comes into focus (after returning from settings)
  useFocusEffect(
    useCallback(() => {
      loadProfileImage();
    }, [token])
  );

  return (
    <>
      <TouchableOpacity
        onPress={event => {
          event.currentTarget.measure((x, y, width, height, pageX, pageY) => {
            setDropdownPosition({ x: pageX - 80, y: pageY + height });
            setOpen(true);
          });
        }}
        hitSlop={8}
      >
        {profileImageUrl ? (
          <Image source={{ uri: profileImageUrl }} style={styles.profileImage} />
        ) : (
          <IconSymbol
            name="person.crop.circle"
            size={28}
            color={Colors[colorScheme ?? 'light'].icon}
            style={{ marginRight: 16 }}
          />
        )}
      </TouchableOpacity>

      {/* Profile Dropdown Menu */}
      <Modal
        visible={open}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.dropdownOverlay} onPress={() => setOpen(false)}>
          <ThemedView
            style={[
              styles.dropdownMenu,
              {
                position: 'absolute',
                top: dropdownPosition.y,
                left: dropdownPosition.x,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setOpen(false);
                router.push('/settings');
              }}
            >
              <ThemedText style={styles.dropdownText}>Settings</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setOpen(false);
                logout();
              }}
            >
              <ThemedText style={[styles.dropdownText, styles.logoutText]}>Logout</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  profileImage: {
    width: 28,
    height: 28,
    borderRadius: 14, // Perfect circle
    marginRight: 16,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  dropdownMenu: {
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownText: {
    fontSize: 16,
  },
  logoutText: {
    color: '#ff4444',
  },
});
