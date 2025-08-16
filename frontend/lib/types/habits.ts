export interface User {
  id: string;
  email: string;
  name?: string;
  nickname?: string;
  image_url?: string;
  settings?: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface Habit {
  id: number;
  user_id: string;
  name: string;
  description?: string;
  has_counts: boolean;
  is_weight: boolean;
  count_settings?: CountSettings;
  weight_settings?: WeightSettings;
  schedule_settings?: ScheduleSettings;
  reward_settings?: RewardSettings;
  display_settings?: DisplaySettings;
  deleted_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface CountSettings {
  target?: number;
  unit?: string;
  step_size?: number;
  goal_type?: 'above' | 'below' | 'exact';
}

export interface WeightSettings {
  target_weight?: number;
  unit?: 'kg' | 'lbs';
  starting_weight?: number;
}

export interface ScheduleSettings {
  weekdays?: number[]; // 0-6, Sunday=0
  interval_days?: number;
  display_rules?: {
    hide_when_completed?: boolean;
    show_only_unchecked?: boolean;
  };
}

export interface RewardSettings {
  // Regular habit rewards
  success_points?: number; // Points for checking the main habit
  penalty_points?: number; // Penalty for not checking

  // Sub-habit specific
  sub_habit_points?: number; // Points for checking individual sub-habits

  // Count habit rewards
  count_per_unit?: number; // Points per unit counted
  count_check_bonus?: number; // Bonus points for checking/tracking the count
  count_check_penalty?: number; // Penalty for not checking/tracking the count

  // Weight habit rewards
  weight_per_unit?: number; // Points per kg/lb lost or gained (depending on goal)
  weight_check_bonus?: number; // Bonus points for tracking weight
  weight_check_penalty?: number; // Penalty for not checking/tracking weight

  custom_rewards?: string[];
}

export interface DisplaySettings {
  order?: number;
  hidden?: boolean;
  color?: string;
  icon?: string;
}

export interface SubHabit {
  id: number;
  parent_habit_id: number;
  user_id: string;
  name: string;
  description?: string;
  order_index: number;
  reward_settings?: RewardSettings;
  created_at: string;
  updated_at?: string;
}

export interface Check {
  id: number;
  user_id: string;
  habit_id?: number;
  sub_habit_id?: number;
  checked: boolean;
  check_date: string;
  metadata_json?: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface Count {
  id: number;
  user_id: string;
  habit_id: number;
  value: number;
  count_date: string;
  metadata_json?: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface WeightUpdate {
  id: number;
  user_id: string;
  habit_id: number;
  weight: number;
  update_date: string;
  metadata_json?: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface ActiveDay {
  id: number;
  user_id: string;
  date: string;
  validated: boolean;
  summary_data?: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface HabitCreate {
  name: string;
  description?: string;
  has_counts?: boolean;
  is_weight?: boolean;
  count_settings?: CountSettings;
  weight_settings?: WeightSettings;
  schedule_settings?: ScheduleSettings;
  reward_settings?: RewardSettings;
  display_settings?: DisplaySettings;
}

export interface HabitUpdate {
  name?: string;
  description?: string;
  has_counts?: boolean;
  is_weight?: boolean;
  count_settings?: CountSettings;
  weight_settings?: WeightSettings;
  schedule_settings?: ScheduleSettings;
  reward_settings?: RewardSettings;
  display_settings?: DisplaySettings;
  deleted_at?: string;
}

export interface SubHabitCreate {
  parent_habit_id: number;
  name: string;
  description?: string;
  order_index?: number;
  reward_settings?: RewardSettings;
}

export interface CheckCreate {
  habit_id?: number;
  sub_habit_id?: number;
  checked?: boolean;
  check_date: string;
  metadata_json?: Record<string, any>;
}

export interface CountCreate {
  habit_id: number;
  value: number;
  count_date: string;
  metadata_json?: Record<string, any>;
}

export interface WeightUpdateCreate {
  habit_id: number;
  weight: number;
  update_date: string;
  metadata_json?: Record<string, any>;
}
