import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Colors } from '@/constants/Colors';

export type ThemedTextInputProps = TextInputProps & {
  lightColor?: string;
  darkColor?: string;
};

export const ThemedTextInput = forwardRef<TextInput, ThemedTextInputProps>(function ThemedTextInput(
  { style, lightColor, darkColor, ...rest },
  ref
) {
  const colorScheme = useColorScheme() ?? 'light';
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  return (
    <TextInput
      ref={ref}
      style={[{ color }, style]}
      placeholderTextColor={Colors[colorScheme].icon}
      {...rest}
    />
  );
});
