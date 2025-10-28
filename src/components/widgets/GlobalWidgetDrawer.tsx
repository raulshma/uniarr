import React from "react";
import ContentDrawer from "@/components/widgets/ContentDrawer";
import { useWidgetDrawer } from "@/services/widgetDrawerService";

export const GlobalWidgetDrawer = () => {
  const { drawerState, closeDrawer } = useWidgetDrawer();

  return (
    <ContentDrawer
      visible={drawerState.visible}
      onDismiss={closeDrawer}
      title={drawerState.title}
      content={drawerState.content}
      metadata={drawerState.metadata}
      actionUrl={drawerState.actionUrl}
      actionLabel={drawerState.actionLabel}
      loading={drawerState.loading}
      maxHeight={drawerState.maxHeight}
    />
  );
};
