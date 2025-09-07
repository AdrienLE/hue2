import { Stack, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import {
  View,
  Button,
  StyleSheet,
  Pressable,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import { ThemedText } from '@/components/ThemedText';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { api } from '@/lib/api';
import { Colors } from '@/constants/Colors';
import { getHabitColorByIndex } from '@/constants/Colors';
import { useAuth } from '@/auth/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useUser } from '@/contexts/UserContext';

export default function SettingsScreen() {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [pendingImage, setPendingImage] = useState<{
    uri: string;
    fileName?: string;
    mimeType?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const { token } = useAuth();
  const colorScheme = useColorScheme();
  const router = useRouter();
  const hasLoaded = useRef(false);
  const { userSettings, updateUserSettings } = useUser();
  const [isDirty, setIsDirty] = useState(false);

  // Local state for reward settings
  const [rewardUnit, setRewardUnit] = useState(userSettings.reward_unit || '$');
  const [rewardPosition, setRewardPosition] = useState(
    userSettings.reward_unit_position || 'before'
  );
  const [rolloverHour, setRolloverHour] = useState(
    (userSettings.day_rollover_hour ?? 3).toString()
  );
  const [colorLightness, setColorLightness] = useState(userSettings.color_brightness ?? 65);
  const [colorChroma, setColorChroma] = useState(userSettings.color_saturation ?? 15);
  const [colorFrequency, setColorFrequency] = useState(
    // Undefined means "span all habits"; for UI default to 12
    userSettings.color_frequency ?? 12
  );
  const [isSlidingColors, setIsSlidingColors] = useState(false);

  // Compress image to reduce file size
  const compressImage = async (uri: string, fileName: string, mimeType: string) => {
    if (Platform.OS === 'web') {
      // Web compression using Canvas
      const img = new window.Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      return new Promise<{ uri: string; fileName: string; mimeType: string }>(resolve => {
        img.onload = () => {
          // Target size: 300px (suitable for profile pics)
          const maxSize = 300;
          let { width, height } = img;

          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            blob => {
              if (blob) {
                const compressedUri = URL.createObjectURL(blob);
                resolve({
                  uri: compressedUri,
                  fileName,
                  mimeType: 'image/jpeg', // Always convert to JPEG for better compression
                });
              }
            },
            'image/jpeg',
            0.8
          ); // 80% quality
        };
        img.src = uri;
      });
    } else {
      // Mobile: Use expo-image-manipulator for compression
      const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
      const result = await manipulateAsync(
        uri,
        [{ resize: { width: 300 } }], // Resize to 300px width, maintain aspect ratio
        {
          compress: 0.8,
          format: SaveFormat.JPEG,
        }
      );

      return {
        uri: result.uri,
        fileName: fileName.replace(/\.[^/.]+$/, '.jpg'), // Change extension to .jpg
        mimeType: 'image/jpeg',
      };
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) {
      const asset = result.assets[0];

      // Compress the image before storing
      const compressed = await compressImage(
        asset.uri,
        asset.fileName ?? 'profile.jpg',
        asset.mimeType ?? 'image/jpeg'
      );

      setPendingImage(compressed);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!token || hasLoaded.current) return;
      hasLoaded.current = true;
      try {
        const response = await api.get('/api/settings', token);
        if (response.data) {
          setName(response.data.name ?? '');
          setNickname(response.data.nickname ?? '');
          setEmail(response.data.email ?? '');
          setImageUrl(response.data.imageUrl ?? '');
        }
      } catch (e) {
        console.warn('Failed to load settings', e);
        hasLoaded.current = false; // Reset on error to allow retry
      }
    };
    load();
  }, [!!token]);

  // Update local state when userSettings change
  useEffect(() => {
    // Avoid clobbering in-progress user edits (especially due to background polling)
    if (isDirty || isSlidingColors || saving) return;
    setRewardUnit(userSettings.reward_unit || '$');
    setRewardPosition(userSettings.reward_unit_position || 'before');
    setRolloverHour((userSettings.day_rollover_hour ?? 3).toString());
    setColorLightness(userSettings.color_brightness ?? 65);
    setColorChroma(userSettings.color_saturation ?? 15);
    setColorFrequency(userSettings.color_frequency ?? 12);
  }, [userSettings, isDirty, isSlidingColors, saving]);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      let finalImageUrl = imageUrl;

      // Upload pending image first if there is one
      if (pendingImage) {
        console.log('Uploading pending image:', pendingImage);
        const formData = new FormData();

        // On web, we need to create a proper File object from the URI
        if (pendingImage.uri.startsWith('blob:') || pendingImage.uri.startsWith('data:')) {
          // Web: Convert blob/data URI to File
          const response = await fetch(pendingImage.uri);
          const blob = await response.blob();
          const file = new File([blob], pendingImage.fileName || 'profile.jpg', {
            type: pendingImage.mimeType || 'image/jpeg',
          });
          formData.append('file', file);
        } else {
          // Mobile: Use the existing format
          formData.append('file', {
            uri: pendingImage.uri,
            name: pendingImage.fileName,
            type: pendingImage.mimeType,
          } as any);
        }

        const uploadResponse = await api.upload('/api/upload-profile-picture', formData, token);

        if (uploadResponse.data) {
          finalImageUrl = uploadResponse.data.url;
        } else {
          console.warn('Failed to upload image:', uploadResponse.error);
          setSaving(false);
          return; // Don't save if upload failed
        }
      }

      // Save settings with the final image URL
      await api.post('/api/settings', { name, nickname, email, imageUrl: finalImageUrl }, token);

      // Save reward settings
      const parsedRollover = (() => {
        const n = parseInt(rolloverHour, 10);
        if (Number.isNaN(n)) return 3;
        return Math.min(23, Math.max(0, n));
      })();

      await updateUserSettings({
        reward_unit: rewardUnit,
        reward_unit_position: rewardPosition,
        day_rollover_hour: parsedRollover,
        color_brightness: colorLightness,
        color_saturation: colorChroma,
        color_frequency: Math.max(1, Math.round(colorFrequency)),
      });
      setIsDirty(false);
      setIsSlidingColors(false);
      router.back();
    } catch (e) {
      console.warn('Failed to save settings', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <Pressable style={styles.overlay} onPress={router.back}>
        <Pressable
          onPress={e => e.stopPropagation()}
          style={[styles.modal, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}
        >
          <Pressable onPress={router.back} style={styles.closeButton} hitSlop={8}>
            <IconSymbol name="xmark" size={24} color={Colors[colorScheme ?? 'light'].icon} />
          </Pressable>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
            <View style={styles.pictureRow}>
              {pendingImage || imageUrl ? (
                <Image source={{ uri: pendingImage?.uri || imageUrl }} style={styles.avatar} />
              ) : (
                <IconSymbol
                  name="person.crop.circle"
                  size={120}
                  color={Colors[colorScheme ?? 'light'].icon}
                  style={styles.avatar}
                />
              )}
              <Pressable
                onPress={pickImage}
                style={[
                  styles.changeButton,
                  { backgroundColor: Colors[colorScheme ?? 'light'].tint },
                ]}
              >
                <ThemedText
                  style={{
                    color: colorScheme === 'light' ? '#fff' : Colors.dark.background,
                  }}
                >
                  Change Picture
                </ThemedText>
              </Pressable>
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.label}>Name</ThemedText>
              <ThemedTextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
              />
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.label}>Nickname</ThemedText>
              <ThemedTextInput
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder="Your nickname"
              />
            </View>
            <View style={styles.row}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <ThemedTextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your.email@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Reward Settings Section */}
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Reward Settings</ThemedText>
            </View>

            <View style={styles.row}>
              <ThemedText style={styles.label}>Reward Unit</ThemedText>
              <ThemedTextInput
                style={styles.input}
                value={rewardUnit}
                onChangeText={setRewardUnit}
                placeholder="$"
              />
            </View>

            <View style={styles.row}>
              <ThemedText style={styles.label}>Unit Position</ThemedText>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    {
                      backgroundColor:
                        rewardPosition === 'before'
                          ? Colors[colorScheme ?? 'light'].tint
                          : 'transparent',
                      borderColor: Colors[colorScheme ?? 'light'].tint,
                    },
                  ]}
                  onPress={() => setRewardPosition('before')}
                >
                  <ThemedText
                    style={[
                      styles.toggleText,
                      {
                        color:
                          rewardPosition === 'before'
                            ? colorScheme === 'light'
                              ? '#fff'
                              : Colors.dark.background
                            : Colors[colorScheme ?? 'light'].tint,
                      },
                    ]}
                  >
                    Before ({rewardUnit}100)
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    {
                      backgroundColor:
                        rewardPosition === 'after'
                          ? Colors[colorScheme ?? 'light'].tint
                          : 'transparent',
                      borderColor: Colors[colorScheme ?? 'light'].tint,
                    },
                  ]}
                  onPress={() => setRewardPosition('after')}
                >
                  <ThemedText
                    style={[
                      styles.toggleText,
                      {
                        color:
                          rewardPosition === 'after'
                            ? colorScheme === 'light'
                              ? '#fff'
                              : Colors.dark.background
                            : Colors[colorScheme ?? 'light'].tint,
                      },
                    ]}
                  >
                    After (100{rewardUnit})
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.row}>
              <ThemedText style={styles.label}>Day Rollover Time</ThemedText>
              <ThemedTextInput
                style={styles.input}
                value={rolloverHour}
                onChangeText={setRolloverHour}
                placeholder="3"
                keyboardType="numeric"
              />
              <ThemedText style={styles.unitText}>:00 AM</ThemedText>
            </View>
            <ThemedText style={styles.helpText}>
              Habits reset at this time each day. Default is 3 AM.
            </ThemedText>

            {/* Color Settings Section */}
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Color Settings</ThemedText>
            </View>

            <View style={styles.sliderRow}>
              <ThemedText style={styles.label}>Lightness</ThemedText>
              <View style={styles.sliderContainer}>
                <View style={styles.sliderWrapper}>
                  <View
                    style={[
                      styles.sliderTrack,
                      colorScheme === 'dark'
                        ? styles.brightnessTrackDark
                        : styles.brightnessTrackLight,
                    ]}
                  />
                  <Slider
                    style={styles.slider}
                    minimumValue={10}
                    maximumValue={90}
                    value={colorLightness}
                    onValueChange={v => {
                      setIsDirty(true);
                      setIsSlidingColors(true);
                      setColorLightness(v);
                    }}
                    onSlidingComplete={() => setIsSlidingColors(false)}
                    minimumTrackTintColor="transparent"
                    maximumTrackTintColor="transparent"
                    thumbTintColor={Colors[colorScheme ?? 'light'].tint}
                  />
                </View>
                <ThemedText style={styles.sliderValue}>{Math.round(colorLightness)}%</ThemedText>
              </View>
            </View>

            <View style={styles.sliderRow}>
              <ThemedText style={styles.label}>Chroma</ThemedText>
              <View style={styles.sliderContainer}>
                <View style={styles.sliderWrapper}>
                  <View style={[styles.sliderTrack, styles.chromaTrack]} />
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={30}
                    value={colorChroma}
                    onValueChange={v => {
                      setIsDirty(true);
                      setIsSlidingColors(true);
                      setColorChroma(v);
                    }}
                    onSlidingComplete={() => setIsSlidingColors(false)}
                    minimumTrackTintColor="transparent"
                    maximumTrackTintColor="transparent"
                    thumbTintColor={Colors[colorScheme ?? 'light'].tint}
                  />
                </View>
                <ThemedText style={styles.sliderValue}>{Math.round(colorChroma)}</ThemedText>
              </View>
            </View>

            <View style={styles.sliderRow}>
              <ThemedText style={[styles.label, styles.labelWide]} numberOfLines={1}>
                Hue Frequency
              </ThemedText>
              <View style={styles.sliderContainer}>
                <View style={styles.sliderWrapper}>
                  <View style={[styles.sliderTrack, styles.chromaTrack]} />
                  <Slider
                    style={styles.slider}
                    minimumValue={1}
                    maximumValue={24}
                    step={1}
                    value={colorFrequency}
                    onValueChange={v => {
                      setIsDirty(true);
                      setIsSlidingColors(true);
                      setColorFrequency(v);
                    }}
                    onSlidingComplete={() => setIsSlidingColors(false)}
                    minimumTrackTintColor="transparent"
                    maximumTrackTintColor="transparent"
                    thumbTintColor={Colors[colorScheme ?? 'light'].tint}
                  />
                </View>
                <ThemedText style={styles.sliderValue}>{Math.round(colorFrequency)}</ThemedText>
              </View>
            </View>

            {/* Live palette preview */}
            <View style={styles.previewSection}>
              <ThemedText style={styles.previewTitle}>Palette Preview</ThemedText>
              <View style={styles.previewRow}>
                {Array.from({ length: Math.max(1, Math.round(colorFrequency)) }).map((_, i) => {
                  const color = getHabitColorByIndex(
                    i,
                    Math.max(1, Math.round(colorFrequency)),
                    colorLightness,
                    colorChroma,
                    colorScheme === 'dark'
                  );
                  return <View key={i} style={[styles.previewSwatch, { borderColor: color }]} />;
                })}
              </View>
            </View>

            <View style={styles.buttonRow}>
              <Button
                title="Cancel"
                onPress={router.back}
                color={Colors[colorScheme ?? 'light'].icon}
                disabled={saving}
              />
              <Button title={saving ? 'Saving...' : 'Save'} onPress={save} disabled={saving} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 8,
    padding: 24,
  },
  scrollView: {
    flex: 1,
  },
  content: { width: '100%', gap: 16 },
  pictureRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { width: 100 },
  labelWide: { width: 130 },
  previewSection: { marginTop: 8, marginBottom: 12 },
  previewTitle: { marginBottom: 8 },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap' },
  previewSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 6,
    marginBottom: 6,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 4,
  },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  toggleButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  unitText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    opacity: 0.7,
  },
  helpText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
    marginBottom: 8,
  },
  sliderRow: {
    flexDirection: 'column',
    gap: 8,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderTrack: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 6,
    borderRadius: 3,
  },
  brightnessTrackLight: {
    backgroundColor: '#000',
    background: 'linear-gradient(to right, #000000 0%, #ffffff 100%)',
  },
  brightnessTrackDark: {
    backgroundColor: '#fff',
    background: 'linear-gradient(to right, #ffffff 0%, #000000 100%)',
  },
  chromaTrack: {
    background: 'linear-gradient(to right, #808080 0%, #ff0000 100%)',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'right',
  },
});
