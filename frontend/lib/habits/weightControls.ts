export const WEIGHT_STEP = 0.1;

export type WeightDirection = 'increase' | 'decrease';
export type WeightInputPlatform = 'android' | 'ios' | 'web' | 'macos' | 'windows';

export function roundWeight(weight: number): number {
  return Math.round(weight * 10) / 10;
}

export function formatWeightValue(weight: number | null): string {
  return weight === null ? '' : roundWeight(weight).toString();
}

export function isPartialWeightInput(value: string): boolean {
  return /^\d*\.?\d*$/.test(value);
}

export function parseWeightInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '.') return null;

  const weight = parseFloat(trimmed);
  return Number.isFinite(weight) && weight > 0 ? roundWeight(weight) : null;
}

export function getNextWeight(
  currentWeight: number | null,
  direction: WeightDirection,
  step: number = WEIGHT_STEP
): number {
  const baseWeight = currentWeight ?? 0;
  if (direction === 'decrease' && baseWeight <= 0) return 0;

  const change = direction === 'increase' ? step : -step;
  const nextWeight = roundWeight(baseWeight + change);

  return direction === 'decrease' ? Math.max(0.1, nextWeight) : Math.max(0, nextWeight);
}

export function getInlineWeightInputWidth(
  value: string,
  platform: WeightInputPlatform = 'web'
): number {
  if (!value) {
    return platform === 'ios' ? 72 : 56;
  }

  if (platform !== 'ios') {
    return Math.min(104, Math.max(44, value.length * 13 + 16));
  }

  const digitCount = (value.match(/\d/g) ?? []).length;
  const decimalCount = (value.match(/[.,]/g) ?? []).length;
  const otherCount = Math.max(0, value.length - digitCount - decimalCount);
  const contentWidth = digitCount * 12 + decimalCount * 6 + otherCount * 10;

  return Math.min(92, Math.max(48, contentWidth + 18));
}
