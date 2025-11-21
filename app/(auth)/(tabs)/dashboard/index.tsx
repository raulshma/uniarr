import { StyleSheet, View } from "react-native";
import PagerView from "react-native-pager-view";
import { useTheme } from "@/hooks/useTheme";
import MainDashboard from "@/components/dashboard/MainDashboard";
import WidgetsDashboard from "@/components/dashboard/WidgetsDashboard";
import {
  useSettingsStore,
  selectDefaultDashboard,
} from "@/store/settingsStore";

const DashboardScreen = () => {
  const theme = useTheme();
  const defaultDashboard = useSettingsStore(selectDefaultDashboard);

  // Map dashboard preference to page index
  // Page 0: Widgets, Page 1: Main
  const initialPage = defaultDashboard === "widgets" ? 0 : 1;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <PagerView style={styles.pagerView} initialPage={initialPage}>
        <View key="1">
          <WidgetsDashboard />
        </View>
        <View key="2">
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
