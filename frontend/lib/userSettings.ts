export interface UserSettings {
  reward_unit?: string;
  reward_unit_position?: 'before' | 'after';
  total_rewards?: number;
  day_rollover_hour?: number;
  color_brightness?: number;
  color_saturation?: number;
  color_frequency?: number;
  last_session_date?: string;
  pending_daily_review?: {
    review_date: string;
    created_at: string;
  } | null;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  reward_unit: '$',
  reward_unit_position: 'before',
  total_rewards: 0,
  day_rollover_hour: 3,
  color_brightness: 50,
  color_saturation: 60,
  color_frequency: undefined,
  pending_daily_review: null,
};

export function normalizeUserSettings(settings: Partial<UserSettings> = {}): UserSettings {
  return {
    reward_unit: settings.reward_unit || DEFAULT_USER_SETTINGS.reward_unit,
    reward_unit_position:
      settings.reward_unit_position || DEFAULT_USER_SETTINGS.reward_unit_position,
    total_rewards: settings.total_rewards ?? DEFAULT_USER_SETTINGS.total_rewards,
    day_rollover_hour: settings.day_rollover_hour ?? DEFAULT_USER_SETTINGS.day_rollover_hour,
    color_brightness: settings.color_brightness ?? DEFAULT_USER_SETTINGS.color_brightness,
    color_saturation: settings.color_saturation ?? DEFAULT_USER_SETTINGS.color_saturation,
    color_frequency: settings.color_frequency,
    last_session_date: settings.last_session_date,
    pending_daily_review: settings.pending_daily_review || null,
  };
}

export function mergeUserSettingsUpdate(
  currentSettings: UserSettings,
  newSettings: Partial<UserSettings>
): UserSettings {
  return {
    ...currentSettings,
    ...newSettings,
  };
}
