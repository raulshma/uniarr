import React from "react";
import { render } from "@testing-library/react-native";
import { ChatMessage } from "@/components/chat/ChatMessage";
import type { Message } from "@/models/chat.types";

const baseMessage = (overrides: Partial<Message> = {}): Message => ({
  id: "1",
  role: "assistant",
  text: "This is a test",
  timestamp: new Date(),
  isStreaming: false,
  metadata: undefined,
  ...overrides,
});

describe("<ChatMessage>", () => {
  it("renders the AI card when metadata.card is present", () => {
    const message = baseMessage({
      metadata: {
        card: {
          id: "c1",
          title: "My Movie",
          posterUrl: "http://example.com/poster.jpg",
          tmdbId: 123,
          overview: "test overview",
          year: 2020,
          genres: ["Action"],
          source: "tmdb",
        },
      },
    });

    const { getByText, getByTestId } = render(
      <ChatMessage message={message} />,
    );

    expect(getByText("This is a test")).toBeTruthy();
    expect(getByTestId("ai-message-card")).toBeTruthy();
  });
});
