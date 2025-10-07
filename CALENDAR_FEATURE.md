# Universal Media Release Calendar

A comprehensive calendar system for tracking upcoming media releases from various services like Sonarr, Radarr, and Jellyseerr.

## Features

### 📅 Multiple View Types
- **Month View**: Traditional calendar grid showing releases by day
- **Week View**: Detailed weekly view with time slots
- **Day View**: Focused daily view with all releases for a specific day
- **List View**: Chronological list of all releases

### 🎬 Media Type Support
- **Movies**: Feature films and direct-to-video releases
- **Series**: TV shows and web series
- **Episodes**: Individual TV episodes with season/episode information

### 🔍 Advanced Filtering
- Filter by media type (movies, series, episodes)
- Filter by release status (upcoming, released, delayed, cancelled)
- Filter by connected services
- Search by title or series name
- Date range filtering

### 📊 Statistics Dashboard
- Total releases count
- Upcoming releases
- Releases this week
- Monitored releases
- Breakdown by type and status

### 🎨 Design System Integration
- Follows existing Material Design 3 theming
- Consistent with app's color scheme and typography
- Responsive design for different screen sizes
- Dark/light mode support

## Architecture

### Core Components

#### `CalendarHeader`
- Navigation controls (previous/next/today)
- View switcher (month/week/day/list)
- Current period display

#### `CalendarMonthView`
- Grid-based month calendar
- Day cells with release indicators
- Compact release previews

#### `CalendarWeekView`
- Time-slot based weekly view
- Horizontal scrolling for better mobile experience
- Detailed release information

#### `CalendarDayView`
- Full-day focus with all releases
- Grouped by status (upcoming, released, etc.)
- Rich media cards with posters

#### `CalendarListView`
- Chronological list of all releases
- Grouped by date with relative time indicators
- Optimized for scrolling performance

#### `MediaReleaseCard`
- Displays release information
- Status indicators and badges
- Download status for monitored releases
- Compact and full variants

#### `CalendarStats`
- Statistical overview
- Visual breakdowns by type and status
- Real-time updates

#### `CalendarFilters`
- Collapsible filter panel
- Multiple filter types
- Clear all functionality

### Data Layer

#### `CalendarService`
- Integrates with existing service connectors
- Fetches data from Sonarr, Radarr, Jellyseerr
- Handles data transformation and filtering
- Error handling and retry logic

#### `useCalendar` Hook
- State management for calendar
- Data fetching with React Query
- Navigation and filtering logic
- Calendar data generation

#### Type Definitions
- Comprehensive TypeScript types
- Media release data structures
- Calendar view configurations
- Filter and navigation types

## Usage

### Basic Implementation

```tsx
import { useCalendar } from '@/hooks/useCalendar';
import { CalendarHeader, CalendarMonthView } from '@/components/calendar';

function CalendarScreen() {
  const {
    state,
    calendarData,
    stats,
    navigation,
    setView,
    setSelectedDate,
  } = useCalendar();

  return (
    <View>
      <CalendarHeader
        navigation={navigation}
        view={state.view}
        onViewChange={setView}
      />
      <CalendarMonthView
        data={calendarData}
        selectedDate={state.selectedDate}
        onDateSelect={setSelectedDate}
      />
    </View>
  );
}
```

### Adding Custom Filters

```tsx
const { setFilters, clearFilters } = useCalendar();

// Set custom filters
setFilters({
  mediaTypes: ['movie'],
  statuses: ['upcoming'],
  searchQuery: 'Marvel',
});

// Clear all filters
clearFilters();
```

### Handling Release Press Events

```tsx
const handleReleasePress = (releaseId: string) => {
  // Navigate to release details
  router.push(`/release/${releaseId}`);
};

<CalendarMonthView
  data={calendarData}
  onReleasePress={handleReleasePress}
/>
```

## Data Integration

### Sonarr Integration
- Fetches series and episode data
- Includes next airing dates
- Shows monitoring status
- Displays download status

### Radarr Integration
- Fetches movie data
- Shows release dates
- Includes monitoring information
- Displays quality profiles

### Jellyseerr Integration
- Fetches request data
- Shows approval status
- Includes user information
- Displays request dates

## Error Handling

### Service Errors
- Graceful degradation when services are unavailable
- Retry logic with exponential backoff
- User-friendly error messages
- Fallback to cached data when possible

### Data Validation
- Date string validation
- Type checking for all data structures
- Safe fallbacks for missing data
- Console warnings for invalid inputs

### UI Error States
- Loading states with skeleton placeholders
- Empty states with helpful messages
- Error boundaries for component isolation
- Retry mechanisms for failed operations

## Performance Optimizations

### Data Fetching
- React Query for caching and background updates
- Stale-while-revalidate strategy
- Optimistic updates for better UX
- Request deduplication

### Rendering
- FlashList for efficient list rendering
- Memoized components to prevent unnecessary re-renders
- Lazy loading for large datasets
- Virtual scrolling for performance

### Memory Management
- Proper cleanup of event listeners
- Efficient data structures
- Minimal re-renders through proper state management
- Garbage collection friendly patterns

## Testing

### Unit Tests
- Component rendering tests
- Hook behavior tests
- Utility function tests
- Service integration tests

### Integration Tests
- End-to-end calendar workflows
- Filter and navigation testing
- Error scenario testing
- Performance testing

## Future Enhancements

### Planned Features
- [ ] Push notifications for upcoming releases
- [ ] Calendar export (iCal format)
- [ ] Custom release date sources (TMDB, TVDB)
- [ ] Release reminder system
- [ ] Social sharing of release schedules
- [ ] Advanced analytics and insights

### Technical Improvements
- [ ] Offline support with local caching
- [ ] Real-time updates via WebSocket
- [ ] Advanced search with filters
- [ ] Custom view configurations
- [ ] Accessibility improvements
- [ ] Internationalization support

## Contributing

When contributing to the calendar feature:

1. Follow existing code patterns and conventions
2. Add comprehensive TypeScript types
3. Include unit tests for new functionality
4. Update documentation for new features
5. Ensure accessibility compliance
6. Test on multiple screen sizes
7. Verify error handling scenarios

## Dependencies

- React Native Paper (UI components)
- React Query (data fetching)
- React Native Reanimated (animations)
- React Native FlashList (performance)
- Expo Router (navigation)
- TypeScript (type safety)