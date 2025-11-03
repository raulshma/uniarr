import React, { forwardRef } from "react";
import { View, ViewStyle } from "react-native";

export type ServiceCardRippleProps = {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

export type RippleHandle = {
  trigger: (x: number, y: number) => void;
};

/**
 * ServiceCardRipple — simplified wrapper without ripple effect
 */
const ServiceCardRipple = forwardRef<RippleHandle, ServiceCardRippleProps>(
  ({ children, style }, ref) => {
    return <View style={style}>{children}</View>;
  },
);

export default ServiceCardRipple;
