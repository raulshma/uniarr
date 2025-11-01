// Jest setup file to handle mock typing issues
import "jest";

// Extend Jest mock types to be more permissive
declare global {
  namespace jest {
    interface Mock<T = any, Y extends any[] = any> {
      mockResolvedValue(value: T): this;
      mockRejectedValue(value: any): this;
      mockImplementation(fn: (...args: Y[]) => T | Promise<T>): this;
      mockImplementationOnce(fn: (...args: Y[]) => T | Promise<T>): this;
      mockReturnValue(value: T): this;
      mockReturnThis(): this;
    }
  }
}

// Suppress TypeScript errors for test files
global.console = {
  ...console,
  // Suppress console warnings in tests
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock React Native modules before any tests run
jest.mock("react-native", () => ({
  Platform: {
    OS: "android",
    select: jest.fn((obj) => obj.android),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 667 })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

// Mock theme system
jest.mock("@/constants/theme.ts", () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: "#1976d2",
      background: "#ffffff",
      surface: "#f5f5f5",
      onPrimary: "#ffffff",
      onBackground: "#000000",
      onSurface: "#000000",
    },
    dark: false,
    isDarkMode: false,
  })),
  createTheme: jest.fn(() => ({
    colors: {
      primary: "#1976d2",
      background: "#ffffff",
      surface: "#f5f5f5",
      onPrimary: "#ffffff",
      onBackground: "#000000",
      onSurface: "#000000",
    },
    dark: false,
  })),
}));

// Suppress strict TypeScript errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Warning: ReactDOM.render is deprecated")
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
