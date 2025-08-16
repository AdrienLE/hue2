import { getHabitColor, oklchToHex } from '@/constants/Colors';

describe('Color System', () => {
  describe('oklchToHex', () => {
    it('should convert OKLCH red to hex', () => {
      const hex = oklchToHex(0.6, 0.2, 29); // Red hue
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      // Should be reddish
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      expect(r > g).toBe(true);
      expect(r > b).toBe(true);
    });

    it('should convert OKLCH green to hex', () => {
      const hex = oklchToHex(0.6, 0.2, 142); // Green hue
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      // Should be greenish
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      expect(g > r).toBe(true);
      expect(g > b).toBe(true);
    });

    it('should convert OKLCH blue to hex', () => {
      const hex = oklchToHex(0.6, 0.2, 264); // Blue hue
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      // Should be bluish
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      expect(b > r).toBe(true);
      expect(b > g).toBe(true);
    });

    it('should handle edge cases', () => {
      // Black (L=0)
      const black = oklchToHex(0, 0, 0);
      expect(black).toBe('#000000');

      // White (L=1, C=0)
      const white = oklchToHex(1, 0, 0);
      expect(white).toBe('#ffffff');

      // Gray (L=0.5, C=0)
      const gray = oklchToHex(0.5, 0, 0);
      expect(gray).toMatch(/^#[0-9a-f]{6}$/i);
      const r = parseInt(gray.slice(1, 3), 16);
      const g = parseInt(gray.slice(3, 5), 16);
      const b = parseInt(gray.slice(5, 7), 16);
      expect(Math.abs(r - g) < 5).toBe(true);
      expect(Math.abs(g - b) < 5).toBe(true);
    });

    it('should clamp out-of-gamut colors', () => {
      // Very high chroma might be out of gamut
      const extreme = oklchToHex(0.5, 0.5, 0);
      expect(extreme).toMatch(/^#[0-9a-f]{6}$/i);
      // Should still produce valid hex
      const r = parseInt(extreme.slice(1, 3), 16);
      const g = parseInt(extreme.slice(3, 5), 16);
      const b = parseInt(extreme.slice(5, 7), 16);
      expect(r >= 0).toBe(true);
      expect(r <= 255).toBe(true);
      expect(g >= 0).toBe(true);
      expect(g <= 255).toBe(true);
      expect(b >= 0).toBe(true);
      expect(b <= 255).toBe(true);
    });
  });

  describe('getHabitColor', () => {
    it('should generate consistent colors for the same habit ID', () => {
      const color1 = getHabitColor(1);
      const color2 = getHabitColor(1);
      expect(color1).toBe(color2);
    });

    it('should generate different colors for different habit IDs', () => {
      const color1 = getHabitColor(1);
      const color2 = getHabitColor(2);
      const color3 = getHabitColor(3);
      expect(color1).not.toBe(color2);
      expect(color2).not.toBe(color3);
      expect(color1).not.toBe(color3);
    });

    it('should respect custom hue', () => {
      const defaultColor = getHabitColor(1);
      const customColor = getHabitColor(1, 180); // Custom cyan hue
      expect(defaultColor).not.toBe(customColor);
    });

    it('should respect global lightness setting', () => {
      const normal = getHabitColor(1, undefined, 50);
      const bright = getHabitColor(1, undefined, 80);
      const dark = getHabitColor(1, undefined, 20);

      // All should be different
      expect(normal).not.toBe(bright);
      expect(normal).not.toBe(dark);
      expect(bright).not.toBe(dark);
    });

    it('should respect global chroma setting', () => {
      const normal = getHabitColor(1, undefined, 50, 20);
      const vivid = getHabitColor(1, undefined, 50, 30);
      const gray = getHabitColor(1, undefined, 50, 5);

      // All should be different
      expect(normal).not.toBe(vivid);
      expect(normal).not.toBe(gray);
      expect(vivid).not.toBe(gray);
    });

    it('should adjust colors for dark mode', () => {
      // Test with explicit global lightness (which triggers inversion)
      const lightMode = getHabitColor(1, undefined, 60, 20, false);
      const darkMode = getHabitColor(1, undefined, 60, 20, true);

      // Should be different when global lightness is provided
      expect(lightMode).not.toBe(darkMode);

      // Test default behavior (without global lightness)
      const lightModeDefault = getHabitColor(1, undefined, undefined, 20, false);
      const darkModeDefault = getHabitColor(1, undefined, undefined, 20, true);

      // May or may not be different depending on defaults
      // Just ensure they're valid colors
      expect(lightModeDefault).toMatch(/^#[0-9a-f]{6}$/i);
      expect(darkModeDefault).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should handle all combinations of parameters', () => {
      // Test various combinations
      const combinations = [
        { habitId: 1, hue: 120, lightness: 60, chroma: 25, isDark: false },
        { habitId: 2, hue: 240, lightness: 40, chroma: 15, isDark: true },
        { habitId: 3, hue: 0, lightness: 70, chroma: 30, isDark: false },
        { habitId: 4, hue: 360, lightness: 30, chroma: 10, isDark: true },
      ];

      combinations.forEach(({ habitId, hue, lightness, chroma, isDark }) => {
        const color = getHabitColor(habitId, hue, lightness, chroma, isDark);
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('should provide good distribution across habit IDs', () => {
      const colors = [];
      for (let i = 1; i <= 10; i++) {
        colors.push(getHabitColor(i));
      }

      // All should be unique
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(10);

      // Should have variety in hues
      const hues = colors.map(color => {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        // Rough hue approximation
        return Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b);
      });

      const uniqueHueRanges = new Set(hues.map(h => Math.floor((h * 6) / Math.PI)));
      expect(uniqueHueRanges.size > 5).toBe(true); // Should have good distribution
    });
  });
});
