import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, Button, Switch, useTheme, Divider } from "react-native-paper";
import { useRouter } from "expo-router";

import {
  CustomAlert,
  CustomConfirm,
  ConfirmationDialog,
  useDialog,
} from "@/components/common";
import { alert as dialogServiceAlert } from "@/services/dialogService";

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

const DevComponentsScreen: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const { present } = useDialog();

  // Redirect out when not in dev so this screen is unreachable in production
  useEffect(() => {
    if (!isDev) {
      // Prefer redirecting to dashboard when available
      void router.replace("/(auth)/dashboard");
    }
  }, [router]);

  const [lastAction, setLastAction] = useState<string | null>(null);

  // Local direct component toggles
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertVariantThree, setAlertVariantThree] = useState(true);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmDestructive, setConfirmDestructive] = useState(false);

  const [confirmationVisible, setConfirmationVisible] = useState(false);

  if (!isDev) {
    // Render nothing (effect above will redirect). Keep component tiny in production.
    return null;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Text variant="titleLarge">Dev Components Playground</Text>
        <Text
          variant="bodyMedium"
          style={{ marginTop: 6, color: theme.colors.onSurfaceVariant }}
        >
          This page is only reachable in development builds. Use it to exercise
          custom dialog components and the dialog presenter.
        </Text>
      </View>

      <Divider />

      <View style={styles.section}>
        <Text variant="titleMedium">Direct components</Text>

        <View style={styles.row}>
          <Button
            mode="contained"
            onPress={() => {
              setAlertVariantThree(true);
              setAlertVisible(true);
            }}
            style={styles.button}
          >
            Show CustomAlert (3 actions)
          </Button>

          <Button
            mode="outlined"
            onPress={() => {
              setAlertVariantThree(false);
              setAlertVisible(true);
            }}
            style={styles.button}
          >
            Show CustomAlert (1 action)
          </Button>
        </View>

        <View style={[styles.row, { marginTop: 8 }]}>
          <Button
            mode="contained"
            onPress={() => setConfirmVisible(true)}
            style={styles.button}
          >
            Show CustomConfirm
          </Button>

          <View style={styles.switchRow}>
            <Text style={{ marginRight: 8 }}>Destructive</Text>
            <Switch
              value={confirmDestructive}
              onValueChange={setConfirmDestructive}
            />
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          <Button mode="outlined" onPress={() => setConfirmationVisible(true)}>
            Show ConfirmationDialog (wrapper)
          </Button>
        </View>
      </View>

      <Divider />

      <View style={styles.section}>
        <Text variant="titleMedium">Dialog service / presenter</Text>

        <View style={styles.row}>
          <Button
            mode="contained"
            onPress={() =>
              dialogServiceAlert(
                "Service: 3 actions",
                "Presented via dialogService.alert (mapped to CustomAlert).",
                [
                  {
                    text: "Maybe",
                    onPress: () => setLastAction("service: maybe"),
                  },
                  {
                    text: "Later",
                    onPress: () => setLastAction("service: later"),
                  },
                  { text: "OK", onPress: () => setLastAction("service: ok") },
                ],
              )
            }
            style={styles.button}
          >
            Present 3-action Alert
          </Button>

          <Button
            mode="outlined"
            onPress={() =>
              dialogServiceAlert(
                "Service: confirm",
                "Presented as a two-button confirm via dialog service",
                [
                  {
                    text: "Cancel",
                    style: "cancel",
                    onPress: () => setLastAction("service: cancel"),
                  },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => setLastAction("service: delete"),
                  },
                ],
              )
            }
            style={styles.button}
          >
            Present Confirm
          </Button>
        </View>

        <View style={[styles.row, { marginTop: 8 }]}>
          <Button
            mode="contained"
            onPress={() =>
              present({
                title: "useDialog.present",
                message:
                  "This uses the DialogProvider present function directly",
                buttons: [
                  {
                    text: "No",
                    style: "cancel",
                    onPress: () => setLastAction("useDialog: no"),
                  },
                  {
                    text: "Yes",
                    onPress: () => setLastAction("useDialog: yes"),
                  },
                ],
              })
            }
            style={styles.button}
          >
            Present via useDialog
          </Button>
        </View>
      </View>

      <Divider />

      <View style={styles.section}>
        <Text variant="titleMedium">Last action</Text>
        <Text variant="bodyMedium" style={{ marginTop: 8 }}>
          {lastAction ?? "No action yet"}
        </Text>
      </View>

      {/* Render the direct components so they can be exercised without going through the presenter */}
      <CustomAlert
        visible={alertVisible}
        title={alertVariantThree ? "Three action alert" : "Single action alert"}
        message={
          alertVariantThree
            ? "Left tertiary, middle secondary and right primary."
            : "Single primary action only."
        }
        tertiaryLabel={alertVariantThree ? "Tertiary" : undefined}
        secondaryLabel={alertVariantThree ? "Secondary" : undefined}
        primaryLabel={alertVariantThree ? "Primary" : "OK"}
        onTertiary={() => setLastAction("alert: tertiary")}
        onSecondary={() => setLastAction("alert: secondary")}
        onPrimary={() => setLastAction("alert: primary")}
        onDismiss={() => setAlertVisible(false)}
      />

      <CustomConfirm
        visible={confirmVisible}
        title="Confirm action"
        message="Are you sure you want to perform this action?"
        cancelLabel="Cancel"
        confirmLabel={confirmDestructive ? "Delete" : "Confirm"}
        destructive={confirmDestructive}
        onCancel={() => setLastAction("confirm: cancel")}
        onConfirm={() => setLastAction("confirm: confirm")}
        onDismiss={() => setConfirmVisible(false)}
      />

      <ConfirmationDialog
        visible={confirmationVisible}
        title="Wrapped confirmation"
        message="This uses the ConfirmationDialog wrapper over CustomConfirm"
        confirmLabel="Do it"
        cancelLabel="Nah"
        onConfirm={() => {
          setLastAction("wrapped: confirm");
          setConfirmationVisible(false);
        }}
        onCancel={() => {
          setLastAction("wrapped: cancel");
          setConfirmationVisible(false);
        }}
      />

      <View style={{ height: 64 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  row: {
    marginTop: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  button: {
    minWidth: 160,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
});

export default DevComponentsScreen;
