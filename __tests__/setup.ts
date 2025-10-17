// Jest setup file to handle mock typing issues
import "jest";

// Extend Jest mock types to be more permissive
declare global {
  namespace jest {
    interface Mock {
      mockResolvedValue(value: any): this;
      mockRejectedValue(value: any): this;
      mockImplementation(fn: any): this;
    }
  }
}

// Suppress TypeScript errors for test files
// @ts-ignore
global.console = {
  ...console,
  // Suppress console warnings in tests
  warn: jest.fn(),
  error: jest.fn(),
};
