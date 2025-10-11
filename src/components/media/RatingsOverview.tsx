import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';
import type { AppTheme } from '@/constants/theme';
import { spacing } from '@/theme/spacing';

type Breakdown = { [rating: number]: number };

type Props = {
  rating?: number; // 0-10 scale
  votes?: number;
  breakdown?: Breakdown; // keys 5..1 -> percent
};

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

const RatingsOverview: React.FC<Props> = ({ rating, votes, breakdown }) => {
  const theme = useTheme<AppTheme>();

  // Convert to 0-5 scale for display
  const normalized = useMemo(() => (typeof rating === 'number' ? clamp(rating / 2, 0, 5) : undefined), [rating]);

  // Default breakdown when none supplied
  const computedBreakdown = useMemo(() => {
    if (breakdown) return breakdown;
    // Heuristic fallback distribution based on normalized rating
    const base = normalized ?? 3;
    const dist: Breakdown = {};
    for (let i = 5; i >= 1; i--) {
      const diff = Math.abs(i - base);
      const score = Math.max(0, 5 - diff * 1.5);
      dist[i] = Math.round(score / 20 * 100); // scale to some percent
    }
    // Normalize to 100
    const sum = Object.values(dist).reduce((s, n) => s + (n ?? 0), 0) || 1;
    for (const k of Object.keys(dist)) {
      const key = Number(k) as number;
      const val = dist[key] ?? 0;
      dist[key] = Math.round((val / sum) * 100);
    }
    return dist;
  }, [breakdown, normalized]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { alignItems: 'center', marginBottom: spacing.lg },
        largeNumber: { fontWeight: '800', color: theme.colors.onSurface },
        starsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
        barsContainer: { width: '100%', marginTop: spacing.sm },
        barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
        barLabel: { width: 28, color: theme.colors.onSurfaceVariant },
        barTrack: { flex: 1, height: 8, borderRadius: 8, backgroundColor: theme.colors.surfaceVariant, marginRight: spacing.sm },
        barFill: { height: 8, borderRadius: 8, backgroundColor: theme.colors.primary },
        percentLabel: { width: 40, color: theme.colors.onSurfaceVariant, textAlign: 'right' },
      }),
    [theme]
  );

  const renderStars = () => {
    if (normalized === undefined) return null;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const diff = normalized - i;
      if (diff >= 0) {
        stars.push('star');
      } else if (diff > -1) {
        // partial
        stars.push('star-half-full');
      } else {
        stars.push('star-outline');
      }
    }
    return (
      <View style={styles.starsRow}>
        {stars.map((name, idx) => (
          <IconButton key={idx} icon={name as any} size={18} iconColor={theme.colors.primary} />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.largeNumber, { fontSize: 36 }]}>{normalized !== undefined ? normalized.toFixed(1) : '—'}</Text>
      {renderStars()}
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{votes ? `${votes.toLocaleString()} reviews` : ''}</Text>

      <View style={styles.barsContainer}>
        {[5, 4, 3, 2, 1].map((r) => {
          const pct = computedBreakdown[r] ?? 0;
          return (
            <View key={r} style={styles.barRow}>
              <Text style={styles.barLabel}>{r}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.percentLabel}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default RatingsOverview;
