import { useReducer, useEffect } from "react";

export type CollectionSegmentKey = "movies" | "tv" | "music";

interface LibraryState {
  isBootstrapping: boolean;
  activeSegment: CollectionSegmentKey;
  selectedLibraryId: string | null;
  searchTerm: string;
  debouncedSearch: string;
  showSkeletonLayer: boolean;
  contentInteractive: boolean;
}

type LibraryAction =
  | { type: "SET_BOOTSTRAPPING"; payload: boolean }
  | { type: "SET_SEGMENT"; payload: CollectionSegmentKey }
  | { type: "SET_LIBRARY_ID"; payload: string | null }
  | { type: "SET_SEARCH_TERM"; payload: string }
  | { type: "SET_DEBOUNCED_SEARCH"; payload: string }
  | {
      type: "SET_SKELETON_STATE";
      payload: { showSkeleton: boolean; interactive: boolean };
    };

const libraryReducer = (
  state: LibraryState,
  action: LibraryAction,
): LibraryState => {
  switch (action.type) {
    case "SET_BOOTSTRAPPING":
      return { ...state, isBootstrapping: action.payload };
    case "SET_SEGMENT":
      return { ...state, activeSegment: action.payload };
    case "SET_LIBRARY_ID":
      return { ...state, selectedLibraryId: action.payload };
    case "SET_SEARCH_TERM":
      return { ...state, searchTerm: action.payload };
    case "SET_DEBOUNCED_SEARCH":
      return { ...state, debouncedSearch: action.payload };
    case "SET_SKELETON_STATE":
      return {
        ...state,
        showSkeletonLayer: action.payload.showSkeleton,
        contentInteractive: action.payload.interactive,
      };
    default:
      return state;
  }
};

export const useJellyfinLibraryState = () => {
  const [state, dispatch] = useReducer(libraryReducer, {
    isBootstrapping: true,
    activeSegment: "movies",
    selectedLibraryId: null,
    searchTerm: "",
    debouncedSearch: "",
    showSkeletonLayer: true,
    contentInteractive: false,
  });

  // Debounce search to prevent refetching on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = state.searchTerm.trim();
      if (trimmed !== state.debouncedSearch) {
        dispatch({ type: "SET_DEBOUNCED_SEARCH", payload: trimmed });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [state.searchTerm, state.debouncedSearch]);

  return { state, dispatch };
};
