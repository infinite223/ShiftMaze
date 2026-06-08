import React from "react";
import { StyleSheet, View } from "react-native";

interface MazeProps {
  mazeData: number[][];
  tileSize: number;
  color?: string;
}

/**
 * Renders the maze grid. The component sizes itself purely from `tileSize`
 * (tileSize * gridSize), so it always exactly fills its parent maze container.
 * Positioning/centering on screen is handled by the parent in GameScreen.
 */
const Maze: React.FC<MazeProps> = ({ mazeData, tileSize, color }) => {
  return (
    <View style={styles.mazeContainer}>
      {mazeData.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((cell, colIndex) => (
            <View
              key={`${rowIndex}-${colIndex}`}
              style={{
                width: tileSize,
                height: tileSize,
                backgroundColor: cell === 1 ? color || "black" : "lightgray",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "gray",
              }}
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
  },
  row: {
    flexDirection: "row",
  },
});

export default Maze;
