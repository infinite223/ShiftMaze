import React from "react";
import { StyleSheet, View } from "react-native";
import { windowHeight, windowWidth } from "./GameScreen";

interface MazeProps {
  mazeData: number[][];
  tileSize: number;
  color?: string;
}

const Maze: React.FC<MazeProps> = ({ mazeData, tileSize, color }) => {
  return (
    <View style={styles.mazeContainer}>
      {mazeData.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((cell, colIndex) => (
            <View
              key={`${rowIndex}-${colIndex}`}
              style={[
                styles.tile,
                {
                  width: tileSize,
                  height: tileSize,
                  backgroundColor: cell === 1 ? color || "black" : "lightgray",
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  mazeContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: windowWidth,
    height: windowHeight,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
  },
  tile: {
    borderWidth: 0.5,
    borderColor: "gray",
  },
});

export default Maze;
