import {
  WEB_CHROMA_TRACK_BACKGROUND,
  WEB_FREQUENCY_TRACK_BACKGROUND,
  WEB_LIGHTNESS_TRACK_BACKGROUND,
  WEB_SETTINGS_SLIDER_CSS,
  getKeyboardSliderValue,
} from '@/lib/settingsSliderStyles';

describe('settings slider web styles', () => {
  it('keeps the lightness scale ordered from dark to light in every theme', () => {
    expect(WEB_LIGHTNESS_TRACK_BACKGROUND).toBe(
      'linear-gradient(to right, #000000 0%, #ffffff 100%)'
    );
  });

  it('uses distinct visual scales for chroma and hue frequency', () => {
    expect(WEB_FREQUENCY_TRACK_BACKGROUND).not.toBe(WEB_CHROMA_TRACK_BACKGROUND);
  });

  it('removes the native track and layers the custom thumb above it', () => {
    expect(WEB_SETTINGS_SLIDER_CSS).toContain('-webkit-appearance: none');
    expect(WEB_SETTINGS_SLIDER_CSS).toContain('::-webkit-slider-runnable-track');
    expect(WEB_SETTINGS_SLIDER_CSS).toContain('background: transparent');
    expect(WEB_SETTINGS_SLIDER_CSS).toContain('z-index: 1');
  });

  it('supports and clamps standard keyboard slider controls', () => {
    expect(getKeyboardSliderValue('ArrowRight', 50, 10, 90, 1)).toBe(51);
    expect(getKeyboardSliderValue('ArrowLeft', 10, 10, 90, 1)).toBe(10);
    expect(getKeyboardSliderValue('Home', 50, 10, 90, 1)).toBe(10);
    expect(getKeyboardSliderValue('End', 50, 10, 90, 1)).toBe(90);
    expect(getKeyboardSliderValue('Enter', 50, 10, 90, 1)).toBeNull();
  });
});
