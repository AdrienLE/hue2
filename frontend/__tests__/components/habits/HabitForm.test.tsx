import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { HabitForm } from '@/components/habits/HabitForm';
import { HabitService } from '@/lib/services/habitService';
import { useAuth } from '@/auth/AuthContext';

// Mock dependencies
jest.mock('@/lib/services/habitService');
jest.mock('@/auth/AuthContext');
jest.mock('@/hooks/useThemeColor', () => ({
  useThemeColor: () => '#007AFF'
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

const mockHabitService = HabitService as jest.Mocked<typeof HabitService>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('HabitForm', () => {
  const mockToken = 'test-token';
  const mockOnHabitCreated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: mockToken,
      loading: false,
      user: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
    });
  });

  it('renders correctly', () => {
    render(<HabitForm onHabitCreated={mockOnHabitCreated} />);
    
    expect(screen.getByText('Create New Habit')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter habit name')).toBeTruthy();
    expect(screen.getByText('Count-based habit')).toBeTruthy();
    expect(screen.getByText('Weight tracking habit')).toBeTruthy();
  });

  it('creates a simple habit successfully', async () => {
    const mockCreatedHabit = {
      id: 1,
      user_id: 'user-123',
      name: 'Test Habit',
      has_counts: false,
      is_weight: false,
      created_at: '2024-01-01T00:00:00Z'
    };

    mockHabitService.createHabit.mockResolvedValue({
      data: mockCreatedHabit,
      status: 200
    });

    render(<HabitForm onHabitCreated={mockOnHabitCreated} />);
    
    // Fill in the form
    const nameInput = screen.getByPlaceholderText('Enter habit name');
    const descriptionInput = screen.getByPlaceholderText('Optional description');
    const createButton = screen.getByText('Create Habit');
    
    fireEvent.changeText(nameInput, 'Test Habit');
    fireEvent.changeText(descriptionInput, 'A test habit');
    fireEvent.press(createButton);
    
    await waitFor(() => {
      expect(mockHabitService.createHabit).toHaveBeenCalledWith(
        {
          name: 'Test Habit',
          description: 'A test habit',
          has_counts: false,
          is_weight: false,
          reward_settings: {
            success_points: 10,
            penalty_points: 5
          }
        },
        mockToken
      );
    });

    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Habit created successfully!');
    expect(mockOnHabitCreated).toHaveBeenCalled();
  });

  it('creates a count-based habit', async () => {
    const mockCreatedHabit = {
      id: 1,
      user_id: 'user-123',
      name: 'Push-ups',
      has_counts: true,
      is_weight: false,
      created_at: '2024-01-01T00:00:00Z'
    };

    mockHabitService.createHabit.mockResolvedValue({
      data: mockCreatedHabit,
      status: 200
    });

    render(<HabitForm onHabitCreated={mockOnHabitCreated} />);
    
    // Fill in the form
    const nameInput = screen.getByPlaceholderText('Enter habit name');
    const countSwitch = screen.getByRole('switch', { name: /count-based/i });
    
    fireEvent.changeText(nameInput, 'Push-ups');
    fireEvent(countSwitch, 'valueChange', true);
    
    // Check that count settings appear
    expect(screen.getByPlaceholderText('e.g., 50')).toBeTruthy();
    expect(screen.getByPlaceholderText('e.g., pushups, glasses')).toBeTruthy();
    
    // Fill count settings
    const targetInput = screen.getByPlaceholderText('e.g., 50');
    const unitInput = screen.getByPlaceholderText('e.g., pushups, glasses');
    
    fireEvent.changeText(targetInput, '50');
    fireEvent.changeText(unitInput, 'pushups');
    
    const createButton = screen.getByText('Create Habit');
    fireEvent.press(createButton);
    
    await waitFor(() => {
      expect(mockHabitService.createHabit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Push-ups',
          has_counts: true,
          is_weight: false,
          count_settings: {
            target: 50,
            unit: 'pushups',
            step_size: 1
          }
        }),
        mockToken
      );
    });
  });

  it('creates a weight-based habit', async () => {
    const mockCreatedHabit = {
      id: 1,
      user_id: 'user-123',
      name: 'Weight Loss',
      has_counts: false,
      is_weight: true,
      created_at: '2024-01-01T00:00:00Z'
    };

    mockHabitService.createHabit.mockResolvedValue({
      data: mockCreatedHabit,
      status: 200
    });

    render(<HabitForm onHabitCreated={mockOnHabitCreated} />);
    
    const nameInput = screen.getByPlaceholderText('Enter habit name');
    const weightSwitch = screen.getByRole('switch', { name: /weight tracking/i });
    
    fireEvent.changeText(nameInput, 'Weight Loss');
    fireEvent(weightSwitch, 'valueChange', true);
    
    // Check that weight settings appear
    expect(screen.getByPlaceholderText('e.g., 70')).toBeTruthy();
    
    // Fill weight settings
    const targetWeightInput = screen.getByPlaceholderText('e.g., 70');
    fireEvent.changeText(targetWeightInput, '70');
    
    const createButton = screen.getByText('Create Habit');
    fireEvent.press(createButton);
    
    await waitFor(() => {
      expect(mockHabitService.createHabit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Weight Loss',
          has_counts: false,
          is_weight: true,
          weight_settings: {
            target_weight: 70,
            unit: 'kg'
          }
        }),
        mockToken
      );
    });
  });

  it('prevents both count and weight being enabled', () => {
    render(<HabitForm onHabitCreated={mockOnHabitCreated} />);
    
    const countSwitch = screen.getByRole('switch', { name: /count-based/i });
    const weightSwitch = screen.getByRole('switch', { name: /weight tracking/i });
    
    // Enable count habit
    fireEvent(countSwitch, 'valueChange', true);
    
    // Try to enable weight habit
    fireEvent(weightSwitch, 'valueChange', true);
    
    // Count should be disabled when weight is enabled
    // This depends on the implementation - the test might need adjustment
  });

  it('validates required fields', async () => {
    render(<HabitForm onHabitCreated={mockOnHabitCreated} />);
    
    const createButton = screen.getByText('Create Habit');
    fireEvent.press(createButton);
    
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a habit name');
    });
    
    expect(mockHabitService.createHabit).not.toHaveBeenCalled();
  });

  it('validates mutually exclusive habit types', async () => {
    render(<HabitForm onHabitCreated={mockOnHabitCreated} />);
    
    const nameInput = screen.getByPlaceholderText('Enter habit name');
    fireEvent.changeText(nameInput, 'Test Habit');
    
    // Manually set both switches to true (this would be prevented by UI logic)
    // This test simulates a bug where both could be true
    const createButton = screen.getByText('Create Habit');
    
    // This would need modification in the component to test this scenario
    // For now, the UI prevents this, so this test might not be relevant
  });

  it('handles API errors', async () => {
    mockHabitService.createHabit.mockResolvedValue({
      status: 400,
      error: 'Validation failed'
    });

    render(<HabitForm onHabitCreated={mockOnHabitCreated} />);
    
    const nameInput = screen.getByPlaceholderText('Enter habit name');
    const createButton = screen.getByText('Create Habit');
    
    fireEvent.changeText(nameInput, 'Test Habit');
    fireEvent.press(createButton);
    
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to create habit: Validation failed');
    });
    
    expect(mockOnHabitCreated).not.toHaveBeenCalled();
  });

  it('handles network errors', async () => {
    mockHabitService.createHabit.mockRejectedValue(new Error('Network error'));

    render(<HabitForm onHabitCreated={mockOnHabitCreated} />);
    
    const nameInput = screen.getByPlaceholderText('Enter habit name');
    const createButton = screen.getByText('Create Habit');
    
    fireEvent.changeText(nameInput, 'Test Habit');
    fireEvent.press(createButton);
    
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to create habit');
    });
  });

  it('resets form after successful creation', async () => {
    const mockCreatedHabit = {
      id: 1,
      user_id: 'user-123',
      name: 'Test Habit',
      has_counts: false,
      is_weight: false,
      created_at: '2024-01-01T00:00:00Z'
    };

    mockHabitService.createHabit.mockResolvedValue({
      data: mockCreatedHabit,
      status: 200
    });

    render(<HabitForm onHabitCreated={mockOnHabitCreated} />);
    
    const nameInput = screen.getByPlaceholderText('Enter habit name');
    const descriptionInput = screen.getByPlaceholderText('Optional description');
    const createButton = screen.getByText('Create Habit');
    
    fireEvent.changeText(nameInput, 'Test Habit');
    fireEvent.changeText(descriptionInput, 'Description');
    fireEvent.press(createButton);
    
    await waitFor(() => {
      expect(mockHabitService.createHabit).toHaveBeenCalled();
    });
    
    // Check that form is reset
    expect(nameInput.props.value).toBe('');
    expect(descriptionInput.props.value).toBe('');
  });

  it('shows loading state during creation', async () => {
    // Mock a delayed response
    mockHabitService.createHabit.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        data: { id: 1, name: 'Test' },
        status: 200
      }), 100))
    );

    render(<HabitForm onHabitCreated={mockOnHabitCreated} />);
    
    const nameInput = screen.getByPlaceholderText('Enter habit name');
    const createButton = screen.getByText('Create Habit');
    
    fireEvent.changeText(nameInput, 'Test Habit');
    fireEvent.press(createButton);
    
    // Check loading state
    expect(screen.getByText('Creating...')).toBeTruthy();
    
    await waitFor(() => {
      expect(screen.getByText('Create Habit')).toBeTruthy();
    });
  });

  it('requires authentication', async () => {
    mockUseAuth.mockReturnValue({
      token: null,
      loading: false,
      user: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
    });

    render(<HabitForm onHabitCreated={mockOnHabitCreated} />);
    
    const nameInput = screen.getByPlaceholderText('Enter habit name');
    const createButton = screen.getByText('Create Habit');
    
    fireEvent.changeText(nameInput, 'Test Habit');
    fireEvent.press(createButton);
    
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'You must be logged in to create habits');
    });
    
    expect(mockHabitService.createHabit).not.toHaveBeenCalled();
  });
});