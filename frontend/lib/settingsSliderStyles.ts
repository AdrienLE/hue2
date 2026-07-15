export const WEB_SETTINGS_SLIDER_CLASS = 'settings-slider';

export const WEB_LIGHTNESS_TRACK_BACKGROUND = 'linear-gradient(to right, #000000 0%, #ffffff 100%)';

export const WEB_CHROMA_TRACK_BACKGROUND = 'linear-gradient(to right, #808080 0%, #ff5a5f 100%)';

export const WEB_FREQUENCY_TRACK_BACKGROUND =
  'linear-gradient(to right, #ef4444 0%, #f59e0b 17%, #84cc16 33%, #06b6d4 50%, #3b82f6 67%, #8b5cf6 83%, #ec4899 100%)';

export const getKeyboardSliderValue = (
  key: string,
  value: number,
  minimumValue: number,
  maximumValue: number,
  step: number
): number | null => {
  let nextValue: number;

  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      nextValue = value - step;
      break;
    case 'ArrowRight':
    case 'ArrowUp':
      nextValue = value + step;
      break;
    case 'Home':
      return minimumValue;
    case 'End':
      return maximumValue;
    default:
      return null;
  }

  return Math.max(minimumValue, Math.min(maximumValue, nextValue));
};

export const WEB_SETTINGS_SLIDER_CSS = `
.${WEB_SETTINGS_SLIDER_CLASS} {
  -webkit-appearance: none;
  appearance: none;
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  width: 100%;
  height: 40px;
  margin: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.${WEB_SETTINGS_SLIDER_CLASS}::-webkit-slider-runnable-track {
  height: 6px;
  border: 0;
  border-radius: 3px;
  background: transparent;
}

.${WEB_SETTINGS_SLIDER_CLASS}::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  box-sizing: border-box;
  width: 20px;
  height: 20px;
  margin-top: -7px;
  border: 2px solid var(--settings-slider-thumb-border-color);
  border-radius: 50%;
  background: var(--settings-slider-thumb-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}

.${WEB_SETTINGS_SLIDER_CLASS}::-moz-range-track,
.${WEB_SETTINGS_SLIDER_CLASS}::-moz-range-progress {
  height: 6px;
  border: 0;
  border-radius: 3px;
  background: transparent;
}

.${WEB_SETTINGS_SLIDER_CLASS}::-moz-range-thumb {
  box-sizing: border-box;
  width: 20px;
  height: 20px;
  border: 2px solid var(--settings-slider-thumb-border-color);
  border-radius: 50%;
  background: var(--settings-slider-thumb-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}

.${WEB_SETTINGS_SLIDER_CLASS}:focus-visible {
  border-radius: 12px;
  outline: 2px solid var(--settings-slider-thumb-color);
  outline-offset: 1px;
}
`;
