/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

// Default hue values (0-360 degrees) - pleasant, well-distributed colors
export const DefaultHues = [
  200, // Sky Blue
  160, // Teal
  120, // Green
  280, // Violet
  340, // Rose
  40, // Gold
  220, // Ocean Blue
  140, // Mint
  320, // Pink
  80, // Lime
  260, // Purple
  20, // Orange
  180, // Cyan
  100, // Spring Green
  240, // Blue
];

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// Convert OKLCH to RGB hex for perceptually uniform colors
// OKLCH is a newer, more accurate perceptual color space
export function oklchToHex(l: number, c: number, h: number): string {
  // Convert to OKLAB first
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);

  // OKLAB to linear sRGB conversion
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let b2 = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  // Linear to sRGB gamma correction
  const toSRGB = (c: number) => {
    if (c >= 0.0031308) {
      return 1.055 * Math.pow(Math.abs(c), 1 / 2.4) - 0.055;
    } else {
      return 12.92 * c;
    }
  };

  r = toSRGB(r);
  g = toSRGB(g);
  b2 = toSRGB(b2);

  // Clamp and convert to hex
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const toHex = (v: number) =>
    Math.round(clamp(v) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b2)}`;
}

// Function to get a consistent color for a habit using OKLCH color space
export const getHabitColor = (
  habitId: number,
  customHue?: number,
  globalLightness?: number,
  globalChroma?: number,
  isDarkMode?: boolean
): string => {
  // Use custom hue if provided, otherwise use default based on habitId
  const hue = customHue ?? DefaultHues[habitId % DefaultHues.length];

  // Use OKLCH lightness directly (10-90 range, converted to 0.1-0.9)
  const defaultLightness = isDarkMode ? 75 : 65;
  const lightness = globalLightness ?? defaultLightness;

  // Invert lightness for dark mode if using global lightness
  const finalLightness =
    globalLightness !== undefined && isDarkMode ? 100 - globalLightness : lightness;

  const oklchLightness = finalLightness / 100; // Convert to 0-1 range

  // Use OKLCH chroma directly (0-30 range, converted to 0-0.3)
  const chroma = globalChroma ?? 15;
  const oklchChroma = chroma / 100; // Convert to 0-0.3 range

  return oklchToHex(oklchLightness, oklchChroma, hue);
};

// Function to span hues evenly across the list order (index-based)
export const getHabitColorByIndex = (
  index: number,
  total: number,
  globalLightness?: number,
  globalChroma?: number,
  isDarkMode?: boolean
): string => {
  const safeTotal = Math.max(1, total);
  // Start from a pleasing sky-blue base and span the wheel
  const baseHue = 200; // sky blue start
  const hue = (baseHue + (360 * (index % safeTotal)) / safeTotal) % 360;

  const defaultLightness = isDarkMode ? 75 : 65;
  const lightness = globalLightness ?? defaultLightness;
  const finalLightness =
    globalLightness !== undefined && isDarkMode ? 100 - globalLightness : lightness;
  const oklchLightness = finalLightness / 100;

  const chroma = globalChroma ?? 15;
  const oklchChroma = chroma / 100;

  return oklchToHex(oklchLightness, oklchChroma, hue);
};
