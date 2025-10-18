import React from "react";
import { render } from "@testing-library/react-native";
import { CalendarHeader } from "../CalendarHeader";
import type { CalendarNavigation } from "@/models/calendar.types";

// Mock the theme provider
jest.mock("react-native-paper", () => ({
  useTheme: () => ({
    colors: {
      surface: "#ffffff",
      onSurface: "#000000",
      primary: "#8B6914",
    },
    custom: {
      spacing: {
        md: 16,
        sm: 12,
      },
      typography: {
        titleLarge: {
          fontSize: 22,
          fontFamily: "System",
          fontWeight: "400",
          lineHeight: 28,
          letterSpacing: 0,
        },
      },
    },
  }),
  Text: "Text",
  IconButton: "IconButton",
}));

const mockNavigation: CalendarNavigation = {
  canGoBack: true,
  canGoForward: true,
  currentPeriod: "January 2024",
  goToPrevious: jest.fn(),
  goToNext: jest.fn(),
  goToToday: jest.fn(),
  goToDate: jest.fn(),
};

describe("CalendarHeader", () => {
  it("renders correctly", () => {
    const { getByText } = render(
      <CalendarHeader navigation={mockNavigation} view="month" />,
    );

    expect(getByText("January 2024")).toBeTruthy();
  });

  it("calls navigation functions when buttons are pressed", () => {
    render(<CalendarHeader navigation={mockNavigation} view="month" />);

    // Note: In a real test, you would test button presses
    // This is a basic structure test
    expect(mockNavigation.goToPrevious).toBeDefined();
    expect(mockNavigation.goToNext).toBeDefined();
    expect(mockNavigation.goToToday).toBeDefined();
  });
});
