import React, { useEffect, useRef } from 'react';
import { View, Modal, Animated, PanResponder, Dimensions, StyleSheet, Platform } from 'react-native';
import type { ViewStyle } from 'react-native';

interface SheetTransitionProps {
    children: React.ReactNode;
    style?: ViewStyle;
    onClose: () => void;
    visible?: boolean;
    scaleFactor?: number;
    dragThreshold?: number;
    opacityOnGestureMove?: boolean;
    containerRadiusSync?: boolean;
    initialBorderRadius?: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SheetTransition: React.FC<SheetTransitionProps> = ({
    children,
    style,
    onClose,
    visible = true,
    scaleFactor = 0.9,
    dragThreshold = 100,
    opacityOnGestureMove = true,
    containerRadiusSync = true,
    initialBorderRadius = 20,
}) => {
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(scaleFactor)).current;
    const borderRadius = useRef(new Animated.Value(initialBorderRadius)).current;

    useEffect(() => {
        if (visible) {
            // Slide up animation
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 8,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(scale, {
                    toValue: 1,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 8,
                }),
            ]).start();
        } else {
            // Slide down animation
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: SCREEN_HEIGHT,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 8,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(scale, {
                    toValue: scaleFactor,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 8,
                }),
            ]).start();
        }
    }, [visible, translateY, opacity, scale, scaleFactor]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dy) > 20 && gestureState.dy > 0;
            },
            onPanResponderMove: (_, gestureState) => {
                const { dy } = gestureState;

                if (dy > 0) { // Only allow downward gestures
                    const progress = Math.min(dy / SCREEN_HEIGHT, 1);

                    if (opacityOnGestureMove) {
                        opacity.setValue(1 - progress * 0.5);
                    }

                    if (containerRadiusSync) {
                        borderRadius.setValue(initialBorderRadius * (1 - progress * 0.3));
                    }

                    translateY.setValue(dy * 0.5);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                const { dy } = gestureState;

                if (dy > dragThreshold) {
                    onClose();
                } else {
                    // Snap back to original position
                    Animated.parallel([
                        Animated.spring(translateY, {
                            toValue: 0,
                            useNativeDriver: true,
                            tension: 100,
                            friction: 8,
                        }),
                        Animated.timing(opacity, {
                            toValue: 1,
                            duration: 200,
                            useNativeDriver: true,
                        }),
                        Animated.spring(borderRadius, {
                            toValue: initialBorderRadius,
                            useNativeDriver: false,
                        }),
                    ]).start();
                }
            },
        })
    ).current;

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
        >
      {/* Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: 'rgba(0, 0, 0, 1)',
            opacity: opacity,
          },
        ]}
        pointerEvents="auto"
      />

            {/* Sheet Content */}
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    {
                        transform: [
                            { translateY: translateY },
                            { scale: scale },
                        ],
                        borderTopLeftRadius: initialBorderRadius,
                        borderTopRightRadius: initialBorderRadius,
                        overflow: 'hidden',
                    },
                ]}
                {...panResponder.panHandlers}
            >
                <View style={[{ flex: 1, backgroundColor: 'white' }, style]}>
                    {children}
                </View>
            </Animated.View>
        </Modal>
    );
};

export default SheetTransition;
