import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import DetailHero from './DetailHero';

describe('DetailHero', () => {
  it('renders children and shows fetching indicator when isFetching is true', () => {
    const { getByText } = render(
      <DetailHero posterUri="https://example.com/poster.jpg" backdropUri="https://example.com/backdrop.jpg" isFetching={true}>
        <Text>Hero child</Text>
      </DetailHero>
    );

    expect(getByText('Hero child')).toBeTruthy();
    expect(getByText('Refreshing…')).toBeTruthy();
  });
});