# Recommendation Hooks

React hooks for the Content Recommendation Engine feature.

## Overview

This module provides three hooks for interacting with the content recommendation system:

1. **useRecommendations** - Fetch and manage personalized recommendations
2. **useRecommendationFeedback** - Record user feedback (accept/reject)
3. **useContentGaps** - Identify missing content in user's library

## Usage Examples

### useRecommendations

Fetch personalized content recommendations with automatic caching and offline support.

```tsx
import { useRecommendations } from "@/hooks/recommendations";

function RecommendationsScreen() {
  const {
    recommendations,
    isLoading,
    error,
    cacheAge,
    isOffline,
    refetch,
    refresh,
  } = useRecommendations({
    userId: "user123",
    limit: 5,
    includeHiddenGems: true,
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (isOffline) return <OfflineIndicator />;

  return (
    <View>
      <Button onPress={refresh}>Refresh Recommendations</Button>
      {cacheAge && <Text>Last updated: {formatAge(cacheAge)}</Text>}

      <FlatList
        data={recommendations}
        renderItem={({ item }) => <RecommendationCard recommendation={item} />}
      />
    </View>
  );
}
```

**Features:**

- Cache-first strategy with 24-hour stale time
- Automatic offline support
- Cache age tracking
- Manual refresh capability

### useRecommendationFeedback

Record user feedback on recommendations with optimistic updates.

```tsx
import { useRecommendationFeedback } from "@/hooks/recommendations";

function RecommendationCard({ recommendation, userId }) {
  const { acceptRecommendation, rejectRecommendation, isSubmitting, error } =
    useRecommendationFeedback();

  const handleAccept = async () => {
    try {
      await acceptRecommendation(
        userId,
        recommendation.id,
        "Looks interesting!",
      );
      // Show success message
    } catch (err) {
      // Handle error
    }
  };

  const handleReject = async () => {
    try {
      await rejectRecommendation(userId, recommendation.id, "Not my style");
      // Show success message
    } catch (err) {
      // Handle error
    }
  };

  return (
    <Card>
      <Text>{recommendation.title}</Text>
      <Button onPress={handleAccept} disabled={isSubmitting}>
        Accept
      </Button>
      <Button onPress={handleReject} disabled={isSubmitting}>
        Reject
      </Button>
      {error && <ErrorText>{error.message}</ErrorText>}
    </Card>
  );
}
```

**Features:**

- Optimistic updates for immediate UI feedback
- Automatic cache invalidation after feedback
- Error handling and rollback
- Loading states

### useContentGaps

Identify popular content missing from user's library.

```tsx
import { useContentGaps } from "@/hooks/recommendations";

function ContentGapsScreen() {
  const { contentGaps, isLoading, error, refetch } = useContentGaps({
    userId: "user123",
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <View>
      <Text>Missing from Your Library</Text>
      <Button onPress={refetch}>Refresh Gaps</Button>

      <FlatList
        data={contentGaps}
        renderItem={({ item }) => <ContentGapCard gap={item} />}
      />
    </View>
  );
}
```

**Features:**

- Automatic caching (24 hours)
- Ranked by relevance
- Offline detection
- Manual refetch

## API Reference

### useRecommendations

```typescript
function useRecommendations(options: {
  userId: string;
  limit?: number;
  includeHiddenGems?: boolean;
  enabled?: boolean;
}): {
  recommendations: Recommendation[];
  isLoading: boolean;
  error: Error | null;
  isFetching: boolean;
  isStale: boolean;
  cacheAge?: number;
  isOffline: boolean;
  context?: RecommendationContext;
  refetch: () => Promise<void>;
  refresh: () => Promise<void>;
  checkStaleness: () => Promise<StaleInfo>;
};
```

### useRecommendationFeedback

```typescript
function useRecommendationFeedback(): {
  acceptRecommendation: (
    userId: string,
    recommendationId: string,
    reason?: string,
  ) => Promise<void>;
  rejectRecommendation: (
    userId: string,
    recommendationId: string,
    reason?: string,
  ) => Promise<void>;
  isSubmitting: boolean;
  error: Error | null;
  reset: () => void;
};
```

### useContentGaps

```typescript
function useContentGaps(options: { userId: string; enabled?: boolean }): {
  contentGaps: Recommendation[];
  isLoading: boolean;
  error: Error | null;
  isFetching: boolean;
  refetch: () => Promise<void>;
};
```

## Integration with TanStack Query

All hooks use TanStack Query for server state management:

- **Query Keys**: Defined in `src/hooks/queryKeys.ts`
- **Cache Configuration**: 24-hour stale time, 7-day garbage collection
- **Retry Logic**: Exponential backoff with 2 retries
- **Refetch Behavior**: On reconnect, not on window focus

## Error Handling

All hooks provide error states and handle common scenarios:

- **Offline Mode**: Automatically detected and handled
- **Rate Limiting**: Returns cached data when rate limited
- **Network Errors**: Graceful degradation with cached data
- **Service Failures**: Fallback to cache when available

## Performance Considerations

- **Cache-First Strategy**: Reduces API calls and improves response time
- **Optimistic Updates**: Immediate UI feedback for user actions
- **Background Refetch**: Automatic updates on reconnection
- **Lazy Loading**: Content gaps don't refetch on mount

## Related Documentation

- [Content Recommendation Service](../../services/ai/recommendations/README.md)
- [Recommendation Types](../../models/recommendation.types.ts)
- [Query Keys](../queryKeys.ts)
