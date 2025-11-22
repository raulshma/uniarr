import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import type { ContentMetadata } from "@/components/widgets/ContentDrawer";

export interface DrawerState {
  visible: boolean;
  title: string;
  content?: string;
  metadata: ContentMetadata;
  actionUrl?: string;
  actionLabel?: string;
  loading?: boolean;
  maxHeight?: string | number;
  customContent?: ReactNode;
  showMetadata?: boolean;
  showActionButton?: boolean;
  imageUrl?: string; // Add image URL property
}

interface WidgetDrawerContextType {
  drawerState: DrawerState;
  openDrawer: (state: Omit<DrawerState, "visible">) => void;
  closeDrawer: () => void;
}

const initialState: DrawerState = {
  visible: false,
  title: "",
  content: "",
  metadata: {},
  actionUrl: undefined,
  actionLabel: undefined,
  loading: false,
  maxHeight: undefined,
  customContent: undefined,
  showMetadata: true,
  showActionButton: true,
  imageUrl: undefined,
};

const WidgetDrawerContext = createContext<WidgetDrawerContextType | undefined>(
  undefined,
);

export const useWidgetDrawer = () => {
  const context = useContext(WidgetDrawerContext);
  if (!context) {
    throw new Error("useWidgetDrawer must be used within WidgetDrawerProvider");
  }
  return context;
};

export const WidgetDrawerProvider = ({ children }: { children: ReactNode }) => {
  const [drawerState, setDrawerState] = useState<DrawerState>(initialState);

  const openDrawer = useCallback((state: Omit<DrawerState, "visible">) => {
    setDrawerState({
      ...state,
      visible: true,
    });
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerState((prev) => ({
      ...prev,
      visible: false,
    }));
  }, []);

  const contextValue = useMemo(
    () => ({
      drawerState,
      openDrawer,
      closeDrawer,
    }),
    [drawerState, openDrawer, closeDrawer],
  );

  return (
    <WidgetDrawerContext.Provider value={contextValue}>
      {children}
    </WidgetDrawerContext.Provider>
  );
};
