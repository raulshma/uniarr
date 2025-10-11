import React from 'react';
import { render } from '@testing-library/react-native';
import MediaDetails from './MediaDetails';

describe('MediaDetails', () => {
  it('hides internal poster when showPoster=false and applies content inset', () => {
    const { queryByText, getByTestId } = render(
      <MediaDetails
        title="Test"
        type="movie"
        showPoster={false}
        disableScroll={true}
        contentInsetTop={50}
        testID="media-details-test"
      />
    );

    // When showPoster is false the internal MediaPoster is not rendered,
    // so the placeholder text produced by MediaPoster should not be present.
    expect(queryByText('No artwork')).toBeNull();

    // The wrapper should apply the provided contentInsetTop value.
    const container = getByTestId('media-details-test');
    expect(container).toHaveStyle({ paddingTop: 50 });
  });
});