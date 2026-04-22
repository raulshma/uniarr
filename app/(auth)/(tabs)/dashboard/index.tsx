import { StyleSheet, View } from "react-native";
import PagerView from "react-native-pager-view";
import { useTheme } from "@/hooks/useTheme";
import MainDashboard from "@/components/dashboard/MainDashboard";
import WidgetsDashboard from "@/components/dashboard/WidgetsDashboard";
import TimelineDashboard from "@/components/dashboard/TimelineDashboard";
import {
  useSettingsStore,
  selectDefaultDashboard,
  selectExperimentalTimelineDashboardEnabled,
} from "@/store/settingsStore";

const DashboardScreen = () => {
  const theme = useTheme();
  const defaultDashboard = useSettingsStore(selectDefaultDashboard);
  const timelineEnabled = useSettingsStore(
    selectExperimentalTimelineDashboardEnabled,
  );

  const initialPage = (() => {
    if (!timelineEnabled) {
      return defaultDashboard === "widgets" ? 0 : 1;
    }
    if (defaultDashboard === "widgets") return 0;
    if (defaultDashboard === "timeline") return 1;
    return 2;
  })();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <PagerView style={styles.pagerView} initialPage={initialPage}>
        <View key="widgets">
          <WidgetsDashboard />
        </View>
        <View key="timeline">
          {timelineEnabled ? <TimelineDashboard /> : <MainDashboard />}
        </View>
        <View key="main">
          <MainDashboard />
        </View>
      </PagerView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pagerView: {
    flex: 1,
  },
});

export default DashboardScreen;
