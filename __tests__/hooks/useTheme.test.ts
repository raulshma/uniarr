import { renderHook } from '@testing-library/react-native';

import { useTheme } from '@/hooks/useTheme';
import { lightTheme, darkTheme } from '@/constants/theme';

// Mock the settings store
const mockUseSettingsStore = jest.fn();
jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: mockUseSettingsStore,
}));

// Mock react-native useColorScheme
const mockUseColorScheme = jest.fn();
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => mockUseColorScheme);

describe('useTheme', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns light theme when preference is light', () => {
    mockUseSettingsStore.mockReturnValue('light');
    mockUseColorScheme.mockReturnValue('dark'); // system is dark but user prefers light

    const { result } = renderHook(() => useTheme());

    expect(result.current).toEqual(lightTheme);
    expect(result.current.dark).toBe(false);
  });

  it('returns dark theme when preference is dark', () => {
    mockUseSettingsStore.mockReturnValue('dark');
    mockUseColorScheme.mockReturnValue('light'); // system is light but user prefers dark

    const { result } = renderHook(() => useTheme());

    expect(result.current).toEqual(darkTheme);
    expect(result.current.dark).toBe(true);
  });

  it('returns system theme when preference is system', () => {
    mockUseSettingsStore.mockReturnValue('system');
    mockUseColorScheme.mockReturnValue('dark');

    const { result } = renderHook(() => useTheme());

    expect(result.current).toEqual(darkTheme);
    expect(result.current.dark).toBe(true);
  });

  it('returns light theme when system is light and preference is system', () => {
    mockUseSettingsStore.mockReturnValue('system');
    mockUseColorScheme.mockReturnValue('light');

    const { result } = renderHook(() => useTheme());

    expect(result.current).toEqual(lightTheme);
    expect(result.current.dark).toBe(false);
  });
});
