import React from "react";
import { render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";
import { MetricCard } from "@/components/metrics/MetricCard";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PaperProvider>{children}</PaperProvider>
);

describe("MetricCard", () => {
  it("renders title and value correctly", () => {
    const { getByText } = render(<MetricCard title="Uptime" value="99.5%" />, {
      wrapper,
    });

    expect(getByText("Uptime")).toBeTruthy();
    expect(getByText("99.5%")).toBeTruthy();
  });

  it("renders numeric value correctly", () => {
    const { getByText } = render(
      <MetricCard title="Active Streams" value={5} metricType="activity" />,
      { wrapper },
    );

    expect(getByText("Active Streams")).toBeTruthy();
    expect(getByText("5")).toBeTruthy();
  });

  it("formats large numbers with commas", () => {
    const { getByText } = render(
      <MetricCard
        title="Total Requests"
        value={1234567}
        metricType="activity"
      />,
      { wrapper },
    );

    expect(getByText("1,234,567")).toBeTruthy();
  });

  it("displays trend indicator when provided", () => {
    const { getByText } = render(
      <MetricCard
        title="Error Rate"
        value="2.5%"
        trend="down"
        trendValue="-0.5%"
        metricType="errors"
      />,
      { wrapper },
    );

    expect(getByText("-0.5%")).toBeTruthy();
  });

  it("formats uptime percentage correctly", () => {
    const { getByText } = render(
      <MetricCard title="Uptime" value={99.87} metricType="uptime" />,
      { wrapper },
    );

    expect(getByText("99.9%")).toBeTruthy();
  });
});
