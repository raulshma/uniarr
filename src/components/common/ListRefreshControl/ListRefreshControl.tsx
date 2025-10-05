import { useCallback } from 'react';
import { RefreshControl as NativeRefreshControl } from 'react-native';
import { useTheme } from 'react-native-paper';

import type { ComponentProps } from 'react';

import type { AppTheme } from '@/constants/theme';

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object' &&
  value !== null &&
  'then' in (value as Record<string, unknown>) &&
  typeof (value as PromiseLike<unknown>).then === 'function';

export type ListRefreshControlProps = Omit<ComponentProps<typeof NativeRefreshControl>, 'onRefresh'> & {
  onRefresh: () => void | Promise<unknown>;
};

export const ListRefreshControl = ({
  onRefresh,
  colors,
  tintColor,
  titleColor,
  progressBackgroundColor,
  ...rest
}: ListRefreshControlProps) => {
  const theme = useTheme<AppTheme>();

  const resolvedColors = colors ?? [theme.colors.primary];
  const resolvedTintColor = tintColor ?? theme.colors.primary;
  const resolvedTitleColor = titleColor ?? theme.colors.onSurface;
  const resolvedProgressBackground = progressBackgroundColor ?? theme.colors.surfaceVariant;

  const handleRefresh = useCallback(() => {
    const result = onRefresh();
    if (isPromiseLike(result)) {
      void result;
    }
  }, [onRefresh]);

  return (
    <NativeRefreshControl
      {...rest}
      colors={resolvedColors}
      tintColor={resolvedTintColor}
      titleColor={resolvedTitleColor}
      progressBackgroundColor={resolvedProgressBackground}
      onRefresh={handleRefresh}
    />
  );
};
