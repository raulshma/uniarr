import React, { useEffect, useState } from "react";
import { Slot } from "expo-router";
import { View } from "react-native";
import { Snackbar } from "react-native-paper";

import {
  subscribeJikanThrottle,
  isJikanThrottled,
} from "@/services/jikan/JikanClient";
import { strings } from "@/constants/strings";

const AnimeHubLayout: React.FC = () => {
  const [visible, setVisible] = useState<boolean>(() => isJikanThrottled());

  useEffect(() => {
    const unsub = subscribeJikanThrottle((v) => {
      if (v) setVisible(true);
      else setVisible(false);
    });
    return unsub;
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      <Snackbar
        visible={visible}
        onDismiss={() => setVisible(false)}
        action={{ label: "Dismiss", onPress: () => setVisible(false) }}
        duration={5000}
      >
        {strings.jikanRateLimited}
      </Snackbar>
    </View>
  );
};

export default AnimeHubLayout;
