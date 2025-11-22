import React, { useMemo, useRef, useCallback, useEffect } from "react";
import { View, StyleSheet, ViewStyle, Dimensions } from "react-native";
import { useTheme, Text, TouchableRipple, Icon } from "react-native-paper";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { ANIMATION_DURATIONS } from "@/utils/animations.utils";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  maxHeight?: string | number;
  children?: React.ReactNode;
  style?: ViewStyle;
  closeOnBackdropPress?: boolean;
};

type DrawerItemProps = {
  icon?: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  selected?: boolean;
};

export const DrawerItem: React.FC<DrawerItemProps> = ({
  icon,
  label,
  onPress,
  destructive = false,
  disabled = false,
  selected = false,
}) => {
  const theme = useTheme();

  const textColor = destructive
    ? theme.colors.error
    : disabled
      ? theme.colors.onSurfaceDisabled
      : theme.colors.onSurface;

  return (
    <TouchableRipple
      onPress={onPress}
      disabled={disabled}
      borderless
      style={styles.drawerItemRipple}
    >
      <View style={styles.drawerItem}>
        {icon && (
          <View style={styles.iconContainer}>
            <Icon source={icon} size={24} color={textColor} />
          </View>
        )}
        <Text
          variant="bodyLarge"
          style={[
            styles.drawerItemText,
            {
              color: textColor,
              fontWeight: selected ? "600" : "400",
            },
          ]}
        >
          {label}
        </Text>
        {selected && (
          <Icon source="check" size={20} color={theme.colors.primary} />
        )}
      </View>
    </TouchableRipple>
  );
};

const { height: screenHeight } = Dimensions.get("window");

const BottomDrawer: React.FC<Props> = ({
  visible,
  onDismiss,
  title,
  maxHeight = "60%",
  children,
  style,
  closeOnBackdropPress = true,
}) => {
  const theme = useTheme();
  const sheetRef = useRef<BottomSheet | null>(null);

  // Calculate snap points more intelligently
  const snapPoints = useMemo(() => {
    if (typeof maxHeight === "string") {
      if (maxHeight.includes("%")) {
        const percentage = parseFloat(maxHeight) / 100;
        return [Math.max(200, screenHeight * percentage)]; // Minimum 200px height
      }
      return [parseFloat(maxHeight)];
    }
    return [maxHeight];
  }, [maxHeight]);

  const handleChange = useCallback(
    (index: number) => {
      if (index === -1) {
        onDismiss();
      }
    },
    [onDismiss],
  );

  useEffect(() => {
    if (visible) {
      sheetRef.current?.snapToIndex?.(0);
    } else {
      sheetRef.current?.close?.();
    }
  }, [visible]);

  const backdropOpacity = theme.dark ? 0.2 : 0.1;
  const handleColor = theme.colors.onSurfaceVariant ?? theme.colors.onSurface;

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <Animated.View
        entering={FadeIn.duration(ANIMATION_DURATIONS.NORMAL)}
        exiting={FadeOut.duration(ANIMATION_DURATIONS.QUICK)}
        style={StyleSheet.absoluteFill}
      >
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={backdropOpacity}
          pressBehavior={closeOnBackdropPress ? "close" : "none"}
        />
      </Animated.View>
    ),
    [backdropOpacity, closeOnBackdropPress],
  );

  if (!visible) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={closeOnBackdropPress}
        handleIndicatorStyle={[styles.handle, { backgroundColor: handleColor }]}
        backdropComponent={renderBackdrop}
        onChange={handleChange}
        enableDynamicSizing={false}
        backgroundStyle={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          marginHorizontal: 16, // Add horizontal margins to drawer
        }}
        handleStyle={{
          paddingTop: 8,
          paddingBottom: 4,
        }}
        animateOnMount={true}
      >
        <View>
          <View style={styles.headerRow}>
            {title ? (
              <Text
                variant="headlineSmall"
                style={{
                  color: theme.colors.onSurface,
                  flex: 1,
                  fontWeight: "600",
                }}
              >
                {title}
              </Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </View>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {children}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 36, // Increased from 20 to add more left padding
    paddingTop: 8,
    paddingBottom: 16,
  },
  closeButton: {
    margin: 0,
  },
  content: {
    paddingHorizontal: 36, // Increased from 20 to match header padding
    paddingBottom: 32,
  },
  drawerItemRipple: {
    borderRadius: 12,
    marginVertical: 2,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  drawerItemText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
});

export default BottomDrawer;
