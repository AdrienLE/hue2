import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { DailyReviewModal } from '@/components/DailyReviewModal';
import { HabitService } from '@/lib/services/habitService';

// Mock dependencies
jest.mock('@/lib/services/habitService');
jest.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ token: 'mock-token' }),
}));

jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    subtractReward: jest.fn(),
    clearPendingDailyReview: mockClearPendingDailyReview,
  }),
}));

jest.mock('@/hooks/useThemeColor', () => ({
  useThemeColor: () => '#000000',
}));

// Mock Alert.alert
jest.spyOn(Alert, 'alert');

const mockHabitService = HabitService as jest.Mocked<typeof HabitService>;
const mockClearPendingDailyReview = jest.fn();

describe('DailyReviewModal', () => {
  const mockOnClose = jest.fn();
  const reviewDate = new Date('2024-01-15T10:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock HabitService responses
    mockHabitService.getHabits.mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Test Habit',
          description: 'Test Description',
          user_id: 'test-user',
          has_counts: false,
          is_weight: false,
          count_settings: null,
          weight_settings: null,
          schedule_settings: null,
          reward_settings: { penalty_points: 10 },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          deleted_at: null,
        },
      ],
      status: 200,
      message: 'Success',
    });

    mockHabitService.getChecks.mockResolvedValue({
      data: [],
      status: 200,
      message: 'Success',
    });

    mockHabitService.getCounts.mockResolvedValue({
      data: [],
      status: 200,
      message: 'Success',
    });

    mockHabitService.getWeightUpdates.mockResolvedValue({
      data: [],
      status: 200,
      message: 'Success',
    });
  });

  describe('Pending Review Clearing', () => {
    it('should clear pending review when modal is closed via onRequestClose', async () => {
      const { getByTestId } = render(
        <DailyReviewModal visible={true} onClose={mockOnClose} reviewDate={reviewDate} />
      );

      // Wait for the modal to load
      await waitFor(() => {
        expect(mockHabitService.getHabits).toHaveBeenCalled();
      });

      // Simulate pressing the hardware back button (triggers onRequestClose)
      const modal = getByTestId('daily-review-modal') || { props: { onRequestClose: () => {} } };
      if (modal && modal.props && modal.props.onRequestClose) {
        modal.props.onRequestClose();
      }

      await waitFor(() => {
        expect(mockClearPendingDailyReview).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should clear pending review when close button is pressed', async () => {
      const { getByText } = render(
        <DailyReviewModal visible={true} onClose={mockOnClose} reviewDate={reviewDate} />
      );

      // Wait for the modal to load
      await waitFor(() => {
        expect(mockHabitService.getHabits).toHaveBeenCalled();
      });

      // Find and press the close button
      const closeButton = getByText('Close');
      fireEvent.press(closeButton);

      await waitFor(() => {
        expect(mockClearPendingDailyReview).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should clear pending review when penalties are applied', async () => {
      const mockSubtractReward = jest.fn().mockResolvedValue(undefined);

      // Re-mock useUser for this test
      jest.doMock('@/contexts/UserContext', () => ({
        useUser: () => ({
          subtractReward: mockSubtractReward,
          clearPendingDailyReview: mockClearPendingDailyReview,
        }),
      }));

      const { getByText } = render(
        <DailyReviewModal visible={true} onClose={mockOnClose} reviewDate={reviewDate} />
      );

      // Wait for the modal to load
      await waitFor(() => {
        expect(mockHabitService.getHabits).toHaveBeenCalled();
      });

      // Press the "Apply Penalties" button
      const applyPenaltiesButton = getByText('Apply Penalties');
      fireEvent.press(applyPenaltiesButton);

      // Wait for the alert to appear and confirm it
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Simulate pressing OK on the alert
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const okButton = alertCall[2]?.find((button: any) => button.text === 'OK');
      if (okButton && okButton.onPress) {
        okButton.onPress();
      }

      await waitFor(() => {
        expect(mockClearPendingDailyReview).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should still close modal even if clearing pending review fails', async () => {
      // Mock clearPendingDailyReview to fail
      mockClearPendingDailyReview.mockRejectedValueOnce(new Error('Server error'));

      const { getByText } = render(
        <DailyReviewModal visible={true} onClose={mockOnClose} reviewDate={reviewDate} />
      );

      // Wait for the modal to load
      await waitFor(() => {
        expect(mockHabitService.getHabits).toHaveBeenCalled();
      });

      // Press the close button
      const closeButton = getByText('Close');
      fireEvent.press(closeButton);

      await waitFor(() => {
        expect(mockClearPendingDailyReview).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled(); // Should still close despite error
      });
    });

    it('should clear pending review when all habits are completed', async () => {
      // Mock that the habit is already checked
      mockHabitService.getChecks.mockResolvedValue({
        data: [
          {
            id: 1,
            user_id: 'test-user',
            habit_id: 1,
            sub_habit_id: null,
            check_date: '2024-01-15T10:00:00Z',
            created_at: '2024-01-15T10:00:00Z',
          },
        ],
        status: 200,
        message: 'Success',
      });

      const { getByText } = render(
        <DailyReviewModal visible={true} onClose={mockOnClose} reviewDate={reviewDate} />
      );

      // Wait for the modal to load and show "Perfect!" button
      await waitFor(() => {
        expect(mockHabitService.getHabits).toHaveBeenCalled();
      });

      const perfectButton = getByText(/Perfect!/);
      fireEvent.press(perfectButton);

      await waitFor(() => {
        expect(mockClearPendingDailyReview).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      mockHabitService.getHabits.mockRejectedValueOnce(new Error('Network error'));

      const { getByText } = render(
        <DailyReviewModal visible={true} onClose={mockOnClose} reviewDate={reviewDate} />
      );

      // Modal should still be functional even if loading fails
      const closeButton = getByText('Close');
      fireEvent.press(closeButton);

      await waitFor(() => {
        expect(mockClearPendingDailyReview).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });
});
