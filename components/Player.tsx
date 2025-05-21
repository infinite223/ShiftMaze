import React from "react";
import { StyleSheet, View } from "react-native";

interface PlayerProps {
  position: { x: number; y: number };
  size: number;
}

const Player: React.FC<PlayerProps> = ({ position, size }) => {
  return (
    <View
      style={[
        styles.player,
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
  player: {
    backgroundColor: "blue",
    borderRadius: 100,
    position: "absolute",
  },
});

export default Player;
