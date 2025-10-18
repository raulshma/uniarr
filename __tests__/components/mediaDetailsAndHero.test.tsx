import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";

import DetailHero from "@/components/media/DetailHero/DetailHero";
import MediaDetails from "@/components/media/MediaDetails/MediaDetails";

describe("DetailHero + MediaDetails integration", () => {
  it("DetailHero renders children and shows fetching indicator when isFetching=true", () => {
    const { getByText } = render(
      <DetailHero
        posterUri="https://example.com/poster.jpg"
        backdropUri="https://example.com/backdrop.jpg"
        isFetching={true}
      >
        <Text>Hero child</Text>
      </DetailHero>,
    );

    expect(getByText("Hero child")).toBeTruthy();
    expect(getByText("Refreshing…")).toBeTruthy();
  });

  it("MediaDetails hides internal poster when showPoster=false and applies content inset", () => {
    const { queryByText, getByTestId } = render(
      <MediaDetails
        title="Test"
        type="movie"
        showPoster={false}
        disableScroll={true}
        contentInsetTop={50}
        testID="media-details-test"
      />,
    );

    // Internal poster placeholder should not be present.
    expect(queryByText("No artwork")).toBeNull();

    // The wrapper should apply the provided contentInsetTop value.
    const container = getByTestId("media-details-test");
    expect(container).toHaveStyle({ paddingTop: 50 });
  });
});
