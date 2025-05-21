import React from "react";
import { StyleSheet, View } from "react-native";

interface TargetProps {
  position: { x: number; y: number };
  size: number;
}

const Target: React.FC<TargetProps> = ({ position, size }) => {
  return (
    <View
      style={[
        styles.target,
        {
          width: size,
          height: size,
          left: position.x,
          top: position.y,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  target: {
    backgroundColor: "green",
    borderRadius: 5,
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default Target;
