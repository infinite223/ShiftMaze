import React, { useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";

interface JoystickProps {
  onMove: (direction: { x: number; y: number }) => void;
  size?: number;
  baseColor?: string;
  stickColor?: string;
}

const Joystick: React.FC<JoystickProps> = ({
  onMove,
  size = 150,
  baseColor = "rgba(0, 0, 0, 0.3)",
  stickColor = "rgba(0, 0, 0, 0.6)",
}) => {
  const baseRadius = size / 2;
  const stickSize = size / 2;
  const stickRadius = stickSize / 2;

  const [position, setPosition] = useState({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        let dx = gestureState.dx;
        let dy = gestureState.dy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > baseRadius) {
          const ratio = baseRadius / distance;
          dx *= ratio;
          dy *= ratio;
        }

        setPosition({ x: dx, y: dy });

        const normalizedX = dx / baseRadius;
        const normalizedY = dy / baseRadius;

        const threshold = 0.05;
        if (
          Math.abs(normalizedX) < threshold &&
          Math.abs(normalizedY) < threshold
        ) {
          onMove({ x: 0, y: 0 });
        } else {
          onMove({ x: normalizedX, y: normalizedY });
        }
      },
      onPanResponderRelease: () => {
        setPosition({ x: 0, y: 0 });
        onMove({ x: 0, y: 0 });
      },
    })
  ).current;

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: baseRadius,
          backgroundColor: baseColor,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          styles.stick,
          {
            width: stickSize,
            height: stickSize,
            borderRadius: stickRadius,
            backgroundColor: stickColor,
            transform: [{ translateX: position.x }, { translateY: position.y }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    position: "absolute",
    bottom: 40,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  stick: {
    position: "absolute",
  },
});

export default Joystick;
