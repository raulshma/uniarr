/**
 * Example Usage of withBottomSheetMargins HOC
 *
 * This file demonstrates different ways to use the bottom sheet margins HOC
 */

import React, { useState } from "react";
import { View, Text, Modal } from "react-native";
import { Button } from "react-native-paper";
import {
  BottomDrawer,
  WithBottomSheetMargins,
  withBottomSheetMargins,
} from "@/components/common";

// ============================================
// Example 1: Using WithBottomSheetMargins component directly
// ============================================
export const Example1DirectUsage = () => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Button onPress={() => setVisible(true)}>Open Drawer</Button>

      <BottomDrawer
        visible={visible}
        onDismiss={() => setVisible(false)}
        title="Example Drawer"
      >
        <WithBottomSheetMargins>
          <View>
            <Text>This content has horizontal margins applied</Text>
          </View>
        </WithBottomSheetMargins>
      </BottomDrawer>
    </>
  );
};

// ============================================
// Example 2: Using withBottomSheetMargins HOC function
// ============================================
const MyCustomContent = () => (
  <View>
    <Text>My custom content</Text>
  </View>
);

// Wrap the component with the HOC
const MyCustomContentWithMargins = withBottomSheetMargins(MyCustomContent);

export const Example2HOCUsage = () => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Button onPress={() => setVisible(true)}>Open Drawer</Button>

      <BottomDrawer
        visible={visible}
        onDismiss={() => setVisible(false)}
        title="Example Drawer"
      >
        <MyCustomContentWithMargins />
      </BottomDrawer>
    </>
  );
};

// ============================================
// Example 3: Custom margin size
// ============================================
export const Example3CustomMargin = () => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Button onPress={() => setVisible(true)}>Open Drawer</Button>

      <BottomDrawer
        visible={visible}
        onDismiss={() => setVisible(false)}
        title="Example Drawer"
      >
        <WithBottomSheetMargins horizontalMargin={24}>
          <View>
            <Text>This content has 24px horizontal margins</Text>
          </View>
        </WithBottomSheetMargins>
      </BottomDrawer>
    </>
  );
};

// ============================================
// Example 4: Using with Modal (React Native Modal)
// ============================================
export const Example4ModalUsage = () => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Button onPress={() => setVisible(true)}>Open Modal</Button>

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <WithBottomSheetMargins>
          <View>
            <Text>Modal content with margins</Text>
          </View>
        </WithBottomSheetMargins>
      </Modal>
    </>
  );
};

// ============================================
// Example 5: Nested in existing drawer content
// ============================================
export const Example5NestedUsage = () => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Button onPress={() => setVisible(true)}>Open Drawer</Button>

      <BottomDrawer
        visible={visible}
        onDismiss={() => setVisible(false)}
        title="Settings"
      >
        {/* The BottomDrawer already has margins applied by default */}
        <View>
          <Text>Settings content</Text>
          <Text>No need to wrap with WithBottomSheetMargins</Text>
          <Text>Margins are already applied to BottomDrawer</Text>
        </View>
      </BottomDrawer>
    </>
  );
};
