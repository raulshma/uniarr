import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useCalendar } from '../useCalendar';

// Mock the calendar service
jest.mock('@/services/calendar/CalendarService', () => ({
  CalendarService: {
    getInstance: () => ({
      getReleases: jest.fn().mockResolvedValue([
        {
          id: 'test-1',
          title: 'Test Movie',
          type: 'movie',
          releaseDate: '2024-01-15',
          status: 'upcoming',
          monitored: true,
        },
      ]),
    }),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useCalendar', () => {
  it('initializes with default state', () => {
    const { result } = renderHook(() => useCalendar(), {
      wrapper: createWrapper(),
    });

    expect(result.current.state.currentDate).toBeDefined();
    expect(result.current.state.view).toBe('month');
    expect(result.current.state.filters.mediaTypes).toEqual(['movie', 'series', 'episode']);
  });

  it('provides navigation functions', () => {
    const { result } = renderHook(() => useCalendar(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.navigation.goToPrevious).toBe('function');
    expect(typeof result.current.navigation.goToNext).toBe('function');
    expect(typeof result.current.navigation.goToToday).toBe('function');
    expect(typeof result.current.navigation.goToDate).toBe('function');
  });

  it('allows changing view', () => {
    const { result } = renderHook(() => useCalendar(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setView('week');
    });

    expect(result.current.state.view).toBe('week');
  });

  it('allows changing current date', () => {
    const { result } = renderHook(() => useCalendar(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setCurrentDate('2024-02-01');
    });

    expect(result.current.state.currentDate).toBe('2024-02-01');
  });

  it('validates date strings', () => {
    const { result } = renderHook(() => useCalendar(), {
      wrapper: createWrapper(),
    });

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    act(() => {
      result.current.setCurrentDate('invalid-date');
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Invalid date string provided to setCurrentDate:',
      'invalid-date'
    );

    consoleSpy.mockRestore();
  });
});