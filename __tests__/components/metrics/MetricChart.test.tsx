import React from "react";
import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

// Mock React Native before importing component
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return {
    ...RN,
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (style: any) => style,
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 667 })),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  };
});

import { MetricChart } from "@/components/metrics/MetricChart";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PaperProvider>{children}</PaperProvider>
);

describe("MetricChart", () => {
  const mockData = [
    { timestamp: new Date("2024-01-01T10:00:00"), value: 10 },
    { timestamp: new Date("2024-01-01T11:00:00"), value: 20 },
    { timestamp: new Date("2024-01-01T12:00:00"), value: 15 },
  ];

  it("renders title when provided", () => {
    const { getByText } = render(
      <MetricChart data={mockData} title="Test Metric" />,
      { wrapper },
    );

    expect(getByText("Test Metric")).toBeTruthy();
  });

  it("renders empty state when no data provided", () => {
    const { getByText } = render(
      <MetricChart data={[]} title="Empty Chart" />,
      { wrapper },
    );

    expect(getByText("Empty Chart")).toBeTruthy();
    expect(getByText("No data available")).toBeTruthy();
  });

  it("renders line chart by default for time-series data", () => {
    const { toJSON } = render(<MetricChart data={mockData} />, { wrapper });

    expect(toJSON()).toBeTruthy();
  });

  it("renders with custom chart type", () => {
    const { toJSON } = render(<MetricChart data={mockData} type="bar" />, {
      wrapper,
    });

    expect(toJSON()).toBeTruthy();
  });

  it("renders pie chart for labeled data", () => {
    const pieData = [
      { timestamp: new Date(), value: 30, label: "Category A" },
      { timestamp: new Date(), value: 50, label: "Category B" },
      { timestamp: new Date(), value: 20, label: "Category C" },
    ];

    const { toJSON } = render(<MetricChart data={pieData} type="pie" />, {
      wrapper,
    });

    expect(toJSON()).toBeTruthy();
  });

  it("renders axis labels when provided", () => {
    const { getByText } = render(
      <MetricChart data={mockData} xAxisLabel="Time" yAxisLabel="Value" />,
      { wrapper },
    );

    expect(getByText("Time")).toBeTruthy();
  });
});
