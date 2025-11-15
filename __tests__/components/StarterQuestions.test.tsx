import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { StarterQuestions } from "@/components/chat/StarterQuestions";

describe("<StarterQuestions>", () => {
  it("renders the provided questions and calls onPress", () => {
    const questions = [
      "What movies are trending right now?",
      "Show cast for The Matrix",
    ];

    const onSelect = jest.fn();

    const { getByText, getAllByA11yRole } = render(
      <StarterQuestions questions={questions} onSelectQuestion={onSelect} />,
    );

    // buttons count
    const buttons = getAllByA11yRole("button");
    expect(buttons.length).toBe(2);

    // full-width style applied so the chevron aligns to the right
    expect(buttons[0]).toHaveStyle({ width: "100%" });

    // text present
    expect(getByText(questions[0])).toBeTruthy();
    expect(getByText(questions[1])).toBeTruthy();

    // press
    fireEvent.press(getByText(questions[0]));
    expect(onSelect).toHaveBeenCalledWith(questions[0]);
  });
});
